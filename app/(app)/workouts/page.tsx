"use client";

// /workouts — the workout library + builder. Lists the user's own templates
// and the system/AI ones, and hosts the inline builder for creating or editing
// a template. Degrades gracefully when there's nothing saved yet: three
// ready-made starter cards so nobody faces a blank builder.

import { useEffect, useMemo, useState } from "react";
import {
  PageHeader,
  Card,
  Button,
  LinkButton,
  Chip,
  Spinner,
  InlineNotice,
  SectionTitle,
  SectionTabs,
  Reveal,
} from "../../components/ui/primitives";
import { MovementGlyph } from "../../components/visuals";
import { glyphCategory, getMeta, equipmentLabel } from "../../lib/library";
import {
  listTemplates,
  listSessions,
  deleteTemplate,
  saveTemplate,
  getTemplate,
  getProfile,
  type TemplateWithExercises,
} from "../../lib/db";
import type { DbSession } from "../../lib/types";
import { generateWorkout } from "../../lib/ai";
import { setTemplatePublic, saveSharedTemplate, fetchOwnerProfiles } from "../../lib/social";
import { WorkoutBuilder } from "./WorkoutBuilder";
import { athleteImageFor } from "../../lib/athleteImage";
import "./workouts.css";

const TRAINING_TABS = [
  { href: "/workouts", label: "My workouts" },
  { href: "/plan", label: "AI plan" },
];

type ViewMode =
  | { kind: "list" }
  | { kind: "choose" }
  | { kind: "ai" }
  | { kind: "build"; editing: TemplateWithExercises | null };

type ResumeInfo = { session: DbSession; template: TemplateWithExercises };

// ---------------------------------------------------------------------------
// Template metadata helpers (duration, equipment, focus tag, filters)
// ---------------------------------------------------------------------------

/** Union of the template's exercise equipment, minus bodyweight. */
function templateEquipment(t: TemplateWithExercises): string[] {
  const set = new Set<string>();
  for (const ex of t.exercises) {
    for (const eq of getMeta(ex.exercise_slug)?.equipment ?? []) set.add(eq);
  }
  set.delete("bodyweight");
  return [...set];
}

function equipmentSummary(t: TemplateWithExercises): string {
  const items = templateEquipment(t);
  if (items.length === 0) return "no equipment";
  const labels = items.slice(0, 2).map((eq) => equipmentLabel(eq).toLowerCase());
  return items.length > 2 ? `${labels.join(", ")} +${items.length - 2}` : labels.join(", ");
}

/** est_duration_min if set, otherwise a work+rest estimate rounded to 5 min. */
function estimateMinutes(t: TemplateWithExercises): number {
  if (t.est_duration_min) return t.est_duration_min;
  let seconds = 0;
  for (const ex of t.exercises) {
    const work = ex.target_seconds ?? (ex.target_reps ?? 10) * 3;
    seconds += ex.sets * (work + (ex.rest_seconds ?? 60));
  }
  return Math.max(5, Math.round(seconds / 60 / 5) * 5);
}

const CATEGORY_LABEL: Record<string, string> = {
  legs: "Legs",
  hinge: "Hinge",
  push: "Push",
  pull: "Pull",
  core: "Core",
  shoulders: "Shoulders",
  arms: "Arms",
  mobility: "Mobility",
  machines: "Machines",
  conditioning: "Conditioning",
};

/** template.goal if set, otherwise a category derived from the first exercise. */
function focusTag(t: TemplateWithExercises): string | null {
  if (t.goal) return t.goal[0].toUpperCase() + t.goal.slice(1);
  const first = t.exercises[0];
  if (!first) return null;
  const meta = getMeta(first.exercise_slug);
  if (!meta) return null;
  return CATEGORY_LABEL[glyphCategory(meta)] ?? null;
}

const GYM_EQUIPMENT = new Set(["barbell", "machine", "cable", "bench"]);

type FilterKey = "all" | "short" | "medium" | "noequip" | "gym";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "short", label: "≤20 min" },
  { key: "medium", label: "≤40 min" },
  { key: "noequip", label: "No equipment" },
  { key: "gym", label: "Gym" },
];

