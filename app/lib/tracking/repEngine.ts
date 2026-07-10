// Rep-counting + tempo/TUT engine.
//
// Works in normalized "depth" space: depth 0 = the movement's rest/home angle,
// depth 1 = its full range. Because depth is normalized against each movement's
// rest and active angles, one state machine handles movements where the angle
// shrinks under load (squat, curl) and where it grows (press, glute bridge)
// with no special-casing.
//
// Robustness features:
//  - Hysteresis (separate enter/return thresholds) so jitter can't double-count.
//  - Range-of-motion gate: a rep only counts if it reached the movement's
//    minimum depth fraction — partial reps are ignored.
//  - Refractory period so a fast bounce can't register two reps.
//  - Per-phase timing → eccentric / pause / concentric seconds and TUT.
//
// Range calibration (the "my 0% and my 100%" layer):
// Config restAngle/activeAngle describe the EXPECTED human; the camera
// measures a specific athlete on a specific camera, and MediaPipe's z noise
// systematically compresses measured angles away from full extension/flexion
// (a truly straight arm reads ~165-172°, never 180°). So the engine
// calibrates the config range to the athlete as they demonstrate it:
//  - Rest side: while idle at the start position, restCal converges to the
//    athlete's own measured rest angle (windowed EMA — samples far from the
//    expected rest are rejected, so walking through frame can't hijack it).
//  - Active side: after a rep that legitimately cleared the counting gate
//    (so a half rep can never teach the calibrator), activeCal blends toward
//    that rep's measured peak — the athlete's true lockout/bottom becomes
//    depth 1.0, whether the sensor under- or over-reads the config target.
//  - Honesty bound: the calibrated span can never shrink below 80% of the
//    config span, so counting gates stay within coaching standards and half
//    reps stay uncountable even against a shrunken range.

import { clamp } from "../pose/landmarks";
import type { MovementDef, MovementMeasure, RepPhase } from "../movements/types";

const HOME = 0.15; // depth below this = back at rest
const ENTER = 0.5; // depth above this = rep is underway
const BOTTOM_MARGIN = 0.06; // how close to peak counts as "at the bottom"
const MIN_REP_MS = 500; // refractory between reps
const QUALITY_GATE = 0.35; // ignore frames with worse tracking

// ---- Range-calibration tuning ----
const REST_TAU_S = 1.5; // idle rest-angle EMA time constant (settles in ~2s)
const ACTIVE_BLEND = 0.85; // how far activeCal moves toward a demonstrated peak
const SPAN_MIN_FRAC = 0.8; // calibrated span never shrinks below 80% of config
const SPAN_MAX_FRAC = 1.3; // ...or grows beyond 130% (one outlier rep can't skew)

export type RepEvent = {
  repNumber: number;
  durationSeconds: number;
  eccentricSeconds: number;
  pauseSeconds: number;
  concentricSeconds: number;
  peakDepth: number;
  tutSeconds: number;
};

export type FrameState = {
  depth: number;
  peakDepth: number;
  phase: RepPhase;
  side: MovementMeasure["side"] | null;
  angle: number | null;
  quality: number;
  velocity: number; // depth units per second (smoothed sign)
  reps: number;
  repEvent: RepEvent | null;
  tutSeconds: number;
  activeSeconds: number;
  holdSeconds: number;
  holdValid: boolean;
};

export class RepEngine {
  private movement: MovementDef;
  private reps = 0;
  private depth = 0;
  private peakDepth = 0;
  private lastDepth = 0;
  private lastTs = 0;
  private inRep = false;
  private reachedBottom = false;
  private rising = false;
  private lastRepTs = 0;
  private tut = 0;
  private active = 0;
  private hold = 0;
  private repTut = 0;
  // phase timing markers (ms)
  private startTs = 0;
  private bottomTs = 0;
  private riseTs = 0;
  // When the athlete last left the rest zone. A rep only CONFIRMS at the
  // deeper ENTER threshold (hysteresis vs jitter), but its timing is
  // backdated to this moment so eccentric/duration reflect the real movement,
  // not just the portion past halfway.
  private leftHomeTs = 0;

