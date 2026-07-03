// Shared app-level types (kept separate from the pure tracking library).

export type View = "hub" | "coach" | "progress" | "settings";
export type Phase = "setup" | "active" | "review";

export type Profile = {
  name: string;
  goal: string;
  level: string;
  equipment: string;
  schedule: number;
  coaching: "Quiet" | "Standard" | "Detailed";
};

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
