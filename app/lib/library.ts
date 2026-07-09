// UI-facing view over the exercise bank. The TS registry (app/lib/movements)
// is the single source of truth for the 115-exercise library, so the library
// and exercise-detail screens read from it directly — no DB round-trip needed
// for static reference data. Sessions/sets/plans still go through db.ts.

import { EXERCISES, MOVEMENT_MAP } from "./movements/registry";
import type { ExerciseMeta, MovementDef, MuscleGroup, TrackingTier } from "./movements/types";

export type TierInfo = { label: string; blurb: string; short: string };

export const TIER_INFO: Record<TrackingTier, TierInfo> = {
  1: { label: "Full coaching", short: "Coaching", blurb: "Camera counts reps, scores form, tracks range and tempo." },
  2: { label: "Rep counting", short: "Reps", blurb: "Camera counts reps and range; form scoring stays off." },
  3: { label: "Manual log", short: "Manual", blurb: "Log sets, reps and weight yourself — camera sits this one out." },
};

export const MUSCLE_LABEL: Record<MuscleGroup, string> = {
  chest: "Chest",
  back: "Back",
  shoulders: "Shoulders",
  biceps: "Biceps",
  triceps: "Triceps",
  forearms: "Forearms",
  quads: "Quads",
  hamstrings: "Hamstrings",
  glutes: "Glutes",
  calves: "Calves",
  core: "Core",
  obliques: "Obliques",
  hip_flexors: "Hip flexors",
  adductors: "Adductors",
  abductors: "Abductors",
  traps: "Traps",
  lats: "Lats",
  lower_back: "Lower back",
  full_body: "Full body",
};

// Movement categories map onto MovementGlyph icon keys.
export type GlyphCategory =
  | "legs"
  | "hinge"
  | "push"
  | "pull"
  | "core"
  | "shoulders"
  | "arms"
  | "mobility"
  | "machines"
  | "conditioning";

const MUSCLE_TO_GLYPH: Partial<Record<MuscleGroup, GlyphCategory>> = {
  quads: "legs",
  glutes: "legs",
  hamstrings: "hinge",
  lower_back: "hinge",
  chest: "push",
  triceps: "push",
  back: "pull",
  lats: "pull",
  biceps: "arms",
  forearms: "arms",
  shoulders: "shoulders",
  traps: "shoulders",
  core: "core",
  obliques: "core",
  calves: "legs",
  full_body: "conditioning",
};

const EQUIPMENT_TO_GLYPH: Partial<Record<string, GlyphCategory>> = {
  machine: "machines",
  cable: "machines",
};

/** Best-effort glyph category for an exercise, used by <MovementGlyph />. */
export function glyphCategory(meta: ExerciseMeta): GlyphCategory {
  if (meta.equipment.some((e) => EQUIPMENT_TO_GLYPH[e])) {
    const eq = meta.equipment.find((e) => EQUIPMENT_TO_GLYPH[e]);
    if (eq) return EQUIPMENT_TO_GLYPH[eq]!;
  }
  const primary = meta.primaryMuscles[0];
  return (primary && MUSCLE_TO_GLYPH[primary]) || "conditioning";
}

export const ALL_MUSCLES: MuscleGroup[] = Object.keys(MUSCLE_LABEL) as MuscleGroup[];

export const ALL_EQUIPMENT = [
  "bodyweight",
  "dumbbell",
  "barbell",
  "kettlebell",
  "cable",
  "machine",
  "band",
  "bench",
  "pull_up_bar",
  "box",
  "medicine_ball",
] as const;

export function listMeta(): ExerciseMeta[] {
  return Object.values(EXERCISES);
}

export function getMeta(slug: string): ExerciseMeta | undefined {
  return EXERCISES[slug];
}

/** The MovementDef that drives live tracking for a slug, if the exercise is tier 1/2. */
export function getMovementForSlug(slug: string): MovementDef | undefined {
  const meta = EXERCISES[slug];
  if (!meta || meta.tier === 3) return undefined;
  return MOVEMENT_MAP[slug];
}

export function equipmentLabel(eq: string): string {
  return eq
    .split("_")
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

/** Search over name + aliases + muscle labels. Case-insensitive substring match. */
export function matchesQuery(meta: ExerciseMeta, query: string): boolean {
  if (!query.trim()) return true;
  const q = query.toLowerCase();
  if (meta.name.toLowerCase().includes(q)) return true;
  if (meta.aliases.some((a) => a.toLowerCase().includes(q))) return true;
  if (meta.primaryMuscles.some((m) => MUSCLE_LABEL[m].toLowerCase().includes(q))) return true;
  return false;
}
