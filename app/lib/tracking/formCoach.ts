// Real-time form coach.
//
// Runs a movement's form checks every frame and turns them into ONE calm,
// supportive on-screen cue. It debounces (a fault must persist briefly before
// we surface it), holds a cue long enough to read, and keeps a per-fault tally
// for the set summary. It also derives a tempo cue from the user's chosen time
// under tension, and respects the coaching-intensity preference (how chatty the
// coach is). Cue text always comes from the movement/check definitions — never
// invented, and never a medical or injury claim.

import type { MovementDef, PoseContext } from "../movements/types";
import type { CoachIntensity } from "../types";

const PERSIST_MS = 260;
const HOLD_MS = 1100;
const COUNT_THROTTLE_MS = 1300;

export type CoachTone = "idle" | "moving" | "good" | "adjust";

export type CoachOutput = {
  cue: string;
  tone: CoachTone;
  signal: string | null;
};

export type FormCoachConfig = {
  intensity: CoachIntensity;
  tutTargetPerRep: number;
};

type SignalState = { firstSeen: number; lastSeen: number; count: number; lastCounted: number };

const POSITIVE = [
  "Nice and controlled.",
  "Good range — keep that rhythm.",
  "Smooth tempo, stay with it.",
  "That's the line — hold it.",
];

export class FormCoach {
  private movement: MovementDef;
  private config: FormCoachConfig;
  private signals = new Map<string, SignalState>();
  private cueBySignal = new Map<string, string>();
  private cleanFrames = 0;
  private shown: { cue: string; signal: string | null; until: number } | null = null;
  private posIndex = 0;
  private lastPosSwap = 0;

  constructor(movement: MovementDef, config: FormCoachConfig = { intensity: "Standard", tutTargetPerRep: 3 }) {
    this.movement = movement;
    this.config = config;
  }

  reset() {
    this.signals.clear();
    this.cleanFrames = 0;
    this.shown = null;
    this.posIndex = 0;
    this.lastPosSwap = 0;
  }

  faultSummary(): Array<{ signal: string; cue: string; count: number }> {
    return Array.from(this.signals.entries())
      .filter(([, s]) => s.count > 0)
      .map(([signal, s]) => ({ signal, cue: this.cueBySignal.get(signal) ?? "", count: s.count }))
      .sort((a, b) => b.count - a.count);
  }

  // Derives a "descend slower" cue from the user's target time under tension.
  private tempoFault(ctx: PoseContext): { cue: string; severity: 1; signal: string } | null {
    if (this.config.intensity === "Quiet") return null;
    if (this.movement.mode === "hold") return null;
    if (ctx.phase !== "lowering" || ctx.depth < 0.25 || ctx.depth > 0.95) return null;
    const eccentricTarget = Math.max(0.8, this.config.tutTargetPerRep * 0.5); // seconds
    const targetVel = 0.85 / eccentricTarget; // depth units / second
    const sensitivity = this.config.intensity === "Detailed" ? 1.5 : 1.9;
    if (ctx.velocity > targetVel * sensitivity) {
      return { cue: "Lower with control — slow the descent.", severity: 1, signal: "tempo_fast" };
    }
    return null;
  }

  update(ctx: PoseContext, now: number): CoachOutput {
    if (ctx.quality < 0.45) {
      return { cue: this.movement.setupCue, tone: "idle", signal: null };
    }

    const minSeverity = this.config.intensity === "Quiet" ? 2 : 1;
    let topFault: { cue: string; severity: number; signal: string } | null = null;

    const consider = (result: { cue: string; severity: number; signal: string }, forceSurface: boolean) => {
      if (result.severity < minSeverity) return;
      this.cueBySignal.set(result.signal, result.cue);
      const state = this.markSeen(result.signal, now);
      if (forceSurface || now - state.firstSeen >= PERSIST_MS) {
        if (!topFault || result.severity > topFault.severity) topFault = { ...result };
        this.tally(result.signal, now);
      }
    };

    for (const check of this.movement.formChecks) {
      if (check.when === "bottom" && ctx.phase !== "bottom") continue;
      const result = check.evaluate(ctx);
      if (!result || result.ok) continue;
      consider(result, check.when === "bottom");
    }

    const tempo = this.tempoFault(ctx);
    if (tempo) consider(tempo, false);

    this.expireSignals(now);

    if (topFault) {
      this.cleanFrames = 0;
      const f = topFault as { cue: string; severity: number; signal: string };
      this.shown = { cue: f.cue, signal: f.signal, until: now + HOLD_MS };
      return { cue: f.cue, tone: "adjust", signal: f.signal };
    }

    if (this.shown && now < this.shown.until) {
      return { cue: this.shown.cue, tone: "adjust", signal: this.shown.signal };
    }
    this.shown = null;

    // Positive reinforcement — suppressed entirely when the user wants it quiet.
    if (this.config.intensity !== "Quiet" && (ctx.depth > 0.2 || ctx.phase !== "ready")) {
      this.cleanFrames += 1;
      const threshold = this.config.intensity === "Detailed" ? 4 : 6;
      if (this.cleanFrames > threshold) {
        if (now - this.lastPosSwap > 2600) {
          this.posIndex = (this.posIndex + 1) % POSITIVE.length;
          this.lastPosSwap = now;
        }
        return { cue: POSITIVE[this.posIndex], tone: "good", signal: null };
      }
    }
    return { cue: this.movement.setupCue, tone: "moving", signal: null };
  }

  private markSeen(signal: string, now: number): SignalState {
    let s = this.signals.get(signal);
    if (!s || now - s.lastSeen > 500) {
      s = { firstSeen: now, lastSeen: now, count: s?.count ?? 0, lastCounted: s?.lastCounted ?? 0 };
      this.signals.set(signal, s);
    } else {
      s.lastSeen = now;
    }
    return s;
  }

  private tally(signal: string, now: number) {
    const s = this.signals.get(signal);
    if (!s) return;
    if (now - s.lastCounted >= COUNT_THROTTLE_MS) {
      s.count += 1;
      s.lastCounted = now;
    }
  }

  private expireSignals(now: number) {
    for (const [signal, s] of this.signals) {
      if (now - s.lastSeen > 600 && s.count === 0) this.signals.delete(signal);
    }
  }
}
