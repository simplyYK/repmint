// Movement model: how RepMint describes an exercise to the tracking engine.
// A movement profile is pure configuration + small pure functions. It never
// touches the camera, React, or the DOM — the engine drives it.

import type { JointName, Pose, Side } from "../pose/landmarks";

export type MovementCategory = "push" | "pull" | "legs" | "core";
export type CameraView = "side" | "front" | "any";
export type TrackingMode = "rep" | "hold";

// Coarse category stored in Supabase (movement_category enum). New patterns
// that don't map cleanly fall back to "other".
export type DbMovementCategory =
  | "squat"
  | "lunge"
  | "push_up"
  | "hinge"
  | "plank"
  | "mobility_drill"
  | "other";

// Phase of a rep expressed in depth-space, independent of movement direction.
// "lowering" = moving away from rest, "rising" = returning to rest.
export type RepPhase = "ready" | "lowering" | "bottom" | "rising";

export type PoseContext = {
  pose: Pose;
  side: Side;
  quality: number; // 0..1 tracking confidence of the movement's key joints
  depth: number; // 0..1 normalized rep progress (0 = rest, 1 = full range)
  peakDepth: number; // deepest depth reached in the current rep
  phase: RepPhase;
};

export type FormResult =
  | { ok: true }
  | { ok: false; cue: string; severity: 1 | 2; signal: string };

export type FormCheck = {
  id: string;
  // when to evaluate: every frame, or only around the bottom of the rep.
  when: "always" | "bottom";
  evaluate: (ctx: PoseContext) => FormResult | null;
};

export type MovementMeasure = {
  angle: number;
  side: Side;
  quality: number;
};

export type MovementDef = {
  id: string;
  name: string;
  category: MovementCategory;
  dbCategory: DbMovementCategory;
  dbSlug: string | null;
  equipment: string[];
  mode: TrackingMode;
  view: CameraView;
  unilateral: boolean;
  target: { reps?: number; seconds?: number; sets: number };
  tempo: string;
  camera: string;
  setupCue: string;
  keyJoints: JointName[];

  // Rep driver. Returns the primary joint angle (deg) plus tracking side/quality.
  measure: (pose: Pose) => MovementMeasure | null;
  // Angle at rest ("home") and at full range. Direction is inferred from which
  // is larger, so the same engine handles squats (angle shrinks) and presses
  // (angle grows).
  restAngle: number;
  activeAngle: number;
  // Minimum fraction of full range (0..1) a rep must reach to be counted.
  minRepFraction: number;

  // Hold-mode config (planks etc.). `holdValid` returns whether the current
  // frame counts as a good hold.
  holdBand?: [number, number];
  holdMeasure?: (pose: Pose) => { angle: number; quality: number } | null;

  formChecks: FormCheck[];
  focus: string[]; // set-review focus areas
  reviewCue: string; // default next-set focus
};