  // repFractionScale scales the range-of-motion gate: <1 = more lenient counting,
  // >1 = stricter (a rep must reach deeper to count).
  private minFrac: number;

  // Calibrated range (see header). Initialized from config; restCal learns
  // during idle, activeCal learns from counted reps. Survives reset() — the
  // athlete and camera don't change between sets; a new movement gets a new
  // engine instance (and therefore fresh calibration) from the hook.
  private restCal: number;
  private activeCal: number;
  // Raw measured angle at the deepest point of the current rep.
  private peakAngle: number;

  constructor(movement: MovementDef, repFractionScale = 1) {
    this.movement = movement;
    this.minFrac = clamp(movement.minRepFraction * repFractionScale, 0.3, 0.95);
    this.restCal = movement.restAngle;
    this.activeCal = movement.activeAngle;
    this.peakAngle = movement.restAngle;
  }

  reset() {
    this.reps = 0;
    this.depth = 0;
    this.peakDepth = 0;
    this.lastDepth = 0;
    this.lastTs = 0;
    this.inRep = false;
    this.reachedBottom = false;
    this.rising = false;
    this.lastRepTs = 0;
    this.tut = 0;
    this.active = 0;
    this.hold = 0;
    this.repTut = 0;
    this.startTs = 0;
    this.bottomTs = 0;
    this.riseTs = 0;
    this.leftHomeTs = 0;
  }

  get repCount() {
    return this.reps;
  }

  private toDepth(angle: number): number {
    const span = this.activeCal - this.restCal;
    if (Math.abs(span) < 1e-6) return 0;
    return clamp((angle - this.restCal) / span, -0.15, 1.35);
  }

  /** Idle-only: converge restCal to the athlete's own measured start position.
   * Windowed vs the CONFIG rest so a walk-through or a stretch can't teach it. */
  private calibrateRest(angle: number, dt: number) {
    const { restAngle, activeAngle } = this.movement;
    const restWindow = Math.min(30, Math.abs(activeAngle - restAngle) * 0.35);
    if (Math.abs(angle - restAngle) > restWindow) return;
    const alpha = 1 - Math.exp(-dt / REST_TAU_S);
    this.restCal += (angle - this.restCal) * alpha;
  }

  /** After a counted rep (a half rep can never get here): blend activeCal
   * toward the athlete's demonstrated peak, inside the honesty bounds. */
  private calibrateActive() {
    const { restAngle, activeAngle } = this.movement;
    const cfgSpan = activeAngle - restAngle;
    const sign = Math.sign(cfgSpan) || 1;
    const target = activeAngle + ACTIVE_BLEND * (this.peakAngle - activeAngle);
    const spanMag = clamp(
      (target - this.restCal) * sign,
      Math.abs(cfgSpan) * SPAN_MIN_FRAC,
      Math.abs(cfgSpan) * SPAN_MAX_FRAC,
    );
    this.activeCal = this.restCal + sign * spanMag;
  }