function matchesFilter(t: TemplateWithExercises, filter: FilterKey): boolean {
  switch (filter) {
    case "all":
      return true;
    case "short":
      return estimateMinutes(t) <= 20;
    case "medium":
      return estimateMinutes(t) <= 40;
    case "noequip":
      return templateEquipment(t).length === 0;
    case "gym":
      return templateEquipment(t).some((eq) => GYM_EQUIPMENT.has(eq));
  }
}

function daysAgoLabel(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

/** Most recent completed session that maps to a template we can restart. */
async function findResume(tpls: TemplateWithExercises[]): Promise<ResumeInfo | null> {
  const byId = new Map(tpls.map((t) => [t.id, t]));
  if (byId.size === 0) return null;
  const now = new Date();
  for (let back = 0; back < 3; back++) {
    const month = new Date(now.getFullYear(), now.getMonth() - back, 1);
    const sessions = await listSessions(month);
    const hit = sessions.find(
      (s) => s.status === "completed" && s.template_id && byId.has(s.template_id),
    );
    if (hit && hit.template_id) return { session: hit, template: byId.get(hit.template_id)! };
  }
  return null;
}

// Static fallback starters, shown only when the DB has zero templates. If
// system templates with these names exist, they arrive via listTemplates and
// render as normal cards instead.
const STARTERS = [
  {
    key: "room",
    title: "Room Workout",
    minutes: 20,
    equipment: "no equipment",
    image: "/images/athletes/home-training.jpg",
    blurb: "A quiet, room-friendly full-body session. No gear, no noise, no guesswork.",
  },
  {
    key: "gym",
    title: "Gym Starter",
    minutes: 40,
    equipment: "full gym",
    image: "/images/athletes/squat-rack.jpg",
    blurb: "Your first guided gym session — the essential lifts, one at a time.",
  },
  {
    key: "minimum",
    title: "15-min Minimum",
    minutes: 15,
    equipment: "no equipment",
    image: "/images/athletes/pushup.jpg",
    blurb: "The shortest session that still counts. Protect the streak on busy days.",
  },
];

export default function WorkoutsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<TemplateWithExercises[]>([]);
  const [resume, setResume] = useState<ResumeInfo | null>(null);
  const [units, setUnits] = useState<"kg" | "lb">("kg");
  const [view, setView] = useState<ViewMode>({ kind: "list" });
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [duplicating, setDuplicating] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [justCreated, setJustCreated] = useState<string | null>(null);
  const [meId, setMeId] = useState<string | null>(null);
  const [owners, setOwners] = useState<Map<string, { username: string | null; display_name: string | null }>>(new Map());
  const [savingShared, setSavingShared] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const [tpls, prof] = await Promise.all([
        listTemplates(),
        getProfile().catch(() => null),
      ]);
      setTemplates(tpls);
      const p = prof as { id?: string; units?: "kg" | "lb" } | null;
      if (p?.id) setMeId(p.id);
      if (p?.units === "kg" || p?.units === "lb") setUnits(p.units);
      // Attribution for friends' shared workouts in the list.
      const friendOwnerIds = tpls
        .filter((t) => t.owner_id && p?.id && t.owner_id !== p.id)
        .map((t) => t.owner_id as string);
      setOwners(await fetchOwnerProfiles(friendOwnerIds).catch(() => new Map()));
      setResume(await findResume(tpls).catch(() => null));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load your workouts.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  // Ownership-scoped sections. A friend's shared workout is visible via RLS
  // but is NOT mine — it gets its own "Friends are sharing" section with a
  // Save action instead of Edit/Delete.
  const mine = useMemo(
    () => templates.filter((t) => t.source === "user" && (!meId || t.owner_id === meId) && !t.saved_from_username),
    [templates, meId],
  );
  const savedFromFriends = useMemo(
    () => templates.filter((t) => (!meId || t.owner_id === meId) && Boolean(t.saved_from_username)),
    [templates, meId],
  );
  const friendShared = useMemo(
    () => (meId ? templates.filter((t) => t.owner_id && t.owner_id !== meId) : []),
    [templates, meId],
  );
  const curated = useMemo(
    () =>
      templates.filter(
        (t) =>
          (t.source === "system" || t.source === "ai") &&
          (t.owner_id === null || !meId || t.owner_id === meId) &&
          !t.saved_from_username,
      ),
    [templates, meId],
  );
  const filteredMine = useMemo(() => mine.filter((t) => matchesFilter(t, filter)), [mine, filter]);
  const filteredCurated = useMemo(
    () => curated.filter((t) => matchesFilter(t, filter)),
    [curated, filter],
  );

  async function handleDelete(id: string) {
    try {
      await deleteTemplate(id);
      setPendingDelete(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete this workout.");
      setPendingDelete(null);
    }
  }

  /** Toggle a template's community visibility (accepted friends only). */
  async function handleShareToggle(t: TemplateWithExercises) {
    setError(null);
    try {
      await setTemplatePublic(t.id, !t.is_public);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update sharing for this workout.");
    }
  }

  /** Copy a friend's shared workout into my library. */
  async function handleSaveShared(t: TemplateWithExercises) {
    setError(null);
    setSavingShared(t.id);
    try {
      await saveSharedTemplate(t.id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save that workout.");
    } finally {
      setSavingShared(null);
    }
  }

  /** Clone a system/AI template into a user-owned copy, then open the builder on it. */
  async function handleDuplicate(t: TemplateWithExercises) {
    setError(null);
    setDuplicating(t.id);
    try {
      const newId = await saveTemplate({
        title: `${t.title} (copy)`,
        description: t.description,
        goal: t.goal,
        estDurationMin: t.est_duration_min,
        exercises: t.exercises.map((ex, i) => ({
          exerciseSlug: ex.exercise_slug,
          position: i,
          sets: ex.sets,
          targetReps: ex.target_reps,
          targetSeconds: ex.target_seconds,
          targetWeight: ex.target_weight,
          restSeconds: ex.rest_seconds,
          supersetGroup: ex.superset_group,
          notes: ex.notes,
        })),
      });
      const created = await getTemplate(newId);
      if (created) {
        setView({ kind: "build", editing: created });
      } else {
        await refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not duplicate this workout.");
    } finally {
      setDuplicating(null);
    }
  }

  if (view.kind === "build") {
    return (
      <WorkoutBuilder
        editing={view.editing}
        units={units}
        onSaved={() => {
          setView({ kind: "list" });
          void refresh();
        }}
        onCancel={() => setView({ kind: "list" })}
      />
    );
  }

  if (view.kind === "choose") {
    return (
      <CreateChooser
        onManual={() => setView({ kind: "build", editing: null })}
        onAi={() => setView({ kind: "ai" })}
        onCancel={() => setView({ kind: "list" })}
      />
    );
  }

  if (view.kind === "ai") {
    return (
      <AiWorkoutForm
        onDone={(title) => {
          setView({ kind: "list" });
          setJustCreated(title);
          void refresh();
        }}
        onBack={() => setView({ kind: "choose" })}
      />
    );
  }

  const openBuilder = () => setView({ kind: "choose" });

  return (
    <div className="stack">
      <SectionTabs tabs={TRAINING_TABS} label="Workouts section" />
      <PageHeader
        eyebrow="Your training library"
        title="Workouts"
        subtitle="Build your own routines or start from a ready-made one."
        actions={<Button onClick={openBuilder}>Create workout</Button>}
      />

      {error && <InlineNotice tone="danger">{error}</InlineNotice>}
      {justCreated && (
        <InlineNotice tone="info">
          “{justCreated}” is ready — it&apos;s in your library under System &amp; AI. Your weekly plan is untouched.
        </InlineNotice>
      )}

      {loading ? (
        <Spinner label="Loading your workouts…" />
      ) : templates.length === 0 ? (
        <Reveal>
          <section className="wk-starters">
            <SectionTitle>Start with a ready-made session</SectionTitle>
            <p className="wk-starters-sub">
              No blank pages here — pick one and press start.
            </p>
            <div className="wk-starter-grid">
              {STARTERS.map((s) => (
                <article key={s.key} className="wk-starter">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.image} alt="" className="wk-starter-img" />
                  <div className="wk-starter-overlay" aria-hidden />
                  <div className="wk-starter-body">
                    <span className="wk-starter-tag">
                      ~{s.minutes} min · {s.equipment}
                    </span>
                    <h3>{s.title}</h3>
                    <p>{s.blurb}</p>
                    <LinkButton href={`/train?starter=${s.key}`} full>
                      Start now
                    </LinkButton>
                  </div>
                </article>
              ))}
            </div>
            <div className="wk-starters-foot">
              <Button variant="ghost" onClick={openBuilder}>
                Build your own
              </Button>
            </div>
          </section>
        </Reveal>
      ) : (
        <>
          {resume && (
            <Reveal>
              <section className="wk-resume" aria-label="Jump back in">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={athleteImageFor(resume.template.title, resume.template.description, resume.template.goal)} alt="" className="wk-resume-img" />
                <div className="wk-resume-overlay" aria-hidden />
                <div className="wk-resume-body">
                  <p className="eyebrow">Jump back in</p>
                  <h2>{resume.template.title}</h2>
                  <p className="wk-resume-meta">
                    Last done {daysAgoLabel(resume.session.started_at)} ·{" "}
                    {resume.template.exercises.length} exercise
                    {resume.template.exercises.length === 1 ? "" : "s"} · ~
                    {estimateMinutes(resume.template)} min
                  </p>
                  <LinkButton href={`/train?template=${resume.template.id}`} size="lg" full>
                    Start
                  </LinkButton>
                </div>
              </section>
            </Reveal>
          )}

          <Reveal delay={0.05}>
            <div className="wk-filters" role="group" aria-label="Filter workouts">
              {FILTERS.map((f) => (
                <Chip key={f.key} active={filter === f.key} onClick={() => setFilter(f.key)}>
                  {f.label}
                </Chip>
              ))}
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <section>
              <SectionTitle
                action={
                  <Button size="sm" variant="secondary" onClick={openBuilder}>
                    New
                  </Button>
                }
              >
                My workouts
              </SectionTitle>
              {mine.length === 0 ? (
                <Card className="wk-inline-empty">
                  <p>You haven’t built any workouts yet.</p>
                  <Button size="sm" onClick={openBuilder}>
                    Create workout
                  </Button>
                </Card>
              ) : filteredMine.length === 0 ? (
                <p className="wk-filter-empty">No workouts of yours match this filter.</p>
              ) : (
                <div className="wk-grid">
                  {filteredMine.map((t) => (
                    <TemplateCard
                      key={t.id}
                      template={t}
                      owned
                      pendingDelete={pendingDelete === t.id}
                      onEdit={() => setView({ kind: "build", editing: t })}
                      onAskDelete={() => setPendingDelete(t.id)}
                      onCancelDelete={() => setPendingDelete(null)}
                      onConfirmDelete={() => handleDelete(t.id)}
                      onShareToggle={() => handleShareToggle(t)}
                    />
                  ))}
                  <button type="button" className="wk-create-card" onClick={openBuilder}>
                    <span className="wk-create-plus" aria-hidden>
                      +
                    </span>
                    <span>Create new workout</span>
                  </button>
                </div>
              )}
            </section>
          </Reveal>

          {savedFromFriends.length > 0 && (
            <Reveal delay={0.11}>
              <section>
                <SectionTitle>Saved from friends</SectionTitle>
                <div className="wk-grid">
                  {savedFromFriends.map((t) => (
                    <TemplateCard
                      key={t.id}
                      template={t}
                      owned
                      attribution={t.saved_from_username ? `from @${t.saved_from_username}` : null}
                      pendingDelete={pendingDelete === t.id}
                      onEdit={() => setView({ kind: "build", editing: t })}
                      onAskDelete={() => setPendingDelete(t.id)}
                      onCancelDelete={() => setPendingDelete(null)}
                      onConfirmDelete={() => handleDelete(t.id)}
                      onShareToggle={() => handleShareToggle(t)}
                    />
                  ))}
                </div>
              </section>
            </Reveal>
          )}

          {friendShared.length > 0 && (
            <Reveal delay={0.12}>
              <section>
                <SectionTitle>Friends are sharing</SectionTitle>
                <div className="wk-grid">
                  {friendShared.map((t) => {
                    const owner = t.owner_id ? owners.get(t.owner_id) : undefined;
                    const who = owner?.username ? `@${owner.username}` : owner?.display_name || "a friend";
                    return (
                      <TemplateCard
                        key={t.id}
                        template={t}
                        owned={false}
                        attribution={`shared by ${who}`}
                        saving={savingShared === t.id}
                        onSave={() => handleSaveShared(t)}
                      />
                    );
                  })}
                </div>
              </section>
            </Reveal>
          )}

          {curated.length > 0 && (
            <Reveal delay={0.12}>
              <section>
                <SectionTitle>System &amp; AI</SectionTitle>
                {filteredCurated.length === 0 ? (
                  <p className="wk-filter-empty">No ready-made workouts match this filter.</p>
                ) : (
                  <div className="wk-grid">
                    {filteredCurated.map((t) => (
                      <TemplateCard
                        key={t.id}
                        template={t}
                        owned={false}
                        duplicating={duplicating === t.id}
                        onDuplicate={() => handleDuplicate(t)}
                      />
                    ))}
                  </div>
                )}
              </section>
            </Reveal>
          )}
        </>
      )}

      {!loading && (
        <Button className="wk-fab" onClick={openBuilder} aria-label="Create new workout">
          + Create new
        </Button>
      )}
    </div>
  );
}

/** Step 1 of Create workout: build by hand, or let the AI build today's session. */
function CreateChooser({
  onManual,
  onAi,
  onCancel,
}: {
  onManual: () => void;
  onAi: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="stack">
      <PageHeader
        eyebrow="New workout"
        title="How do you want to build it?"
        actions={
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        }
      />
      <div className="wk-grid">
        <button type="button" className="wk-choose-card" onClick={onAi}>
          <span className="wk-choose-icon" aria-hidden>
            ✦
          </span>
          <strong>Ask your AI coach</strong>
          <p>
            Tell it what you want to hit today — it builds the session and saves it to your library.
            Your weekly plan stays exactly as it is.
          </p>
        </button>
        <button type="button" className="wk-choose-card" onClick={onManual}>
          <span className="wk-choose-icon" aria-hidden>
            ⚒
          </span>
          <strong>Build it myself</strong>
          <p>Pick exercises, sets, reps, and rest by hand in the full builder.</p>
        </button>
      </div>
    </div>
  );
}

/** Step 2 (AI path): one focus prompt + session length → generate & save. */
function AiWorkoutForm({ onDone, onBack }: { onDone: (title: string) => void; onBack: () => void }) {
  const [focus, setFocus] = useState("");
  const [minutes, setMinutes] = useState(40);
  const [trackedOnly, setTrackedOnly] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      // Profile fills in goal/level/equipment so the form stays one question.
      const prof = (await getProfile().catch(() => null)) as {
        goal?: string | null;
        experience_level?: string;
        equipment?: string[];
      } | null;
      const res = await generateWorkout({
        focus: focus.trim() || "coach's choice",
        goal: prof?.goal ?? undefined,
        level: prof?.experience_level ?? undefined,
        equipment: prof?.equipment?.length ? prof.equipment : undefined,
        sessionMinutes: minutes,
        trackedOnly,
      });
      if ("error" in res) {
        setError(res.error);
        return;
      }
      onDone(res.title);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <PageHeader
        eyebrow="New workout · AI"
        title="What do you want to hit today?"
        subtitle="One session, built for today — your weekly plan is not touched."
        actions={
          <Button variant="ghost" onClick={onBack} disabled={busy}>
            Back
          </Button>
        }
      />

      <Card className="wk-ai-form">
        <label className="field">
          <span>Today&apos;s focus</span>
          <textarea
            value={focus}
            onChange={(e) => setFocus(e.target.value)}
            placeholder="e.g. Chest and triceps, feeling fresh — or: quick full-body, knees are cranky, nothing jumpy"
            rows={3}
            maxLength={400}
            disabled={busy}
          />
        </label>

        <div className="field">
          <span>Session length</span>
          <div className="slider-wrap">
            <input
              type="range"
              min={10}
              max={90}
              step={5}
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value))}
              aria-label="Session length in minutes"
              disabled={busy}
            />
            <span className="slider-value">{minutes} min</span>
          </div>
        </div>

        <label className="field wk-ai-tracked">
          <input
            type="checkbox"
            checked={trackedOnly}
            onChange={(e) => setTrackedOnly(e.target.checked)}
            disabled={busy}
          />
          <span>Camera-tracked exercises only</span>
        </label>

        {error && <InlineNotice tone="danger">{error}</InlineNotice>}

        <div className="row-wrap" style={{ marginTop: 12 }}>
          <Button onClick={generate} disabled={busy}>
            {busy ? "Building your workout…" : "Build my workout"}
          </Button>
        </div>
        {busy && <Spinner label="Your coach is picking exercises…" />}
      </Card>
    </div>
  );
}

