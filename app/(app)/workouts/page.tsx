"use client";

// /workouts — the workout library + builder. Lists the user's own templates
// and the system/AI ones, and hosts the inline builder for creating or editing
// a template. Degrades gracefully when there's nothing saved yet.

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
} from "../../components/ui/primitives";
import { MovementGlyph, EmptyState } from "../../components/visuals";
import { glyphCategory, getMeta } from "../../lib/library";
import {
  listTemplates,
  deleteTemplate,
  getProfile,
  type TemplateWithExercises,
} from "../../lib/db";
import { WorkoutBuilder } from "./WorkoutBuilder";
import "./workouts.css";

type ViewMode =
  | { kind: "list" }
  | { kind: "build"; editing: TemplateWithExercises | null };

export default function WorkoutsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<TemplateWithExercises[]>([]);
  const [units, setUnits] = useState<"kg" | "lb">("kg");
  const [view, setView] = useState<ViewMode>({ kind: "list" });
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

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

  return (
    <div className="stack">
      <PageHeader
        eyebrow="Your training library"
        title="Workouts"
        subtitle="Build your own routines or start from a ready-made one."
        actions={
          <Button onClick={() => setView({ kind: "build", editing: null })}>
            Create workout
          </Button>
        }
      />

      {error && <InlineNotice tone="danger">{error}</InlineNotice>}

      {loading ? (
        <Spinner label="Loading your workouts…" />
      ) : templates.length === 0 ? (
        <Card className="wk-empty">
          <EmptyState name="workouts" className="wk-empty-art" />
          <h2>No workouts yet</h2>
          <p>Build your first routine — add exercises, sets and targets, then start training.</p>
          <Button onClick={() => setView({ kind: "build", editing: null })}>
            Create workout
          </Button>
        </Card>
      ) : (
        <>
          <section>
            <SectionTitle
              action={
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setView({ kind: "build", editing: null })}
                >
                  New
                </Button>
              }
            >
              My workouts
            </SectionTitle>
            {mine.length === 0 ? (
              <Card className="wk-inline-empty">
                <p>You haven’t built any workouts yet.</p>
                <Button
                  size="sm"
                  onClick={() => setView({ kind: "build", editing: null })}
                >
                  Create workout
                </Button>
              </Card>
            ) : (
              <div className="wk-grid">
                {mine.map((t) => (
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
              </div>
            )}
          </section>

          {curated.length > 0 && (
            <section>
              <SectionTitle>System &amp; AI</SectionTitle>
              <div className="wk-grid">
                {curated.map((t) => (
                  <TemplateCard key={t.id} template={t} owned={false} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function TemplateCard({
  template,
  owned,
  pendingDelete,
  onEdit,
  onAskDelete,
  onCancelDelete,
  onConfirmDelete,
}: {
  template: TemplateWithExercises;
  owned: boolean;
  pendingDelete?: boolean;
  onEdit?: () => void;
  onAskDelete?: () => void;
  onCancelDelete?: () => void;
  onConfirmDelete?: () => void;
}) {
  const count = template.exercises.length;
  // Use the first exercise's category to pick a representative glyph.
  const firstMeta = count > 0 ? getMeta(template.exercises[0].exercise_slug) : undefined;
  const category = firstMeta ? glyphCategory(firstMeta) : "conditioning";
  const sourceLabel = template.source === "ai" ? "AI" : "System";

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

      <div className="wk-card-meta">
        <span>
          {count} exercise{count === 1 ? "" : "s"}
        </span>
        {template.est_duration_min && <span>~{template.est_duration_min} min</span>}
        {template.goal && <Chip>{template.goal}</Chip>}
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
        </div>
      )}
    </Card>
  );
}
