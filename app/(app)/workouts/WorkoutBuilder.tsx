"use client";

// The workout builder: create or edit a user template. Title/description/goal,
// a searchable exercise picker, and a per-exercise editor (sets, reps/seconds,
// weight, rest, superset group, notes) with reorder + remove. Saves through
// saveTemplate() and hands control back to the list on success.

import { useMemo, useState } from "react";
import {
  Button,
  Card,
  InlineNotice,
  SectionTitle,
} from "../../components/ui/primitives";
import { MovementGlyph } from "../../components/visuals";
import {
  listMeta,
  matchesQuery,
  glyphCategory,
  MUSCLE_LABEL,
  equipmentLabel,
} from "../../lib/library";
import { saveTemplate, type TemplateWithExercises } from "../../lib/db";
import type { ExerciseMeta } from "../../lib/movements/types";

const GOALS = ["strength", "muscle", "mobility", "consistency", "conditioning"];

// A row in the builder's working list. `mode` toggles reps vs. a timed hold.
type BuilderRow = {
  key: string;
  slug: string;
  sets: number;
  mode: "reps" | "hold";
  targetReps: number;
  targetSeconds: number;
  weight: number | null;
  restSeconds: number;
  supersetGroup: number | null;
  notes: string;
};

let rowSeq = 0;
function newKey() {
  rowSeq += 1;
  return `row-${Date.now()}-${rowSeq}`;
}

function rowFromMeta(meta: ExerciseMeta): BuilderRow {
  const isHold = Boolean(meta.tutTarget) && meta.primaryMuscles.includes("core");
  return {
    key: newKey(),
    slug: meta.slug,
    sets: 3,
    mode: isHold ? "hold" : "reps",
    targetReps: 10,
    targetSeconds: 30,
    weight: null,
    restSeconds: 60,
    supersetGroup: null,
    notes: "",
  };
}