function TemplateCard({
  template,
  owned,
  attribution,
  pendingDelete,
  duplicating,
  saving,
  onEdit,
  onAskDelete,
  onCancelDelete,
  onConfirmDelete,
  onDuplicate,
  onShareToggle,
  onSave,
}: {
  template: TemplateWithExercises;
  owned: boolean;
  /** Small provenance line: "from @user" (saved copy) / "shared by @user". */
  attribution?: string | null;
  pendingDelete?: boolean;
  duplicating?: boolean;
  saving?: boolean;
  onEdit?: () => void;
  onAskDelete?: () => void;
  onCancelDelete?: () => void;
  onConfirmDelete?: () => void;
  onDuplicate?: () => void;
  onShareToggle?: () => void;
  onSave?: () => void;
}) {
  const count = template.exercises.length;
  // Use the first exercise's category to pick a representative glyph.
  const firstMeta = count > 0 ? getMeta(template.exercises[0].exercise_slug) : undefined;
  const category = firstMeta ? glyphCategory(firstMeta) : "conditioning";
  const sourceLabel = template.source === "ai" ? "AI" : "System";
  const focus = focusTag(template);

  return (
    <Card className="wk-card">
      <div className="wk-card-top">
        <div className="wk-card-glyph">
          <MovementGlyph category={category} />
        </div>
        <div className="wk-card-title">
          <strong>{template.title}</strong>
          {attribution && <small className="wk-attribution">{attribution}</small>}
          {template.description && <small>{template.description}</small>}
        </div>
        {!owned && !onSave && <Chip tone="accent">{sourceLabel}</Chip>}
        {owned && template.is_public && <Chip tone="accent">Shared</Chip>}
      </div>

      <div className="wk-card-badges">
        <span className="wk-badge">~{estimateMinutes(template)} min</span>
        <span className="wk-badge">{equipmentSummary(template)}</span>
        <span className="wk-badge">
          {count} exercise{count === 1 ? "" : "s"}
        </span>
        {focus && <span className="wk-focus-chip">{focus}</span>}
      </div>

      {pendingDelete ? (
        <div className="wk-card-actions wk-confirm">
          <span className="wk-confirm-text">Delete this workout?</span>
          <div className="row-wrap">
            <Button size="sm" variant="ghost" onClick={onCancelDelete}>
              Keep
            </Button>
            <Button size="sm" variant="danger" onClick={onConfirmDelete}>
              Delete
            </Button>
          </div>
        </div>
      ) : (
        <div className="wk-card-actions">
          <LinkButton href={`/train?template=${template.id}`} size="sm">
            Start
          </LinkButton>
          {owned && (
            <>
              <Button size="sm" variant="secondary" onClick={onEdit}>
                Edit
              </Button>
              {onShareToggle && (
                <Button size="sm" variant="ghost" onClick={onShareToggle}>
                  {template.is_public ? "Stop sharing" : "Share with friends"}
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={onAskDelete}>
                Delete
              </Button>
            </>
          )}
          {!owned && onSave && (
            <Button size="sm" variant="secondary" onClick={onSave} disabled={saving}>
              {saving ? "Saving…" : "Save to my workouts"}
            </Button>
          )}
          {!owned && onDuplicate && (
            <Button size="sm" variant="secondary" onClick={onDuplicate} disabled={duplicating}>
              {duplicating ? "Duplicating…" : "Duplicate & edit"}
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}
