// Exercise bank index — the single source of truth for RepMint's library.
//
// Category files each export an ExerciseEntry[]. This module flattens them into
// two lookup maps:
//   MOVEMENTS  — slug -> MovementDef  (tier 1 & 2 only: everything camera can rep-count)
//   EXERCISES  — slug -> ExerciseMeta (ALL exercises, every tier)
//
// The seed exporter (scripts/export-exercises.mjs) reads these to build
// supabase/seed/exercises.json. registry.ts re-exports from here so existing
// import sites keep working unchanged.

import type {
  ExerciseEntry,
  ExerciseMeta,
  MovementDef,
} from "../types";

import { legs } from "./legs";
import { hinge } from "./hinge";
import { core } from "./core";
import { push } from "./push";
import { pull } from "./pull";
import { shoulders } from "./shoulders";
import { arms } from "./arms";
import { mobility } from "./mobility";
import { machines } from "./machines";
import { conditioning } from "./conditioning";

// Order is the display order for grouped library views.
export const ALL_ENTRIES: ExerciseEntry[] = [
  ...legs,
  ...hinge,
  ...core,
  ...push,
  ...pull,
  ...shoulders,
  ...arms,
  ...mobility,
  ...machines,
  ...conditioning,
];

// ---- Integrity guard: catch duplicate slugs at module load ----------------
{
  const seen = new Set<string>();
  for (const entry of ALL_ENTRIES) {
    const slug = entry.meta.slug;
    if (seen.has(slug)) {
      throw new Error(`Duplicate exercise slug in the bank: "${slug}"`);
    }
    seen.add(slug);
    // Tier 1/2 must carry a MovementDef; tier 3 must not.
    if ((entry.meta.tier === 1 || entry.meta.tier === 2) && !entry.def) {
      throw new Error(`Exercise "${slug}" is tier ${entry.meta.tier} but has no MovementDef.`);
    }
    if (entry.def) {
      // Keep the def's dbSlug pinned to the meta slug so DB references line up.
      entry.def.dbSlug = slug;
    }
  }
}

// slug -> MovementDef for every camera-trackable exercise (tier 1 & 2).
export const MOVEMENTS: Record<string, MovementDef> = Object.fromEntries(
  ALL_ENTRIES.filter((e) => e.def).map((e) => [e.meta.slug, e.def as MovementDef]),
);

// slug -> ExerciseMeta for the entire library (all tiers).
export const EXERCISES: Record<string, ExerciseMeta> = Object.fromEntries(
  ALL_ENTRIES.map((e) => [e.meta.slug, e.meta]),
);

// Flat list of just the movement defs, preserving category order. Used by the
// legacy registry helpers (getMovement / movementsByCategory).
export const MOVEMENT_LIST: MovementDef[] = ALL_ENTRIES.filter(
  (e): e is ExerciseEntry & { def: MovementDef } => Boolean(e.def),
).map((e) => e.def);

// The MovementDef.id keys used by the runtime (some hyphenated, from the
// original 12 movements; new ones are snake_case slugs). getMovement resolves by
// either the slug or the MovementDef.id so both old and new call sites work.
export const MOVEMENT_MAP: Record<string, MovementDef> = (() => {
  const map: Record<string, MovementDef> = {};
  for (const def of MOVEMENT_LIST) {
    map[def.id] = def;
    map[def.dbSlug ?? def.id] = def;
  }
  return map;
})();

export const META_LIST: ExerciseMeta[] = ALL_ENTRIES.map((e) => e.meta);
