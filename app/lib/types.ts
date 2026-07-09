// Shared app-level types (kept separate from the pure tracking library).

export type View = "hub" | "coach" | "ai" | "progress" | "settings";
export type Phase = "setup" | "active" | "review";

export type CoachIntensity = "Quiet" | "Standard" | "Detailed";
export type CoachTone = "Supportive" | "Direct" | "Technical";
export type Strictness = "Lenient" | "Standard" | "Strict";

export type Profile = {
  name: string;
  goal: string;
  level: string;
  equipment: string;
  schedule: number;
  coaching: CoachIntensity;
  // Personalization
  avatar: string;
  tone: CoachTone;
  tutTargetPerRep: number; // seconds under tension the user aims for per rep
  strictness: Strictness; // how strict rep range-of-motion counting is
  mirrorCamera: boolean;
  restSeconds: number;
  units: "kg" | "lb";
};

export const DEFAULT_PROFILE: Profile = {
  name: "RepMint athlete",
  goal: "Strength foundation",
  level: "Beginner",
  equipment: "Bodyweight",
  schedule: 3,
  coaching: "Standard",
  avatar: "ember",
  tone: "Supportive",
  tutTargetPerRep: 3,
  strictness: "Standard",
  mirrorCamera: true,
  restSeconds: 60,
  units: "kg",
};

// Config the tracking engine reads from the profile.
export type CoachConfig = {
  intensity: CoachIntensity;
  tone: CoachTone;
  tutTargetPerRep: number;
  strictness: Strictness;
  mirror: boolean;
};

export function configFromProfile(p: Profile): CoachConfig {
  return {
    intensity: p.coaching,
    tone: p.tone,
    tutTargetPerRep: p.tutTargetPerRep,
    strictness: p.strictness,
    mirror: p.mirrorCamera,
  };
}

export type FaultTally = {
  signal: string;
  cue: string;
  count: number;
};

export type SetResult = {
  id: string;
  date: string;
  movement: string;
  movementName: string;
  category: string;
  reps: number;
  targetReps?: number;
  targetSeconds?: number;
  seconds: number;
  tut: number;
  tempo: string;
  avgRepSeconds?: number;
  cue: string;
  faults: FaultTally[];
  source: "pose" | "manual" | "timer";
};

// ---------------------------------------------------------------------------
// DB-shaped types — mirror supabase/migrations/0001_schema.sql. These are the
// row shapes returned by app/lib/db.ts helpers (see BUILD_SPEC section 2).
// ---------------------------------------------------------------------------

export type DbExperienceLevel = "beginner" | "intermediate" | "advanced";
export type DbUnits = "kg" | "lb";
export type DbLoadType = "bodyweight" | "external" | "both";
export type DbTemplateSource = "user" | "ai" | "system";
export type DbPlanSource = "ai" | "user";
export type DbPlanStatus = "active" | "archived" | "completed";
export type DbSessionStatus = "active" | "completed" | "discarded";
export type DbWeightUnit = "kg" | "lb";
export type DbCoachRole = "user" | "assistant";
export type DbFriendshipStatus = "pending" | "accepted";
export type DbShareVisibility = "friends" | "public";

export type DbProfile = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  goal: string | null;
  experience_level: DbExperienceLevel;
  equipment: string[];
  is_public: boolean;
  units: DbUnits;
  created_at: string;
};

export type DbExercise = {
  id: string;
  slug: string;
  name: string;
  aliases: string[];
  category: string | null;
  primary_muscles: string[];
  secondary_muscles: string[];
  equipment: string[];
  difficulty: DbExperienceLevel;
  tier: 1 | 2 | 3;
  load_type: DbLoadType;
  instructions: string[];
  form_points: string[];
  common_mistakes: string[];
  rom_guideline: string | null;
  tut_target: [number, number] | null;
  tracking: Record<string, unknown>;
  created_at: string;
};

export type DbWorkoutTemplate = {
  id: string;
  owner_id: string | null;
  title: string;
  description: string | null;
  source: DbTemplateSource;
  goal: string | null;
  est_duration_min: number | null;
  is_public: boolean;
  created_at: string;
};

export type DbTemplateExercise = {
  id: string;
  template_id: string;
  position: number;
  exercise_slug: string;
  sets: number;
  target_reps: number | null;
  target_seconds: number | null;
  target_weight: number | null;
  rest_seconds: number;
  superset_group: number | null;
  notes: string | null;
  created_at: string;
};

export type DbPlan = {
  id: string;
  owner_id: string;
  title: string;
  goal: string | null;
  weeks: number;
  source: DbPlanSource;
  model_used: string | null;
  status: DbPlanStatus;
  created_at: string;
};

export type DbPlanDay = {
  id: string;
  plan_id: string;
  day_index: number;
  weekday: number | null;
  template_id: string | null;
  title: string | null;
  focus: string | null;
  is_rest: boolean;
  created_at: string;
};

export type DbSession = {
  id: string;
  owner_id: string;
  template_id: string | null;
  plan_day_id: string | null;
  title: string | null;
  started_at: string;
  ended_at: string | null;
  status: DbSessionStatus;
  total_reps: number;
  total_sets: number;
  active_seconds: number;
  avg_form_score: number | null;
  notes: string | null;
  created_at: string;
};

export type DbSessionSet = {
  id: string;
  session_id: string;
  owner_id: string;
  exercise_slug: string;
  set_index: number;
  reps: number | null;
  seconds: number | null;
  weight: number | null;
  weight_unit: DbWeightUnit;
  is_bodyweight: boolean;
  avg_form_score: number | null;
  rom_score: number | null;
  tut_seconds: number | null;
  top_cues: string[];
  rep_metrics: Record<string, unknown>[];
  created_at: string;
};

export type DbCoachMessage = {
  id: string;
  owner_id: string;
  session_id: string | null;
  role: DbCoachRole;
  content: string;
  model: string | null;
  created_at: string;
};

export type DbUserSettings = {
  owner_id: string;
  ai_model: string;
  ai_instructions_override: string | null;
  coach_voice: string;
  audio_cues: boolean;
  haptics: boolean;
  rest_timer_default: number;
};
