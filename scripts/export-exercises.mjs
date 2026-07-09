// Export the TS exercise bank to supabase/seed/exercises.json.
//
// The TypeScript registry (app/lib/movements/defs) is the single source of
// truth. This script flattens every ExerciseMeta (+ its tracking config when
// the exercise has a MovementDef) into one row per exercise, matching the DB
// columns in BUILD_SPEC section 2, and writes them to the seed file for
// Supabase to load.
//
// Run with:  npx tsx scripts/export-exercises.mjs
// (tsx is used because this imports the .ts registry directly; the repo already
//  runs the engine smoketest the same way.)

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { ALL_ENTRIES } from "../app/lib/movements/defs/index.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");
const OUT_PATH = resolve(REPO_ROOT, "supabase/seed/exercises.json");

// Map a MovementDef.category (push/pull/legs/core) plus dbCategory into the
// coarse `category` string stored on the DB row. Tier-3 exercises have no def,
// so we fall back to a category inferred from their primary muscle group.
function categoryFor(entry) {
  if (entry.def) return entry.def.category;
  return muscleCategory(entry.meta.primaryMuscles[0]);
}

function muscleCategory(muscle) {
  switch (muscle) {
    case "chest":
    case "shoulders":
    case "triceps":
      return "push";
    case "back":
    case "lats":
    case "biceps":
    case "traps":
    case "forearms":
      return "pull";
    case "quads":
    case "hamstrings":
    case "glutes":
    case "calves":
    case "adductors":
    case "abductors":
    case "hip_flexors":
      return "legs";
    case "core":
    case "obliques":
    case "lower_back":
      return "core";
    default:
      return "full_body";
  }
}

// Build the int4range literal Postgres expects for tut_target, or null.
function tutRange(tut) {
  if (!tut || tut.length !== 2) return null;
  const [lo, hi] = tut;
  return `[${Math.round(lo)},${Math.round(hi)}]`;
}

// The `tracking` jsonb column: reference/analytics copy of the engine config.
// The TS registry still drives runtime; this is for the DB's own use.
function trackingFor(entry) {
  if (!entry.def) return null;
  const d = entry.def;
  return {
    rest_angle: d.restAngle,
    active_angle: d.activeAngle,
    min_rep_fraction: d.minRepFraction,
    view: d.view,
    mode: d.mode,
    unilateral: d.unilateral,
    ...(d.holdBand ? { hold_band: d.holdBand } : {}),
  };
}

const rows = ALL_ENTRIES.map((entry) => {
  const m = entry.meta;
  return {
    slug: m.slug,
    name: m.name,
    aliases: m.aliases,
    category: categoryFor(entry),
    primary_muscles: m.primaryMuscles,
    secondary_muscles: m.secondaryMuscles,
    equipment: m.equipment,
    difficulty: m.difficulty,
    tier: m.tier,
    load_type: m.loadType,
    instructions: m.instructions,
    form_points: m.formPoints,
    common_mistakes: m.commonMistakes,
    safety_note: m.safetyNote ?? null,
    rom_guideline: m.romGuideline,
    tut_target: tutRange(m.tutTarget),
    tracking: trackingFor(entry),
  };
});

// Deterministic order: by tier then slug, so the seed diff is stable.
rows.sort((a, b) => (a.tier - b.tier) || a.slug.localeCompare(b.slug));

mkdirSync(dirname(OUT_PATH), { recursive: true });
writeFileSync(OUT_PATH, JSON.stringify(rows, null, 2) + "\n", "utf8");

const byTier = rows.reduce((acc, r) => ((acc[r.tier] = (acc[r.tier] ?? 0) + 1), acc), {});
console.log(`Wrote ${rows.length} exercises to ${OUT_PATH}`);
console.log(`  tier 1: ${byTier[1] ?? 0}   tier 2: ${byTier[2] ?? 0}   tier 3: ${byTier[3] ?? 0}`);
