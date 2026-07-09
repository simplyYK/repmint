"use client";

// /train — the flagship live camera coach + workout runner.
//
// Entry: a session launcher (continue plan / recents / your workouts / quick
// single exercise) unless ?template=, ?slug=, ?starter= or ?quick= is given.
// Flow per set: camera setup gate (framing/privacy) → live coaching HUD with
// rep ring, voice cues, per-rep quality and fatigue tracking (tier 1/2), or
// manual/timer logging (tier 3) → weight quick-log → rest timer → summary.
//
// ML per rep: RepEvent → scoreRep (ROM/tempo/stability composite) and
// SetAnalytics (velocity-loss fatigue, Pareja-Blanco 2017 thresholds).
// Voice: VoiceCoach announces reps and speaks one form cue at a time.

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { usePoseTracker, type SetOutcome } from "../../hooks/usePoseTracker";
import { useWakeLock } from "../../hooks/useWakeLock";
import {
  getTemplate,
  getProfile,
  getSettings,
  saveSession,
  listTemplates,
  listSessions,
  getActivePlan,
  type TemplateWithExercises,
  type ActivePlan,
} from "../../lib/db";
import { getMovementForSlug, getMeta, TIER_INFO } from "../../lib/library";
import { configFromProfile, DEFAULT_PROFILE } from "../../lib/types";
import type { DbSession } from "../../lib/types";
import type { MovementDef } from "../../lib/movements/types";
import { Spinner, Button, Reveal } from "../../components/ui/primitives";
import { CoachVoice } from "../../lib/tracking/coachVoice";
import { scoreRep } from "../../lib/tracking/repQuality";
import { SetAnalytics, type FatigueStatus } from "../../lib/tracking/setAnalytics";
import { WeightLogger } from "./WeightLogger";
import { RestTimer } from "./RestTimer";
import {
  buildAdHocSets,
  buildPlannedSets,
  groupByExercise,
  readLastWeight,
  writeLastWeight,
  type CompletedSet,
  type PlannedSet,
} from "./workoutModel";
import { formatClock, relativeDate } from "../../lib/format";
import { athleteImageFor } from "../../lib/athleteImage";
import { SessionSummary } from "./SessionSummary";

type Stage = "config" | "coach" | "log" | "rest" | "summary";

/** Titles of the seeded system starter templates, keyed by ?starter= value. */
const STARTER_TITLES: Record<string, string> = {
  room: "Room Workout",
  gym: "Gym Starter",
  minimum: "15-min Minimum",
};

/** Cap a session at 2 sets per exercise — the sanctioned "short version". */
function compressPlanned(sets: PlannedSet[]): PlannedSet[] {
  const kept = sets.filter((s) => s.setIndex < 2);
  const totals = new Map<string, number>();
  for (const s of kept) totals.set(s.exerciseSlug, (totals.get(s.exerciseSlug) ?? 0) + 1);
  return kept.map((s) => ({ ...s, totalSets: totals.get(s.exerciseSlug) ?? s.totalSets }));
}

/** Estimated minutes for the planned sets (work + rest), rounded to 5. */
function estimateSessionMinutes(sets: PlannedSet[]): number {
  let seconds = 0;
  for (const s of sets) {
    seconds += s.targetSeconds ?? (s.targetReps ?? 10) * 4;
    seconds += s.restSeconds ?? 60;
  }
  return Math.max(5, Math.round(seconds / 60 / 5) * 5);
}