  update(measure: MovementMeasure | null, timestampMs: number): FrameState {
    const dt = this.lastTs ? (timestampMs - this.lastTs) / 1000 : 0;
    this.lastTs = timestampMs;
    let repEvent: RepEvent | null = null;

    // ---- Hold movements (planks): score valid-hold time -------------------
    // For hold movements the hook passes the body-line angle as measure.angle.
    if (this.movement.mode === "hold") {
      let holdValid = false;
      let angle: number | null = null;
      let quality = 0;
      if (measure && measure.quality >= QUALITY_GATE) {
        angle = measure.angle;
        quality = measure.quality;
        const band = this.movement.holdBand ?? [158, 182];
        holdValid = angle >= band[0] && angle <= band[1];
        if (holdValid && dt > 0 && dt < 1) {
          this.hold += dt;
          this.tut += dt;
        }
      }
      return {
        depth: 0,
        peakDepth: 0,
        phase: holdValid ? "bottom" : "ready",
        side: measure?.side ?? null,
        angle,
        quality,
        velocity: 0,
        reps: 0,
        repEvent: null,
        tutSeconds: this.tut,
        activeSeconds: this.hold,
        holdSeconds: this.hold,
        holdValid,
      };
    }

    // ---- Rep movements ----------------------------------------------------
    if (!measure || measure.quality < QUALITY_GATE) {
      // Hold state; don't advance the machine on a bad frame.
      return this.snapshot(null, 0, 0, repEvent);
    }

    // Learn the athlete's actual start position while they're between reps.
    if (!this.inRep && dt > 0 && dt < 1) this.calibrateRest(measure.angle, dt);

    const depth = this.toDepth(measure.angle);
    const velocity = dt > 0 && dt < 1 ? (depth - this.lastDepth) / dt : 0;
    this.depth = depth;

    // Time under tension while loaded (away from rest).
    if (dt > 0 && dt < 1 && depth > HOME) {
      this.tut += dt;
      this.active += dt;
      if (this.inRep) this.repTut += dt;
    }

    const bottomZone = Math.max(this.minFrac * 0.9, ENTER + 0.05);

    if (!this.inRep) {
      // Track the moment the athlete leaves rest, for backdated rep timing.
      if (this.lastDepth <= HOME && depth > HOME) this.leftHomeTs = timestampMs;
      if (depth <= HOME) this.leftHomeTs = 0;
      // Waiting at home; start a rep when we clearly leave rest.
      if (depth > ENTER) {
        this.inRep = true;
        this.reachedBottom = false;
        this.rising = false;
        this.peakDepth = depth;
        this.peakAngle = measure.angle;
        this.repTut = 0;
        this.startTs = this.leftHomeTs || timestampMs;
        this.bottomTs = 0;
        this.riseTs = 0;
      }
    } else {
      if (depth > this.peakDepth) {
        this.peakDepth = depth;
        this.peakAngle = measure.angle;
      }
      if (!this.reachedBottom && depth >= bottomZone) {
        this.reachedBottom = true;
        this.bottomTs = timestampMs;
      }
      // Detect the turnaround: we've started coming back up from the peak.
      if (this.reachedBottom && !this.rising && depth < this.peakDepth - BOTTOM_MARGIN) {
        this.rising = true;
        this.riseTs = timestampMs;
      }
      // Rep completes when we return home.
      if (depth < HOME) {
        const endTs = timestampMs;
        const validRange = this.peakDepth >= this.minFrac;
        const longEnough = endTs - this.startTs >= MIN_REP_MS;
        const notBounced = endTs - this.lastRepTs >= MIN_REP_MS;
        if (this.reachedBottom && validRange && longEnough && notBounced) {
          this.reps += 1;
          this.lastRepTs = endTs;
          // A legitimate rep just landed — tune the range to this athlete.
          this.calibrateActive();
          const bottomTs = this.bottomTs || this.startTs;
          const riseTs = this.riseTs || bottomTs;
          repEvent = {
            repNumber: this.reps,
            durationSeconds: round2((endTs - this.startTs) / 1000),
            eccentricSeconds: round2((bottomTs - this.startTs) / 1000),
            pauseSeconds: round2((riseTs - bottomTs) / 1000),
            concentricSeconds: round2((endTs - riseTs) / 1000),
            peakDepth: round2(this.peakDepth),
            tutSeconds: round2(this.repTut),
          };
        }
        this.inRep = false;
        this.reachedBottom = false;
        this.rising = false;
      }
    }

    this.lastDepth = depth;
    return this.snapshot(measure, depth, velocity, repEvent);
  }

  private snapshot(
    measure: MovementMeasure | null,
    depth: number,
    velocity: number,
    repEvent: RepEvent | null,
  ): FrameState {
    let phase: RepPhase = "ready";
    if (this.inRep) {
      if (this.rising) phase = "rising";
      else if (this.reachedBottom) phase = "bottom";
      else phase = "lowering";
    }
    return {
      depth,
      peakDepth: this.inRep ? this.peakDepth : 0,
      phase,
      side: measure?.side ?? null,
      angle: measure?.angle ?? null,
      quality: measure?.quality ?? 0,
      velocity,
      reps: this.reps,
      repEvent,
      tutSeconds: this.tut,
      activeSeconds: this.active,
      holdSeconds: this.hold,
      holdValid: false,
    };
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