export function WorkoutBuilder({
  editing,
  units,
  onSaved,
  onCancel,
}: {
  editing: TemplateWithExercises | null;
  units: "kg" | "lb";
  onSaved: () => void;
  onCancel: () => void;
}) {
  const allMeta = useMemo(() => listMeta(), []);
  const metaBySlug = useMemo(() => {
    const m = new Map<string, ExerciseMeta>();
    for (const meta of allMeta) m.set(meta.slug, meta);
    return m;
  }, [allMeta]);

  const [title, setTitle] = useState(editing?.title ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [goal, setGoal] = useState(editing?.goal ?? "");
  const [rows, setRows] = useState<BuilderRow[]>(() =>
    (editing?.exercises ?? []).map((ex) => ({
      key: newKey(),
      slug: ex.exercise_slug,
      sets: ex.sets,
      mode: ex.target_seconds != null && ex.target_reps == null ? "hold" : "reps",
      targetReps: ex.target_reps ?? 10,
      targetSeconds: ex.target_seconds ?? 30,
      weight: ex.target_weight,
      restSeconds: ex.rest_seconds ?? 60,
      supersetGroup: ex.superset_group,
      notes: ex.notes ?? "",
    })),
  );

  const [query, setQuery] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const results = useMemo(() => {
    if (!pickerOpen) return [];
    return allMeta.filter((m) => matchesQuery(m, query)).slice(0, 40);
  }, [allMeta, query, pickerOpen]);

  function addExercise(meta: ExerciseMeta) {
    setRows((r) => [...r, rowFromMeta(meta)]);
    setQuery("");
    setPickerOpen(false);
  }

  function updateRow(key: string, patch: Partial<BuilderRow>) {
    setRows((r) => r.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function removeRow(key: string) {
    setRows((r) => r.filter((row) => row.key !== key));
  }

  function move(key: string, dir: -1 | 1) {
    setRows((r) => {
      const i = r.findIndex((row) => row.key === key);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= r.length) return r;
      const next = [...r];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  async function handleSave() {
    setError(null);
    if (!title.trim()) {
      setError("Give your workout a title.");
      return;
    }
    if (rows.length === 0) {
      setError("Add at least one exercise.");
      return;
    }
    setSaving(true);
    try {
      await saveTemplate({
        id: editing?.id,
        title: title.trim(),
        description: description.trim() || null,
        goal: goal || null,
        exercises: rows.map((row, i) => ({
          exerciseSlug: row.slug,
          position: i,
          sets: row.sets,
          targetReps: row.mode === "reps" ? row.targetReps : null,
          targetSeconds: row.mode === "hold" ? row.targetSeconds : null,
          targetWeight: row.weight,
          restSeconds: row.restSeconds,
          supersetGroup: row.supersetGroup,
          notes: row.notes.trim() || null,
        })),
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save this workout.");
      setSaving(false);
    }
  }

  return (
    <div className="stack wb">
      <div className="wb-head">
        <div>
          <p className="eyebrow">{editing ? "Edit workout" : "New workout"}</p>
          <h1>{editing ? "Edit workout" : "Build a workout"}</h1>
        </div>
        <div className="row-wrap">
          <Button variant="ghost" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save workout"}
          </Button>
        </div>
      </div>

      {error && <InlineNotice tone="warn">{error}</InlineNotice>}

      <Card>
        <div className="wb-fields">
          <label className="field">
            <span>Title</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Full-body strength"
              maxLength={80}
            />
          </label>
          <label className="field">
            <span>Goal</span>
            <select value={goal} onChange={(e) => setGoal(e.target.value)}>
              <option value="">No specific goal</option>
              {GOALS.map((g) => (
                <option key={g} value={g}>
                  {g[0].toUpperCase() + g.slice(1)}
                </option>
              ))}
            </select>
          </label>
          <label className="field wb-field-wide">
            <span>Description (optional)</span>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A short note about this workout"
              maxLength={200}
            />
          </label>
        </div>
      </Card>

      <SectionTitle
        action={
          <Button
            size="sm"
            variant={pickerOpen ? "secondary" : "primary"}
            onClick={() => setPickerOpen((o) => !o)}
          >
            {pickerOpen ? "Close picker" : "Add exercise"}
          </Button>
        }
      >
        Exercises {rows.length > 0 && <span className="wb-count">({rows.length})</span>}
      </SectionTitle>

      {pickerOpen && (
        <Card className="wb-picker">
          <input
            type="search"
            className="wb-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search exercises by name or muscle…"
            autoFocus
            aria-label="Search exercises"
          />
          <div className="wb-results">
            {results.length === 0 ? (
              <p className="wb-empty">No matches. Try another name or muscle group.</p>
            ) : (
              results.map((meta) => (
                <button
                  key={meta.slug}
                  type="button"
                  className="wb-result"
                  onClick={() => addExercise(meta)}
                >
                  <MovementGlyph category={glyphCategory(meta)} />
                  <span className="wb-result-text">
                    <strong>{meta.name}</strong>
                    <small>
                      {meta.primaryMuscles.map((m) => MUSCLE_LABEL[m]).join(", ")}
                    </small>
                  </span>
                  <span className="wb-result-add" aria-hidden>
                    +
                  </span>
                </button>
              ))
            )}
          </div>
        </Card>
      )}

      {rows.length === 0 ? (
        <Card>
          <p className="wb-hint">
            No exercises yet. Use “Add exercise” to build your list — you can
            reorder and fine-tune each one below.
          </p>
        </Card>
      ) : (
        <div className="stack">
          {rows.map((row, i) => {
            const meta = metaBySlug.get(row.slug);
            const canWeight = meta ? meta.loadType !== "bodyweight" : true;
            return (
              <Card key={row.key} className="wb-row">
                <div className="wb-row-head">
                  <div className="wb-row-title">
                    {meta && <MovementGlyph category={glyphCategory(meta)} />}
                    <div>
                      <strong>{meta?.name ?? row.slug}</strong>
                      {meta && (
                        <small>
                          {meta.primaryMuscles.map((m) => MUSCLE_LABEL[m]).join(", ")}
                        </small>
                      )}
                    </div>
                  </div>
                  <div className="wb-row-actions">
                    <button
                      type="button"
                      className="wb-icon-btn"
                      onClick={() => move(row.key, -1)}
                      disabled={i === 0}
                      aria-label="Move up"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="wb-icon-btn"
                      onClick={() => move(row.key, 1)}
                      disabled={i === rows.length - 1}
                      aria-label="Move down"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className="wb-icon-btn wb-icon-danger"
                      onClick={() => removeRow(row.key)}
                      aria-label="Remove exercise"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                <div className="wb-row-grid">
                  <div className="wb-mini">
                    <span className="wb-mini-label">Sets</span>
                    <Stepper
                      value={row.sets}
                      min={1}
                      max={10}
                      onChange={(v) => updateRow(row.key, { sets: v })}
                    />
                  </div>

                  <div className="wb-mini">
                    <span className="wb-mini-label">Target</span>
                    <div className="wb-toggle-row">
                      <div className="wb-seg" role="group" aria-label="Target type">
                        <button
                          type="button"
                          className={row.mode === "reps" ? "active" : ""}
                          onClick={() => updateRow(row.key, { mode: "reps" })}
                        >
                          Reps
                        </button>
                        <button
                          type="button"
                          className={row.mode === "hold" ? "active" : ""}
                          onClick={() => updateRow(row.key, { mode: "hold" })}
                        >
                          Hold
                        </button>
                      </div>
                      {row.mode === "reps" ? (
                        <Stepper
                          value={row.targetReps}
                          min={1}
                          max={100}
                          onChange={(v) => updateRow(row.key, { targetReps: v })}
                        />
                      ) : (
                        <Stepper
                          value={row.targetSeconds}
                          min={5}
                          max={600}
                          step={5}
                          suffix="s"
                          onChange={(v) => updateRow(row.key, { targetSeconds: v })}
                        />
                      )}
                    </div>
                  </div>

                  <div className="wb-mini">
                    <span className="wb-mini-label">Rest</span>
                    <Stepper
                      value={row.restSeconds}
                      min={0}
                      max={600}
                      step={15}
                      suffix="s"
                      onChange={(v) => updateRow(row.key, { restSeconds: v })}
                    />
                  </div>

                  {canWeight && (
                    <label className="wb-mini">
                      <span className="wb-mini-label">Weight ({units})</span>
                      <input
                        type="number"
                        className="wb-num"
                        min={0}
                        step={0.5}
                        value={row.weight ?? ""}
                        placeholder="—"
                        onChange={(e) =>
                          updateRow(row.key, {
                            weight: e.target.value === "" ? null : Number(e.target.value),
                          })
                        }
                      />
                    </label>
                  )}

                  <label className="wb-mini">
                    <span className="wb-mini-label">Superset</span>
                    <input
                      type="number"
                      className="wb-num"
                      min={1}
                      max={9}
                      value={row.supersetGroup ?? ""}
                      placeholder="—"
                      onChange={(e) =>
                        updateRow(row.key, {
                          supersetGroup:
                            e.target.value === "" ? null : Number(e.target.value),
                        })
                      }
                    />
                  </label>
                </div>

                <label className="field wb-notes">
                  <span>Notes (optional)</span>
                  <input
                    type="text"
                    value={row.notes}
                    onChange={(e) => updateRow(row.key, { notes: e.target.value })}
                    placeholder="Tempo, cues, or a reminder for this exercise"
                    maxLength={160}
                  />
                </label>

                {meta && meta.equipment.length > 0 && (
                  <p className="wb-equip">
                    {meta.equipment.map((eq) => equipmentLabel(eq)).join(" · ")}
                  </p>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <div className="row-wrap wb-foot">
        <Button variant="ghost" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={saving} full>
          {saving ? "Saving…" : editing ? "Save changes" : "Save workout"}
        </Button>
      </div>
    </div>
  );
}

function Stepper({
  value,
  min,
  max,
  step = 1,
  suffix,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (v: number) => void;
}) {
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  return (
    <div className="wb-stepper">
      <button
        type="button"
        onClick={() => onChange(clamp(value - step))}
        disabled={value <= min}
        aria-label="Decrease"
      >
        −
      </button>
      <span className="wb-stepper-value">
        {value}
        {suffix ?? ""}
      </span>
      <button
        type="button"
        onClick={() => onChange(clamp(value + step))}
        disabled={value >= max}
        aria-label="Increase"
      >
        +
      </button>
    </div>
  );
}

export default WorkoutBuilder;