function TrainInner() {
  const router = useRouter();
  const params = useSearchParams();
  const templateId = params.get("template");
  const slugParam = params.get("slug");
  const planDayId = params.get("day");
  const starterParam = params.get("starter");
  const quickParam = params.get("quick");
  const shortParam = params.get("short") === "1";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [template, setTemplate] = useState<TemplateWithExercises | null>(null);
  const [planned, setPlanned] = useState<PlannedSet[]>([]);
  const [short, setShort] = useState(shortParam);
  const [unit, setUnit] = useState<"kg" | "lb">("kg");

  const [index, setIndex] = useState(0);
  const [stage, setStage] = useState<Stage>("config");
  const [completed, setCompleted] = useState<CompletedSet[]>([]);
  const [saving, setSaving] = useState(false);
  const [savedSessionId, setSavedSessionId] = useState<string | null>(null);
  const startedAtRef = useRef<string>(new Date().toISOString());

  // Pending set outcome captured between coach → log stages.
  const [pendingOutcome, setPendingOutcome] = useState<{
    reps: number | null;
    seconds: number | null;
    tut: number | null;
    formScore: number | null;
    romScore: number | null;
    cues: string[];
    repMetrics: Record<string, unknown>[];
  } | null>(null);
  const [logWeight, setLogWeight] = useState<{ weight: number | null; bodyweight: boolean }>({
    weight: null,
    bodyweight: true,
  });

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        if (templateId) {
          const t = await getTemplate(templateId);
          if (!active) return;
          if (!t) {
            setError("That workout couldn't be found.");
          } else {
            setTemplate(t);
            setPlanned(buildPlannedSets(t));
          }
        } else if (starterParam || quickParam) {
          // Resolve a seeded system template by title: ?starter=room|gym|minimum
          // or ?quick=15 (streak-saver = the 15-min Minimum).
          const wanted = starterParam ? STARTER_TITLES[starterParam] : "15-min Minimum";
          const all = await listTemplates().catch(() => [] as TemplateWithExercises[]);
          if (!active) return;
          const t = all.find((x) => x.title === wanted) ?? all[0];
          if (!t) {
            setError("No starter workout is available yet — build one in Workouts.");
          } else {
            setTemplate(t);
            setPlanned(buildPlannedSets(t));
          }
        } else if (slugParam) {
          const meta = getMeta(slugParam);
          if (!meta) setError("That exercise couldn't be found.");
          else setPlanned(buildAdHocSets(meta));
        }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Could not load this workout.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [templateId, slugParam, starterParam, quickParam]);

  // Fetch the user's unit preference from the profile.
  useEffect(() => {
    let active = true;
    getProfile()
      .then((p) => {
        if (active && p && (p as { units?: "kg" | "lb" }).units) setUnit((p as { units: "kg" | "lb" }).units);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const effectivePlanned = useMemo(() => (short ? compressPlanned(planned) : planned), [planned, short]);
  const current = effectivePlanned[index];
  const exGroups = useMemo(() => groupByExercise(effectivePlanned), [effectivePlanned]);
  const estMin = useMemo(
    () => (effectivePlanned.length ? estimateSessionMinutes(effectivePlanned) : null),
    [effectivePlanned],
  );

  const begin = () => {
    startedAtRef.current = new Date().toISOString();
    setStage("coach");
    setIndex(0);
  };

  const handleSetComplete = (outcome: {
    reps: number | null;
    seconds: number | null;
    tut: number | null;
    formScore: number | null;
    romScore: number | null;
    cues: string[];
    repMetrics: Record<string, unknown>[];
  }) => {
    setPendingOutcome(outcome);
    const last = readLastWeight(current.exerciseSlug);
    const meta = current.meta;
    setLogWeight({
      weight: current.targetWeight ?? last ?? (meta.loadType === "external" ? (unit === "kg" ? 20 : 45) : 0),
      bodyweight: meta.loadType !== "external" && current.targetWeight == null && last == null,
    });
    setStage("log");
  };

  const confirmLog = () => {
    if (!current || !pendingOutcome) return;
    const completedSet: CompletedSet = {
      key: current.key,
      exerciseSlug: current.exerciseSlug,
      setIndex: current.setIndex,
      reps: pendingOutcome.reps,
      seconds: pendingOutcome.seconds,
      weight: logWeight.bodyweight ? null : logWeight.weight,
      isBodyweight: logWeight.bodyweight,
      avgFormScore: pendingOutcome.formScore,
      romScore: pendingOutcome.romScore,
      tutSeconds: pendingOutcome.tut,
      topCues: pendingOutcome.cues,
      repMetrics: pendingOutcome.repMetrics,
    };
    if (!logWeight.bodyweight && logWeight.weight) writeLastWeight(current.exerciseSlug, logWeight.weight);
    setCompleted((c) => [...c, completedSet]);
    setPendingOutcome(null);

    const isLast = index >= effectivePlanned.length - 1;
    if (isLast) {
      setStage("summary");
    } else {
      setStage("rest");
    }
  };

  const goNextSet = () => {
    setIndex((i) => Math.min(i + 1, effectivePlanned.length - 1));
    setStage("coach");
  };

  const finishEarly = () => setStage("summary");

  const doSave = async (title: string, notes: string) => {
    setSaving(true);
    try {
      const id = await saveSession(
        {
          templateId: template?.id ?? null,
          planDayId: planDayId ?? null,
          title,
          startedAt: startedAtRef.current,
          endedAt: new Date().toISOString(),
          status: "completed",
          notes: notes || null,
        },
        completed.map((c, i) => ({
          exerciseSlug: c.exerciseSlug,
          setIndex: i,
          reps: c.reps,
          seconds: c.seconds,
          weight: c.weight,
          weightUnit: unit,
          isBodyweight: c.isBodyweight,
          avgFormScore: c.avgFormScore,
          romScore: c.romScore,
          tutSeconds: c.tutSeconds,
          topCues: c.topCues,
          repMetrics: c.repMetrics,
        })),
      );
      setSavedSessionId(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the session.");
      setSaving(false);
    }
  };

  if (loading) return <Spinner label="Setting up your session…" />;

  if (error && stage === "config") {
    return (
      <div className="train-config">
        <div className="notice notice-danger">{error}</div>
        <Link href="/hub" className="btn btn-secondary btn-md">
          Back to hub
        </Link>
      </div>
    );
  }

  // ---- Config / start screen ----
  if (stage === "config") {
    if (planned.length === 0) {
      return <SessionLauncher onPickSlug={(slug) => router.replace(`/train?slug=${slug}`)} />;
    }
    return (
      <div className="train-config">
        <p className="eyebrow">Ready to train</p>
        <h1>{template?.title ?? current?.meta.name ?? "Quick session"}</h1>
        <p className="train-config-sub">
          {exGroups.length} exercise{exGroups.length === 1 ? "" : "s"} · {effectivePlanned.length} sets
          {estMin ? ` · ~${estMin} min` : ""}. RepMint coaches the camera-trackable moves and logs the rest.
        </p>
        {planned.some((s) => s.setIndex >= 2) && (
          <button
            type="button"
            className={`train-short-toggle${short ? " on" : ""}`}
            onClick={() => setShort((v) => !v)}
            aria-pressed={short}
          >
            <span className="train-short-dot" aria-hidden />
            Short on time? Cap at 2 sets per exercise
            {short ? " — on" : ""}
          </button>
        )}
        <ul className="train-plan-list">
          {exGroups.map((g) => {
            const tier = g.meta.tier;
            return (
              <li key={g.slug}>
                <div>
                  <strong>{g.meta.name}</strong>
                  <small>
                    {g.count} set{g.count === 1 ? "" : "s"} · {TIER_INFO[tier].short}
                  </small>
                </div>
                <span className={`tier-dot tier-${tier}`} aria-hidden />
              </li>
            );
          })}
        </ul>
        <div className="row-wrap">
          <Button size="lg" onClick={begin}>
            Start session{estMin ? ` · ~${estMin} min` : ""}
          </Button>
          <Link href="/hub" className="btn btn-ghost btn-md">
            Cancel
          </Link>
        </div>
      </div>
    );
  }

  // ---- Summary ----
  if (stage === "summary") {
    return (
      <SessionSummary
        completed={completed}
        unit={unit}
        saving={saving}
        savedSessionId={savedSessionId}
        defaultTitle={template?.title ?? current?.meta.name ?? "Training session"}
        onSave={doSave}
        error={error}
      />
    );
  }

  // ---- Rest ----
  if (stage === "rest") {
    const next = effectivePlanned[Math.min(index + 1, effectivePlanned.length - 1)];
    return (
      <div className="train-live">
        <RestTimer
          seconds={current?.restSeconds ?? 60}
          nextLabel={next ? `${next.meta.name} · set ${next.setIndex + 1}/${next.totalSets}` : "next set"}
          onDone={goNextSet}
        />
        <button className="btn btn-ghost btn-sm train-finish" onClick={finishEarly}>
          Finish session early
        </button>
      </div>
    );
  }

  // ---- Log weight ----
  if (stage === "log" && current) {
    return (
      <div className="train-live train-log-screen">
        <p className="eyebrow">Log this set</p>
        <h1>{current.meta.name}</h1>
        <div className="train-log-summary">
          {pendingOutcome?.reps != null && <span>{pendingOutcome.reps} reps</span>}
          {pendingOutcome?.seconds != null && <span>{formatClock(pendingOutcome.seconds)}</span>}
          {pendingOutcome?.tut != null && <span>{Math.round(pendingOutcome.tut)}s TUT</span>}
          {pendingOutcome?.formScore != null && <span>{Math.round(pendingOutcome.formScore)}% form</span>}
        </div>
        <WeightLogger
          unit={unit}
          loadType={current.meta.loadType}
          initialWeight={logWeight.weight}
          initialBodyweight={logWeight.bodyweight}
          onChange={(weight, bodyweight) => setLogWeight({ weight, bodyweight })}
        />
        <div className="row-wrap">
          <Button size="lg" onClick={confirmLog}>
            {index >= effectivePlanned.length - 1 ? "Finish & review" : "Log set"}
          </Button>
        </div>
      </div>
    );
  }

  // ---- Live coach ----
  if (stage === "coach" && current) {
    return (
      <LiveCoach
        key={current.key}
        planned={current}
        index={index}
        total={effectivePlanned.length}
        onComplete={handleSetComplete}
        onQuit={finishEarly}
      />
    );
  }

  return <Spinner label="Loading…" />;
}

/* ------------------------------------------------------------------ */
/* Session launcher: what you see when you tap Train with no target    */
/* ------------------------------------------------------------------ */

function SessionLauncher({ onPickSlug }: { onPickSlug: (slug: string) => void }) {
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<ActivePlan | null>(null);
  const [templates, setTemplates] = useState<TemplateWithExercises[]>([]);
  const [recents, setRecents] = useState<DbSession[]>([]);
  const [showQuick, setShowQuick] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const now = new Date();
        const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const [p, tpls, cur, last] = await Promise.all([
          getActivePlan().catch(() => null),
          listTemplates().catch(() => [] as TemplateWithExercises[]),
          listSessions(now).catch(() => [] as DbSession[]),
          listSessions(prev).catch(() => [] as DbSession[]),
        ]);
        if (!active) return;
        setPlan(p);
        setTemplates(tpls);
        const tplIds = new Set(tpls.map((t) => t.id));
        const seen = new Set<string>();
        const rec = [...cur, ...last]
          .filter((s) => s.status === "completed" && s.template_id && tplIds.has(s.template_id))
          .filter((s) => {
            if (seen.has(s.template_id as string)) return false;
            seen.add(s.template_id as string);
            return true;
          })
          .slice(0, 3);
        setRecents(rec);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  if (loading) return <Spinner label="Loading your training…" />;

  const todayDay = plan?.days.find((d) => !d.is_rest && d.template_id);
  const todayTemplate = todayDay && templates.find((t) => t.id === todayDay.template_id);
  const byId = new Map(templates.map((t) => [t.id, t]));
  const quick = ["squat", "strict_push_up", "bicep_curl", "front_plank", "reverse_lunge", "bent_over_row"];

  return (
    <div className="train-config train-launcher">
      <p className="eyebrow">Train</p>
      <h1>What are we training?</h1>

      {todayTemplate && (
        <Reveal>
          <Link href={`/train?template=${todayTemplate.id}&day=${todayDay!.id}`} className="launcher-hero">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={athleteImageFor(todayTemplate.title, todayDay?.focus, todayTemplate.description)} alt="" className="launcher-hero-img" />
            <div className="launcher-hero-scrim" aria-hidden />
            <div className="launcher-hero-body">
              <span className="eyebrow">Continue your plan · today</span>
              <strong>{todayTemplate.title}</strong>
              <small>
                {todayDay!.focus ? `${todayDay!.focus} · ` : ""}
                {todayTemplate.exercises.length} exercises
              </small>
              <span className="btn btn-primary btn-md launcher-hero-btn">Start today&apos;s session</span>
            </div>
          </Link>
        </Reveal>
      )}

      {recents.length > 0 && (
        <Reveal delay={0.06}>
          <section className="launcher-section">
            <h2>Jump back in</h2>
            <div className="launcher-recents">
              {recents.map((s) => {
                const t = byId.get(s.template_id as string);
                if (!t) return null;
                return (
                  <Link key={s.id} href={`/train?template=${t.id}`} className="launcher-recent">
                    <div>
                      <strong>{t.title}</strong>
                      <small>
                        {relativeDate(s.started_at)} · {s.total_sets} sets · {s.total_reps} reps
                      </small>
                    </div>
                    <span className="launcher-recent-go" aria-hidden>
                      ▶
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        </Reveal>
      )}

      {templates.length > 0 && (
        <Reveal delay={0.12}>
          <section className="launcher-section">
            <h2>Your workouts</h2>
            <div className="launcher-templates">
              {templates.slice(0, 8).map((t) => (
                <Link key={t.id} href={`/train?template=${t.id}`} className="launcher-template">
                  <strong>{t.title}</strong>
                  <small>
                    {t.exercises.length} exercises
                    {t.est_duration_min ? ` · ~${t.est_duration_min} min` : ""}
                  </small>
                </Link>
              ))}
            </div>
            <Link href="/workouts" className="chip">
              All workouts →
            </Link>
          </section>
        </Reveal>
      )}

      <Reveal delay={0.18}>
        <section className="launcher-section">
          <button type="button" className="launcher-quick-toggle" onClick={() => setShowQuick((v) => !v)}>
            Quick single exercise {showQuick ? "▴" : "▾"}
          </button>
          {showQuick && (
            <>
              <div className="grid-auto">
                {quick.map((slug) => {
                  const m = getMeta(slug);
                  return (
                    m && (
                      <button key={m.slug} className="adhoc-pick" onClick={() => onPickSlug(m.slug)}>
                        <strong>{m.name}</strong>
                        <small>{TIER_INFO[m.tier].short}</small>
                      </button>
                    )
                  );
                })}
              </div>
              <Link href="/exercises" className="btn btn-secondary btn-md">
                Full exercise library
              </Link>
            </>
          )}
        </section>
      </Reveal>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Live coach for a single set                                         */
/* ------------------------------------------------------------------ */

type SetOutcomePayload = {
  reps: number | null;
  seconds: number | null;
  tut: number | null;
  formScore: number | null;
  romScore: number | null;
  cues: string[];
  repMetrics: Record<string, unknown>[];
};

function LiveCoach({
  planned,
  index,
  total,
  onComplete,
  onQuit,
}: {
  planned: PlannedSet;
  index: number;
  total: number;
  onComplete: (o: SetOutcomePayload) => void;
  onQuit: () => void;
}) {
  const meta = planned.meta;
  const tier = meta.tier;
  const movement: MovementDef | undefined = getMovementForSlug(meta.slug);
  const config = useMemo(() => configFromProfile(DEFAULT_PROFILE), []);
  const { request: wake, release: releaseWake } = useWakeLock();

  // Tier 3 / no movement def → manual/timer set (no camera pipeline).
  const isCameraSet = tier !== 3 && Boolean(movement);

  if (!isCameraSet) {
    return (
      <ManualSet
        planned={planned}
        index={index}
        total={total}
        onComplete={onComplete}
        onQuit={onQuit}
      />
    );
  }

  return (
    <CameraSet
      movement={movement as MovementDef}
      planned={planned}
      config={config}
      index={index}
      total={total}
      wake={wake}
      releaseWake={releaseWake}
      onComplete={onComplete}
      onQuit={onQuit}
    />
  );
}

const FATIGUE_LABEL: Record<FatigueStatus, string | null> = {
  fresh: null,
  productive: "In the productive zone",
  high_fatigue: "Power dropping — finish strong",
  stop_suggested: "Consider ending the set",
};

function CameraSet({
  movement,
  planned,
  config,
  index,
  total,
  wake,
  releaseWake,
  onComplete,
  onQuit,
}: {
  movement: MovementDef;
  planned: PlannedSet;
  config: ReturnType<typeof configFromProfile>;
  index: number;
  total: number;
  wake: () => Promise<void>;
  releaseWake: () => Promise<void>;
  onComplete: (o: SetOutcomePayload) => void;
  onQuit: () => void;
}) {
  const { videoRef, canvasRef, snapshot, startCamera, startSet, endSet, resetSet, manualRep } = usePoseTracker(
    movement,
    config,
  );
  const [active, setActive] = useState(false);
  // Voice preference survives set remounts (CameraSet remounts per set).
  const [voiceOn, setVoiceOnState] = useState(
    () => typeof window === "undefined" || window.localStorage.getItem("repmint-voice") !== "off",
  );
  const setVoiceOn = (fn: (v: boolean) => boolean) =>
    setVoiceOnState((v) => {
      const next = fn(v);
      try {
        window.localStorage.setItem("repmint-voice", next ? "on" : "off");
      } catch {
        // storage unavailable (private mode) — preference just won't persist
      }
      return next;
    });
  const [overrideSetup, setOverrideSetup] = useState(false);
  const isHold = movement.mode === "hold";
  const targetReps = planned.targetReps ?? movement.target.reps ?? 0;
  const targetSeconds = planned.targetSeconds ?? movement.target.seconds ?? 40;
  const tier = planned.meta.tier;

  // ---- ML instrumentation: voice, per-rep quality, fatigue ----
  const voiceRef = useRef<CoachVoice | null>(null);
  const analyticsRef = useRef(new SetAnalytics());
  const [repScores, setRepScores] = useState<number[]>([]);
  const repMetricsRef = useRef<Record<string, unknown>[]>([]);
  const lastSpokenCue = useRef<string>("");
  const lastRepNumber = useRef(0);
  const fatigueSpoken = useRef(false);

  useEffect(() => {
    voiceRef.current = new CoachVoice("browser");
    // Upgrade to the natural OpenAI voice if the user picked it in Settings
    // (browser engine keeps working while this loads / if it fails).
    getSettings()
      .then((s) => {
        if (voiceRef.current && (s.voice_provider === "openai" || s.voice_provider === "realtime")) {
          voiceRef.current = new CoachVoice(s.voice_provider, s.tts_voice || undefined);
        }
      })
      .catch(() => {});
    return () => voiceRef.current?.stop();
  }, []);
  useEffect(() => {
    if (voiceRef.current) voiceRef.current.enabled = voiceOn;
  }, [voiceOn]);

  // Announce reps + score them as they land.
  const lastRep = snapshot.lastRep;
  useEffect(() => {
    if (!lastRep || lastRep.repNumber === lastRepNumber.current) return;
    lastRepNumber.current = lastRep.repNumber;

    voiceRef.current?.announceRep(lastRep.repNumber);

    const quality = scoreRep({
      peakDepth: lastRep.peakDepth,
      minFrac: movement.minRepFraction,
      tutSeconds: lastRep.tutSeconds,
      tutTargetSeconds: config.tutTargetPerRep || 4,
      concentricSeconds: lastRep.concentricSeconds,
      severity1Faults: 0,
      severity2Faults: 0,
    });
    setRepScores((cur) => [...cur, quality.score]);

    const vConc = lastRep.concentricSeconds > 0 ? lastRep.peakDepth / lastRep.concentricSeconds : 0;
    analyticsRef.current.addRep({ vConc, concentricSeconds: lastRep.concentricSeconds });
    repMetricsRef.current.push({
      rep: lastRep.repNumber,
      score: quality.score,
      rom: Math.round(quality.rom * 100) / 100,
      tempo: Math.round(quality.tempo * 100) / 100,
      tut: lastRep.tutSeconds,
      concentricSeconds: lastRep.concentricSeconds,
      vConc: Math.round(vConc * 100) / 100,
    });

    const status = analyticsRef.current.status;
    if ((status === "high_fatigue" || status === "stop_suggested") && !fatigueSpoken.current) {
      fatigueSpoken.current = true;
      voiceRef.current?.milestone(
        status === "stop_suggested" ? "Power is dropping fast — consider ending the set." : "Power is dropping — two more good reps.",
      );
    }
  }, [lastRep, movement.minRepFraction, config.tutTargetPerRep]);

  // Speak form cues when they change (adjust tone only — praise stays visual).
  useEffect(() => {
    if (!active || !snapshot.cue || snapshot.tone !== "adjust") return;
    if (snapshot.cue === lastSpokenCue.current) return;
    lastSpokenCue.current = snapshot.cue;
    voiceRef.current?.cue(snapshot.cue);
  }, [snapshot.cue, snapshot.tone, active]);

  const [manualFallback, setManualFallback] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const countdownRef = useRef<number | null>(null);
  const cameraBlocked = !snapshot.hasCamera && /blocked/i.test(snapshot.cameraStatus);

  // One permission grant, zero clicks after: auto-start the camera whenever
  // this set mounts and the user has granted it before (the browser then
  // reconnects silently). The camera turns itself off between sets because
  // the set component unmounts — exactly the on/off behavior users expect.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const status = await navigator.permissions?.query?.({ name: "camera" as PermissionName });
        if (!cancelled && status?.state === "granted") {
          void startCamera();
          return;
        }
      } catch {
        // Safari: no camera permission query — fall back to our own flag.
      }
      if (!cancelled && window.localStorage.getItem("repmint-cam-ok") === "1") {
        void startCamera();
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Remember a successful grant for browsers without permissions.query.
  useEffect(() => {
    if (snapshot.hasCamera) {
      try {
        window.localStorage.setItem("repmint-cam-ok", "1");
      } catch {
        // storage unavailable — auto-start just won't work next time
      }
    }
  }, [snapshot.hasCamera]);

  const toneClass = snapshot.tone === "adjust" ? "adjust" : snapshot.tone === "good" ? "good" : "idle";
  const depthPct = Math.round(snapshot.depth * 100);
  const liveScore = repScores.length
    ? Math.round(repScores.reduce((s, x) => s + x, 0) / repScores.length)
    : snapshot.quality;
  const fatigue = analyticsRef.current.status;
  const fatigueLabel = FATIGUE_LABEL[fatigue];
  const setupOk = overrideSetup || !snapshot.setup || snapshot.setup.ok;

  // Tempo readout from the latest rep: eccentric-pause-concentric.
  const tempo = lastRep
    ? `${Math.round(lastRep.eccentricSeconds)}:${Math.round(lastRep.pauseSeconds)}:${Math.round(lastRep.concentricSeconds)}`
    : "—";

  // 3-2-1 countdown before every set: time to pick up the dumbbells after
  // triggering the start (by button or by raising a hand).
  const beginCountdown = () => {
    if (active || countdown !== null) return;
    setCountdown(3);
    voiceRef.current?.immediate("Starting in 3, 2, 1");
    const tick = () => {
      setCountdown((c) => {
        if (c === null) return null;
        if (c <= 1) {
          countdownRef.current = null;
          start();
          return null;
        }
        countdownRef.current = window.setTimeout(tick, 1000);
        return c - 1;
      });
    };
    countdownRef.current = window.setTimeout(tick, 1000);
  };

  const cancelCountdown = () => {
    if (countdownRef.current) window.clearTimeout(countdownRef.current);
    countdownRef.current = null;
    setCountdown(null);
  };

  useEffect(() => () => {
    if (countdownRef.current) window.clearTimeout(countdownRef.current);
  }, []);

  // Hands-free start: hold a hand above your head once framing passes.
  useEffect(() => {
    if (!active && countdown === null && setupOk && snapshot.raiseHand) {
      beginCountdown();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot.raiseHand, active, countdown, setupOk]);

  const start = () => {
    setActive(true);
    setRepScores([]);
    repMetricsRef.current = [];
    analyticsRef.current.reset();
    fatigueSpoken.current = false;
    lastRepNumber.current = 0;
    startSet();
    void wake();
    voiceRef.current?.milestone(isHold ? "Hold started." : "Set started. Move with control.");
  };

  const finish = () => {
    const out: SetOutcome = endSet();
    void releaseWake();
    voiceRef.current?.milestone("Set done — nice work. Rest up.");
    // Detach the voice coach so unmount cleanup can't cancel the line above;
    // speechSynthesis is a global queue, so it finishes on its own.
    const peakRom = out.repEvents.length
      ? Math.max(...out.repEvents.map((e) => e.peakDepth))
      : snapshot.depth;
    voiceRef.current = null;
    // Form score: mean per-rep quality when we have it, else tracking quality.
    const formScore =
      tier === 1 ? (repScores.length ? Math.round(repScores.reduce((s, x) => s + x, 0) / repScores.length) : Math.round(snapshot.quality)) : null;
    onComplete({
      reps: isHold ? null : out.reps,
      seconds: out.seconds,
      tut: Math.round(out.tut),
      formScore,
      romScore: tier === 1 ? Math.min(100, Math.round(peakRom * 100)) || null : null,
      cues: out.faults.slice(0, 3).map((f) => f.cue),
      repMetrics: repMetricsRef.current,
    });
  };

  // Camera permission denied → the promised manual mode, not a dead end.
  if (manualFallback) {
    return (
      <ManualSet planned={planned} index={index} total={total} onComplete={onComplete} onQuit={onQuit} />
    );
  }

  return (
    <div className="train-live">
      <div className="train-topbar">
        <button className="btn btn-ghost btn-sm" onClick={onQuit} aria-label="Quit session">
          ✕
        </button>
        <div className="train-progress-label">
          <strong>{movement.name}</strong>
          <small>
            Set {planned.setIndex + 1}/{planned.totalSets} · exercise {index + 1}/{total}
          </small>
        </div>
        <div className="train-topbar-actions">
          <button
            type="button"
            className={`hud-voice-toggle${voiceOn ? " on" : ""}`}
            onClick={() => setVoiceOn((v) => !v)}
            aria-pressed={voiceOn}
            aria-label={voiceOn ? "Mute voice coach" : "Unmute voice coach"}
            title={voiceOn ? "Voice coach on" : "Voice coach muted"}
          >
            {voiceOn ? "🔊" : "🔇"}
          </button>
          <span className={`chip chip-${tier === 1 ? "accent" : "live"}`}>{TIER_INFO[tier].short}</span>
        </div>
      </div>

      <div className="camera-stage train-camera">
        <video
          ref={videoRef}
          className={`camera-video${snapshot.hasCamera ? " active" : ""}${config.mirror ? "" : " no-mirror"}`}
          playsInline
          muted
        />
        <canvas ref={canvasRef} className={`pose-canvas${config.mirror ? "" : " no-mirror"}`} aria-hidden />
        {!snapshot.hasCamera && (
          <div className="camera-empty">
            <strong>Camera preview</strong>
            <span>{snapshot.cameraStatus}</span>
          </div>
        )}

        {/* HUD: one coaching cue in a glass banner at the top */}
        {snapshot.hasCamera && (
          <div className={`hud-cue ${toneClass}`} aria-live="polite">
            <span className="hud-cue-dot" aria-hidden />
            {active ? snapshot.cue || movement.setupCue : countdown !== null ? "Get set…" : setupOk ? "Raise a hand to start — or tap Start set." : snapshot.setup?.issues[0]?.message ?? movement.setupCue}
          </div>
        )}

        {/* HUD: rep ring with live count */}
        {snapshot.hasCamera && active && (
          <div className="hud-repring" aria-live="polite">
            <svg viewBox="0 0 120 120" width="148" height="148" aria-hidden>
              <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(244,247,251,0.14)" strokeWidth="7" />
              <circle
                cx="60"
                cy="60"
                r="52"
                fill="none"
                stroke="var(--accent)"
                strokeWidth="7"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 52}
                strokeDashoffset={
                  2 * Math.PI * 52 *
                  (1 -
                    (isHold
                      ? Math.min(1, snapshot.seconds / Math.max(1, targetSeconds))
                      : targetReps
                        ? Math.min(1, snapshot.reps / targetReps)
                        : 0))
                }
                transform="rotate(-90 60 60)"
                className="hud-ring-sweep"
              />
            </svg>
            <div className="hud-repring-center">
              {isHold ? (
                <strong>{formatClock(snapshot.seconds)}</strong>
              ) : (
                <>
                  <strong key={snapshot.reps} className="hud-rep-pop">
                    {snapshot.reps}
                  </strong>
                  <small>/{targetReps || "—"}</small>
                </>
              )}
              {tier === 1 && <span className="hud-ring-label">{liveScore}% form</span>}
            </div>
          </div>
        )}

        {/* HUD: per-rep quality pips */}
        {active && repScores.length > 0 && (
          <div className="hud-pips" aria-hidden>
            {repScores.slice(-12).map((s, i) => (
              <span key={i} className={s >= 85 ? "great" : s >= 65 ? "ok" : "low"} />
            ))}
          </div>
        )}

        {/* HUD: fatigue signal */}
        {active && fatigueLabel && (
          <div className={`hud-fatigue ${fatigue}`} aria-live="polite">
            {fatigueLabel}
          </div>
        )}

        {/* HUD: glass stat bar */}
        {snapshot.hasCamera && active && (
          <div className="hud-statbar" aria-hidden>
            {!isHold && (
              <div className="hud-stat">
                <span className="hud-stat-label">ROM</span>
                <div className="hud-rom-track">
                  <div className="hud-rom-fill" style={{ width: `${Math.min(100, depthPct)}%` }} />
                  <div className="hud-rom-target" style={{ left: `${Math.round(movement.minRepFraction * 100)}%` }} />
                </div>
                <strong>{depthPct}%</strong>
              </div>
            )}
            <div className="hud-stat">
              <span className="hud-stat-label">Tempo</span>
              <strong className="hud-stat-lime">{tempo}</strong>
            </div>
            <div className="hud-stat">
              <span className="hud-stat-label">Tension</span>
              <strong>
                {snapshot.tut}
                <em>s</em>
              </strong>
            </div>
          </div>
        )}

        {/* Countdown before the set goes live */}
        {countdown !== null && (
          <button type="button" className="hud-countdown" onClick={cancelCountdown} aria-label="Cancel start">
            <strong key={countdown}>{countdown}</strong>
            <small>Get into position — tap to cancel</small>
          </button>
        )}

        {/* Setup gate: framing + privacy, before the set starts */}
        {snapshot.hasCamera && !active && (
          <div className="hud-setup">
            {snapshot.setup && !snapshot.setup.ok && !overrideSetup && (
              <ul className="hud-setup-issues">
                {snapshot.setup.issues.slice(0, 2).map((i) => (
                  <li key={i.code}>{i.message}</li>
                ))}
              </ul>
            )}
            <p className="hud-privacy">
              <span aria-hidden>🔒</span> Pose tracking runs on your device — video is never uploaded or stored.
            </p>
          </div>
        )}
      </div>

      <div className="train-controls">
        {!snapshot.hasCamera && (
          <>
            <Button size="lg" onClick={startCamera}>
              Start camera
            </Button>
            {cameraBlocked && (
              <Button variant="secondary" onClick={() => setManualFallback(true)}>
                Log manually instead
              </Button>
            )}
          </>
        )}
        {snapshot.hasCamera && !active && countdown === null && (
          <>
            <Button size="lg" onClick={beginCountdown} disabled={!setupOk}>
              {isHold ? "Start hold" : "Start set"}
            </Button>
            {!setupOk && (
              <Button variant="ghost" onClick={() => setOverrideSetup(true)}>
                Start anyway
              </Button>
            )}
          </>
        )}
        {active && (
          <>
            {!isHold && (
              <Button variant="secondary" onClick={manualRep}>
                +1 rep
              </Button>
            )}
            <Button onClick={finish}>{isHold ? "End hold" : "End set"}</Button>
            <Button
              variant="ghost"
              onClick={() => {
                resetSet();
                setActive(false);
                setRepScores([]);
                repMetricsRef.current = [];
                analyticsRef.current.reset();
                lastRepNumber.current = 0;
                fatigueSpoken.current = false;
              }}
            >
              Reset
            </Button>
          </>
        )}
        {!active && countdown === null && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => onComplete({ reps: 0, seconds: 0, tut: 0, formScore: null, romScore: null, cues: [], repMetrics: [] })}
          >
            Skip set
          </button>
        )}
      </div>
      {!active && (
        <p className="train-hint">
          {movement.camera}. Target: {isHold ? `${targetSeconds}s hold` : `${targetReps} reps`}.
        </p>
      )}
    </div>
  );
}

/* Manual / timer set for tier-3 exercises (no camera pipeline). */
function ManualSet({
  planned,
  index,
  total,
  onComplete,
  onQuit,
}: {
  planned: PlannedSet;
  index: number;
  total: number;
  onComplete: (o: SetOutcomePayload) => void;
  onQuit: () => void;
}) {
  const meta = planned.meta;
  const isHold = planned.targetSeconds != null;
  const [reps, setReps] = useState(planned.targetReps ?? 10);
  const [seconds] = useState(planned.targetSeconds ?? 40);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => window.clearInterval(id);
  }, [running]);

  const done = () => {
    onComplete({
      reps: isHold ? null : reps,
      seconds: isHold ? (elapsed || seconds) : null,
      tut: isHold ? elapsed || seconds : null,
      formScore: null,
      romScore: null,
      cues: [],
      repMetrics: [],
    });
  };

  return (
    <div className="train-live train-manual">
      <div className="train-topbar">
        <button className="btn btn-ghost btn-sm" onClick={onQuit} aria-label="Quit session">
          ✕
        </button>
        <div className="train-progress-label">
          <strong>{meta.name}</strong>
          <small>
            Set {planned.setIndex + 1}/{planned.totalSets} · exercise {index + 1}/{total}
          </small>
        </div>
        <span className="chip">Manual log</span>
      </div>

      <div className="manual-card card">
        <p className="manual-note">This one is logged by hand — the camera can&apos;t read the load path honestly.</p>
        {isHold ? (
          <div className="manual-timer">
            <strong>{formatClock(running ? elapsed : elapsed || seconds)}</strong>
            {!running ? (
              <Button size="lg" onClick={() => { setElapsed(0); setRunning(true); }}>
                Start timer
              </Button>
            ) : (
              <Button size="lg" onClick={() => setRunning(false)}>
                Stop
              </Button>
            )}
          </div>
        ) : (
          <div className="manual-stepper">
            <label>Reps this set</label>
            <div className="weight-stepper">
              <button className="stepper-btn" onClick={() => setReps((r) => Math.max(0, r - 1))} aria-label="Fewer reps">−</button>
              <div className="weight-value">
                <input type="number" inputMode="numeric" value={reps} min={0} onChange={(e) => setReps(Math.max(0, Number(e.target.value) || 0))} aria-label="Reps" />
              </div>
              <button className="stepper-btn" onClick={() => setReps((r) => r + 1)} aria-label="More reps">+</button>
            </div>
          </div>
        )}
      </div>

      <div className="train-controls">
        <Button size="lg" onClick={done}>
          Log set
        </Button>
      </div>
    </div>
  );
}

export default function TrainPage() {
  return (
    <Suspense fallback={<Spinner label="Loading…" />}>
      <TrainInner />
    </Suspense>
  );
}
