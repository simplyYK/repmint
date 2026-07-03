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
