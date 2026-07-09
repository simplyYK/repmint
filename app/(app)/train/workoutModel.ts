"use client";

// Pure(ish) workout-session model for /train. Turns a template (or a single
// ad-hoc exercise) into an ordered list of "set slots" the live coach steps
// through, and accumulates completed set results ready for db.saveSession.

import type { TemplateWithExercises } from "../../lib/db";
import { getMeta } from "../../lib/library";
import type { ExerciseMeta } from "../../lib/movements/types";

export type PlannedSet = {
  key: string;
  exerciseSlug: string;
  meta: ExerciseMeta;
  setIndex: number; // 0-based within the exercise
  totalSets: number;
  targetReps: number | null;
  targetSeconds: number | null;
  targetWeight: number | null;
  restSeconds: number;
  supersetGroup: number | null;
  exercisePosition: number;
};

export type CompletedSet = {
  key: string;
  exerciseSlug: string;
  setIndex: number;
  reps: number | null;
  seconds: number | null;
  weight: number | null;
  isBodyweight: boolean;
  avgFormScore: number | null;
  romScore: number | null;
  tutSeconds: number | null;
  topCues: string[];
  repMetrics: Record<string, unknown>[];
};

const LAST_WEIGHT_KEY = "repmint-last-weight";

export function buildPlannedSets(template: TemplateWithExercises): PlannedSet[] {
  const slots: PlannedSet[] = [];
  const ordered = [...template.exercises].sort((a, b) => a.position - b.position);
  for (const ex of ordered) {
    const meta = getMeta(ex.exercise_slug);
    if (!meta) continue;
    const total = Math.max(1, ex.sets ?? 1);
    for (let i = 0; i < total; i++) {
      slots.push({
        key: `${ex.id}-${i}`,
        exerciseSlug: ex.exercise_slug,
        meta,
        setIndex: i,
        totalSets: total,
        targetReps: ex.target_reps,
        targetSeconds: ex.target_seconds,
        targetWeight: ex.target_weight,
        restSeconds: ex.rest_seconds ?? 60,
        supersetGroup: ex.superset_group,
        exercisePosition: ex.position,
      });
    }
  }
  return slots;
}

export function buildAdHocSets(meta: ExerciseMeta, sets = 3): PlannedSet[] {
  const targetReps = meta.tier === 3 ? 10 : 10;
  const isHold = /plank|hold|carry|wall_sit/i.test(meta.slug);
  return Array.from({ length: sets }, (_, i) => ({
    key: `adhoc-${meta.slug}-${i}`,
    exerciseSlug: meta.slug,
    meta,
    setIndex: i,
    totalSets: sets,
    targetReps: isHold ? null : targetReps,
    targetSeconds: isHold ? 40 : null,
    targetWeight: null,
    restSeconds: 60,
    supersetGroup: null,
    exercisePosition: 0,
  }));
}

/** Remembers the last logged weight per exercise slug (localStorage, per device). */
export function readLastWeight(slug: string): number | null {
  if (typeof window === "undefined") return null;
  try {
    const map = JSON.parse(window.localStorage.getItem(LAST_WEIGHT_KEY) ?? "{}") as Record<string, number>;
    return typeof map[slug] === "number" ? map[slug] : null;
  } catch {
    return null;
  }
}

export function writeLastWeight(slug: string, weight: number) {
  if (typeof window === "undefined") return;
  try {
    const map = JSON.parse(window.localStorage.getItem(LAST_WEIGHT_KEY) ?? "{}") as Record<string, number>;
    map[slug] = weight;
    window.localStorage.setItem(LAST_WEIGHT_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

/** Group planned sets by exercise for the summary + progress rail. */
export function groupByExercise(sets: PlannedSet[]): { slug: string; meta: ExerciseMeta; count: number }[] {
  const out: { slug: string; meta: ExerciseMeta; count: number }[] = [];
  for (const s of sets) {
    const last = out[out.length - 1];
    if (last && last.slug === s.exerciseSlug) last.count += 1;
    else out.push({ slug: s.exerciseSlug, meta: s.meta, count: 1 });
  }
  return out;
}
