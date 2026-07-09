"use client";

// /train — the flagship live camera coach + workout runner.
//
// Flow: load a template (?template=id[&day=id]) or start ad-hoc → step through
// planned sets → per set: live camera coaching (tier 1/2) or manual/timer
// logging (tier 3) → weight quick-log → rest timer → next set → session summary
// → saveSession (lands in the calendar) → history / ask coach.
//
// Reuses usePoseTracker as-is (no tracking rewrite). Works portrait + landscape,
// requests a wake lock while a set is live.

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { usePoseTracker, type SetOutcome } from "../../hooks/usePoseTracker";
import { useWakeLock } from "../../hooks/useWakeLock";
import { getTemplate, getProfile, saveSession, type TemplateWithExercises } from "../../lib/db";
import { getMovementForSlug, getMeta, TIER_INFO } from "../../lib/library";
import { configFromProfile, DEFAULT_PROFILE } from "../../lib/types";
import type { MovementDef } from "../../lib/movements/types";
import { Spinner, Button } from "../../components/ui/primitives";
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
import { formatClock } from "../../lib/format";
import { SessionSummary } from "./SessionSummary";

type Stage = "config" | "coach" | "log" | "rest" | "summary";

function TrainInner() {
  const router = useRouter();
  const params = useSearchParams();
  const templateId = params.get("template");
  const slugParam = params.get("slug");
  const planDayId = params.get("day");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [template, setTemplate] = useState<TemplateWithExercises | null>(null);
  const [planned, setPlanned] = useState<PlannedSet[]>([]);
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
  }, [templateId, slugParam]);

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

  const current = planned[index];
  const exGroups = useMemo(() => groupByExercise(planned), [planned]);

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
      repMetrics: [],
    };
    if (!logWeight.bodyweight && logWeight.weight) writeLastWeight(current.exerciseSlug, logWeight.weight);
    setCompleted((c) => [...c, completedSet]);
    setPendingOutcome(null);

    const isLast = index >= planned.length - 1;
    if (isLast) {
      setStage("summary");
    } else {
      setStage("rest");
    }
  };

  const goNextSet = () => {
    setIndex((i) => Math.min(i + 1, planned.length - 1));
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
      return <AdHocPicker onPick={(slug) => router.replace(`/train?slug=${slug}`)} />;
    }
    return (
      <div className="train-config">
        <p className="eyebrow">Ready to train</p>
        <h1>{template?.title ?? current?.meta.name ?? "Quick session"}</h1>
        <p className="train-config-sub">
          {exGroups.length} exercise{exGroups.length === 1 ? "" : "s"} · {planned.length} sets. RepMint coaches the
          camera-trackable moves and logs the rest.
        </p>
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
            Start session
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
    const next = planned[Math.min(index + 1, planned.length - 1)];
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
            {index >= planned.length - 1 ? "Finish & review" : "Log set"}
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
        total={planned.length}
        onComplete={handleSetComplete}
        onQuit={finishEarly}
      />
    );
  }

  return <Spinner label="Loading…" />;
}

