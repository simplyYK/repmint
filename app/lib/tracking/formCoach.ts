// Real-time form coach.
//
// Runs a movement's form checks every frame and turns them into ONE calm,
// supportive on-screen cue. It debounces (a fault must persist briefly before
// we say anything), holds a cue long enough to read, and keeps a per-fault
// tally for the set summary. It never invents medical or injury claims — cue
// text comes straight from each movement's check definitions.

import type { MovementDef, PoseContext } from "../movements/types";

const PERSIST_MS = 260; // a fault must last this long before we surface it
const HOLD_MS = 1100; // keep a surfaced cue on screen at least this long
const COUNT_THROTTLE_MS = 1300; // don't tally the same fault more than this often

export type CoachTone = "idle" | "moving" | "good" | "adjust";

export type CoachOutput = {
  cue: string;
  tone: CoachTone;
  signal: string | null;
};

type SignalState = {
  firstSeen: number;
  lastSeen: number;
  count: number;
  lastCounted: number;
};

const POSITIVE = [
  "Nice and controlled.",
  "Good range — keep that rhythm.",
  "Smooth tempo, stay with it.",
  "That's the line — hold it.",
];

export class FormCoach {
  private movement: MovementDef;
  private signals = new Map<string, SignalState>();
  private cleanFrames = 0;
  private shown: { cue: string; signal: string | null; until: number } | null = null;
  private posIndex = 0;
  private lastPosSwap = 0;

  constructor(movement: MovementDef) {
    this.movement = movement;
  }

  reset() {
    this.signals.clear();
    this.cleanFrames = 0;
    this.shown = null;
    this.posIndex = 0;
    this.lastPosSwap = 0;
  }

  /** Per-fault counts for the set review (signal -> times observed). */
  faultSummary(): Array<{ signal: string; cue: string; count: number }> {
    return Array.from(this.signals.entries())
      .filter(([, s]) => s.count > 0)
      .map(([signal, s]) => ({ signal, cue: this.cueFor(signal), count: s.count }))
      .sort((a, b) => b.count - a.count);
  }

  private cueFor(signal: string): string {
    return this.cueBySignal.get(signal) ?? "";
  }
  private cueBySignal = new Map<string, string>();

  update(ctx: PoseContext, now: number): CoachOutput {
    // Idle: setup guidance until the person is actually tracked and moving.
    if (ctx.quality < 0.45) {
      return { cue: this.movement.setupCue, tone: "idle", signal: null };
    }

    // Evaluate the checks that apply this frame.
    let topFault: { cue: string; severity: number; signal: string } | null = null;
    for (const check of this.movement.formChecks) {
      if (check.when === "bottom" && ctx.phase !== "bottom") continue;
      const result = check.evaluate(ctx);
      if (!result || result.ok) continue;
      this.cueBySignal.set(result.signal, result.cue);
      const state = this.markSeen(result.signal, now);
      // Only consider surfacing a fault that has persisted long enough.
      if (now - state.firstSeen >= PERSIST_MS || check.when === "bottom") {
        if (!topFault || result.severity > topFault.severity) {
          topFault = { cue: result.cue, severity: result.severity, signal: result.signal };
        }
        this.tally(result.signal, now);
      }
    }

    this.expireSignals(now);

    if (topFault) {
      this.cleanFrames = 0;
      this.shown = { cue: topFault.cue, signal: topFault.signal, until: now + HOLD_MS };
      return { cue: topFault.cue, tone: "adjust", signal: topFault.signal };
    }

    // Keep the last cue up briefly so it's readable, then clear.
    if (this.shown && now < this.shown.until) {
      return { cue: this.shown.cue, tone: "adjust", signal: this.shown.signal };
    }
    this.shown = null;

    // Clean and moving → positive reinforcement; otherwise a gentle "ready".
    if (ctx.depth > 0.2 || ctx.phase !== "ready") {
      this.cleanFrames += 1;
      if (this.cleanFrames > 6) {
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
