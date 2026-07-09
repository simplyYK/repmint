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
import { WorkoutBuilder } from "./WorkoutBuilder";
import "./workouts.css";

const TRAINING_TABS = [
  { href: "/workouts", label: "My workouts" },
  { href: "/plan", label: "AI plan" },
];

type ViewMode =
  | { kind: "list" }
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

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const [tpls, prof] = await Promise.all([
        listTemplates(),
        getProfile().catch(() => null),
      ]);
      setTemplates(tpls);
      const u = (prof as { units?: "kg" | "lb" } | null)?.units;
      if (u === "kg" || u === "lb") setUnits(u);
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

  const mine = useMemo(() => templates.filter((t) => t.source === "user"), [templates]);
  const curated = useMemo(
    () => templates.filter((t) => t.source === "system" || t.source === "ai"),
    [templates],
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

  const openBuilder = () => setView({ kind: "build", editing: null });

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
                <img src="/images/athletes/focus.jpg" alt="" className="wk-resume-img" />
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

function TemplateCard({
  template,
  owned,
  pendingDelete,
  duplicating,
  onEdit,
  onAskDelete,
  onCancelDelete,
  onConfirmDelete,
  onDuplicate,
}: {
  template: TemplateWithExercises;
  owned: boolean;
  pendingDelete?: boolean;
  duplicating?: boolean;
  onEdit?: () => void;
  onAskDelete?: () => void;
  onCancelDelete?: () => void;
  onConfirmDelete?: () => void;
  onDuplicate?: () => void;
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
          {template.description && <small>{template.description}</small>}
        </div>
        {!owned && <Chip tone="accent">{sourceLabel}</Chip>}
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
              <Button size="sm" variant="ghost" onClick={onAskDelete}>
                Delete
              </Button>
            </>
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
