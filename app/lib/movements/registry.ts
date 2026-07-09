// Thin compatibility layer over the exercise bank.
//
// The library now lives in `defs/` (category files + index). This module keeps
// the original registry surface — MOVEMENTS, MOVEMENT_MAP, CATEGORY_LABEL,
// CATEGORY_ORDER, getMovement, movementsByCategory — so existing import sites
// (page.tsx, Landing.tsx, persistence.ts, the smoketest) keep working unchanged.
//
// New code should prefer importing MOVEMENTS / EXERCISES from
// `./defs` directly (slug-keyed records + full ExerciseMeta).

import type { MovementDef } from "./types";
import {
  MOVEMENT_LIST,
  MOVEMENT_MAP as DEFS_MOVEMENT_MAP,
} from "./defs";

// Re-export the slug-keyed bank so new consumers can reach it via the registry.
export {
  MOVEMENTS as MOVEMENT_DEFS,
  EXERCISES,
  ALL_ENTRIES,
  META_LIST,
  MOVEMENT_LIST,
} from "./defs";

// Legacy array form: every camera-trackable MovementDef in category order.
export const MOVEMENTS: MovementDef[] = MOVEMENT_LIST;

// Legacy id/slug -> MovementDef lookup (resolves both hyphenated ids and slugs).
export const MOVEMENT_MAP: Record<string, MovementDef> = DEFS_MOVEMENT_MAP;

export const CATEGORY_LABEL: Record<MovementDef["category"], string> = {
  push: "Push",
  pull: "Pull",
  legs: "Legs",
  core: "Core",
};

export const CATEGORY_ORDER: MovementDef["category"][] = ["legs", "push", "pull", "core"];

export function getMovement(id: string): MovementDef {
  return MOVEMENT_MAP[id] ?? MOVEMENTS[0];
}

export function movementsByCategory(): Array<{
  category: MovementDef["category"];
  label: string;
  items: MovementDef[];
}> {
  return CATEGORY_ORDER.map((category) => ({
    category,
    label: CATEGORY_LABEL[category],
    items: MOVEMENTS.filter((m) => m.category === category),
  }));
}
