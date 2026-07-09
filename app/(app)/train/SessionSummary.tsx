"use client";

// Session summary shown when a workout finishes: per-exercise sets table,
// quality highlights, editable title/notes, save → db.saveSession (auto-appears
// in the calendar), then links to history + "ask coach about this session".

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button, Metric } from "../../components/ui/primitives";
import { getMeta } from "../../lib/library";
import { formatClock } from "../../lib/format";
import type { CompletedSet } from "./workoutModel";

export function SessionSummary({
  completed,
  unit,
  saving,
  savedSessionId,
  defaultTitle,
  onSave,
  error,
}: {
  completed: CompletedSet[];
  unit: "kg" | "lb";
  saving: boolean;
  savedSessionId: string | null;
  defaultTitle: string;
  onSave: (title: string, notes: string) => void;
  error: string | null;
}) {
  const [title, setTitle] = useState(defaultTitle);
  const [notes, setNotes] = useState("");

  const totals = useMemo(() => {
    const reps = completed.reduce((s, c) => s + (c.reps ?? 0), 0);
    const sets = completed.length;
    const tut = completed.reduce((s, c) => s + (c.tutSeconds ?? 0), 0);
    const forms = completed.map((c) => c.avgFormScore).filter((n): n is number => typeof n === "number");
    const avgForm = forms.length ? Math.round(forms.reduce((a, b) => a + b, 0) / forms.length) : null;
    return { reps, sets, tut, avgForm };
  }, [completed]);

  // Group sets by exercise for the table.
  const byExercise = useMemo(() => {
    const map = new Map<string, CompletedSet[]>();
    for (const c of completed) {
      const list = map.get(c.exerciseSlug) ?? [];
      list.push(c);
      map.set(c.exerciseSlug, list);
    }
    return [...map.entries()];
  }, [completed]);

  if (savedSessionId) {
    return (
      <motion.div className="train-config" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <p className="eyebrow">Saved</p>
        <h1>Session logged.</h1>
        <p className="train-config-sub">It&apos;s in your calendar. Nice work.</p>
        <div className="metric-row-3 summary-totals">
          <Metric label="Sets" value={totals.sets} />
          <Metric label="Reps" value={totals.reps} />
          <Metric label="TUT" value={`${Math.round(totals.tut)}s`} />
        </div>
        <div className="row-wrap">
          <Link href="/history" className="btn btn-secondary btn-md">
            View history
          </Link>
          <Link href={`/coach?session=${savedSessionId}`} className="btn btn-primary btn-md">
            Ask coach about this session
          </Link>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div className="train-summary" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <p className="eyebrow">Session summary</p>
      <h1>Review and save.</h1>

      <div className="metric-row-3 summary-totals">
        <Metric label="Sets" value={totals.sets} />
        <Metric label="Reps" value={totals.reps} />
        <Metric label="TUT" value={`${Math.round(totals.tut)}s`} />
      </div>
      {totals.avgForm != null && (
        <p className="summary-highlight">Average form score {totals.avgForm}% across coached sets.</p>
      )}

      <div className="summary-table card">
        {byExercise.map(([slug, sets]) => {
          const meta = getMeta(slug);
          return (
            <div key={slug} className="summary-ex">
              <div className="summary-ex-head">
                <strong>{meta?.name ?? slug}</strong>
                <small>{sets.length} sets</small>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Set</th>
                    <th>Reps</th>
                    <th>Weight</th>
                    <th>TUT</th>
                    <th>Form</th>
                  </tr>
                </thead>
                <tbody>
                  {sets.map((s, i) => (
                    <tr key={s.key}>
                      <td>{i + 1}</td>
                      <td>{s.reps ?? (s.seconds != null ? formatClock(s.seconds) : "—")}</td>
                      <td>{s.isBodyweight ? "BW" : s.weight != null ? `${s.weight} ${unit}` : "—"}</td>
                      <td>{s.tutSeconds != null ? `${Math.round(s.tutSeconds)}s` : "—"}</td>
                      <td>{s.avgFormScore != null ? `${Math.round(s.avgFormScore)}%` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>

      <label className="field summary-field">
        <span>Session title</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label className="field summary-field">
        <span>Notes (optional)</span>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="How did it feel?" />
      </label>

      {error && <div className="notice notice-danger">{error}</div>}

      <div className="row-wrap">
        <Button size="lg" onClick={() => onSave(title, notes)} disabled={saving || completed.length === 0}>
          {saving ? "Saving…" : "Save session"}
        </Button>
        <Link href="/hub" className="btn btn-ghost btn-md">
          Discard
        </Link>
      </div>
    </motion.div>
  );
}
