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
  velocity: number; // depth units per second (signed); + = moving away from rest
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

// ---------------------------------------------------------------------------
// Exercise bank metadata (BUILD_SPEC section 1).
//
// Every exercise in the library — whether or not it is camera-trackable — has
// an ExerciseMeta. Tier 1/2 exercises ALSO have a MovementDef that drives the
// tracking engine; tier 3 exercises are metadata-only (timer / manual logging).
// The TS registry is the single source of truth; the seed exporter writes this
// out to supabase/seed/exercises.json for the DB.
// ---------------------------------------------------------------------------

// How honestly a single camera can coach a movement.
export type TrackingTier = 1 | 2 | 3;
// 1 = full camera coaching: rep counting + form % + ROM + live cues
// 2 = camera rep counting only (no reliable form judgment)
// 3 = timer/manual logging (camera can't see the load path usefully)

export type MuscleGroup =
  | "chest"
  | "back"
  | "shoulders"
  | "biceps"
  | "triceps"
  | "forearms"
  | "quads"
  | "hamstrings"
  | "glutes"
  | "calves"
  | "core"
  | "obliques"
  | "hip_flexors"
  | "adductors"
  | "abductors"
  | "traps"
  | "lats"
  | "lower_back"
  | "full_body";

export type Equipment =
  | "bodyweight"
  | "dumbbell"
  | "barbell"
  | "kettlebell"
  | "cable"
  | "machine"
  | "band"
  | "bench"
  | "pull_up_bar"
  | "box"
  | "medicine_ball";

export type Difficulty = "beginner" | "intermediate" | "advanced";

export type LoadType = "bodyweight" | "external" | "both";

export type ExerciseMeta = {
  slug: string; // stable id, snake_case, == DB exercises.slug
  name: string;
  aliases: string[];
  primaryMuscles: MuscleGroup[];
  secondaryMuscles: MuscleGroup[];
  equipment: Equipment[];
  difficulty: Difficulty;
  tier: TrackingTier;
  loadType: LoadType; // drives weight-logging UI
  instructions: string[]; // 3-6 numbered setup/execution steps
  formPoints: string[]; // 3-5 evidence-based technique points
  commonMistakes: string[]; // 2-4
  safetyNote?: string; // claim-safe wording only (see AGENTS.md)
  romGuideline: string; // human-readable target range of motion
  tutTarget?: [number, number]; // seconds per rep band
};

// A bank entry pairs an exercise's metadata with its (optional) tracking def.
// Tier 1/2 entries carry a MovementDef; tier 3 entries are meta-only.
export type ExerciseEntry = {
  meta: ExerciseMeta;
  def?: MovementDef;
};