/* ------------------------------------------------------------------ */
/* Live coach for a single set                                         */
/* ------------------------------------------------------------------ */

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
  onComplete: (o: {
    reps: number | null;
    seconds: number | null;
    tut: number | null;
    formScore: number | null;
    romScore: number | null;
    cues: string[];
  }) => void;
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
  onComplete: (o: {
    reps: number | null;
    seconds: number | null;
    tut: number | null;
    formScore: number | null;
    romScore: number | null;
    cues: string[];
  }) => void;
  onQuit: () => void;
}) {
  const { videoRef, canvasRef, snapshot, startCamera, startSet, endSet, resetSet, manualRep } = usePoseTracker(
    movement,
    config,
  );
  const [active, setActive] = useState(false);
  const isHold = movement.mode === "hold";
  const targetReps = planned.targetReps ?? movement.target.reps ?? 0;
  const targetSeconds = planned.targetSeconds ?? movement.target.seconds ?? 40;
  const tier = planned.meta.tier;

  const toneClass = snapshot.tone === "adjust" ? "adjust" : snapshot.tone === "good" ? "good" : "idle";
  const depthPct = Math.round(snapshot.depth * 100);
  const formPct = snapshot.quality; // pose quality as the live form % readout (tier 1)

  const start = () => {
    setActive(true);
    startSet();
    void wake();
  };

  const finish = () => {
    const out: SetOutcome = endSet();
    void releaseWake();
    // Derive a simple form score from tracking quality; ROM from achieved depth.
    const formScore = tier === 1 ? Math.round(snapshot.quality) : null;
    onComplete({
      reps: isHold ? null : out.reps,
      seconds: isHold ? out.seconds : out.seconds,
      tut: Math.round(out.tut),
      formScore,
      romScore: tier === 1 ? Math.min(100, Math.round(snapshot.depth * 100)) || null : null,
      cues: out.faults.slice(0, 3).map((f) => f.cue),
    });
  };

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
        <span className={`chip chip-${tier === 1 ? "accent" : "live"}`}>{TIER_INFO[tier].short}</span>
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
        <div className="stage-badges">
          <span>{snapshot.cameraStatus}</span>
          {snapshot.running && <span>Pose {snapshot.quality}%</span>}
        </div>

        {/* Big rep counter */}
        <div className="train-repcount" aria-live="polite">
          {isHold ? (
            <strong>{formatClock(snapshot.seconds)}</strong>
          ) : (
            <strong>
              {snapshot.reps}
              <em>/{targetReps || "—"}</em>
            </strong>
          )}
        </div>

        {/* Form ring (tier 1 only) */}
        {tier === 1 && snapshot.running && (
          <div className="train-formring" aria-hidden>
            <svg viewBox="0 0 60 60" width="72" height="72">
              <circle cx="30" cy="30" r="25" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="5" />
              <circle
                cx="30"
                cy="30"
                r="25"
                fill="none"
                stroke="var(--accent)"
                strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 25}
                strokeDashoffset={2 * Math.PI * 25 * (1 - formPct / 100)}
                transform="rotate(-90 30 30)"
              />
              <text x="30" y="34" textAnchor="middle" fontSize="14" fontFamily="var(--font-mono)" fontWeight="800" fill="var(--text)">
                {formPct}%
              </text>
            </svg>
            <small>Form</small>
          </div>
        )}

        {/* Depth / ROM bar */}
        {snapshot.running && !isHold && (
          <div className="depth-meter train-depth" aria-hidden>
            <div className="depth-fill" style={{ width: `${Math.min(100, depthPct)}%` }} />
            <div className="depth-target" style={{ left: `${Math.round(movement.minRepFraction * 100)}%` }} />
            <span className="depth-label">ROM {depthPct}%</span>
          </div>
        )}

        {/* TUT + tempo readout */}
        {snapshot.running && (
          <div className="train-readouts" aria-hidden>
            <span>TUT {snapshot.tut}s</span>
            <span>{isHold ? (snapshot.holdValid ? "Holding" : "Find the line") : snapshot.motion}</span>
          </div>
        )}

        {/* One live cue */}
        <div className={`live-cue ${toneClass}`} aria-live="polite">
          {snapshot.cue || movement.setupCue}
        </div>
      </div>

      <div className="train-controls">
        {!snapshot.hasCamera && (
          <Button size="lg" onClick={startCamera}>
            Start camera
          </Button>
        )}
        {snapshot.hasCamera && !active && (
          <Button size="lg" onClick={start}>
            {isHold ? "Start hold" : "Start set"}
          </Button>
        )}
        {active && (
          <>
            {!isHold && (
              <Button variant="secondary" onClick={manualRep}>
                +1 rep
              </Button>
            )}
            <Button onClick={finish}>{isHold ? "End hold" : "End set"}</Button>
            <Button variant="ghost" onClick={resetSet}>
              Reset
            </Button>
          </>
        )}
        {!active && (
          <button className="btn btn-ghost btn-sm" onClick={() => onComplete({ reps: 0, seconds: 0, tut: 0, formScore: null, romScore: null, cues: [] })}>
            Skip set
          </button>
        )}
      </div>
      <p className="train-hint">{movement.camera}. Target: {isHold ? `${targetSeconds}s hold` : `${targetReps} reps`}.</p>
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
  onComplete: (o: {
    reps: number | null;
    seconds: number | null;
    tut: number | null;
    formScore: number | null;
    romScore: number | null;
    cues: string[];
  }) => void;
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
            <strong>{formatClock(running ? elapsed : seconds)}</strong>
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

/* Ad-hoc: no template or slug given — let the user pick from a short list. */
function AdHocPicker({ onPick }: { onPick: (slug: string) => void }) {
  const quick = ["squat", "strict_push_up", "bicep_curl", "front_plank", "reverse_lunge", "bent_over_row"];
  const items = quick.map((s) => getMeta(s)).filter(Boolean);
  return (
    <div className="train-config">
      <p className="eyebrow">Quick set</p>
      <h1>What are you training?</h1>
      <p className="train-config-sub">Pick a movement to start an ad-hoc set, or open the full library.</p>
      <div className="grid-auto">
        {items.map(
          (m) =>
            m && (
              <button key={m.slug} className="adhoc-pick" onClick={() => onPick(m.slug)}>
                <strong>{m.name}</strong>
                <small>{TIER_INFO[m.tier].short}</small>
              </button>
            ),
        )}
      </div>
      <Link href="/exercises" className="btn btn-secondary btn-md">
        Full exercise library
      </Link>
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
