// One-Euro filter for smoothing noisy pose landmarks.
//
// Raw webcam pose estimates jitter frame-to-frame, which makes joint angles
// noisy and causes double-counted reps and flickering form cues. The One-Euro
// filter adapts its smoothing to movement speed: it smooths hard when the body
// is still (kills jitter) and loosens up during fast motion (keeps latency low).
// Ref: Casiez et al., "1€ Filter" (CHI 2012).

import type { Landmark, Pose } from "./landmarks";

class LowPass {
  private y: number | null = null;
  private s: number | null = null;

  filter(value: number, alpha: number): number {
    this.s = this.y === null ? value : alpha * value + (1 - alpha) * (this.s as number);
    this.y = value;
    return this.s;
  }

  reset() {
    this.y = null;
    this.s = null;
  }

  hasLast() {
    return this.s !== null;
  }

  last() {
    return this.s ?? 0;
  }
}

class OneEuro {
  private xFilter = new LowPass();
  private dxFilter = new LowPass();
  private lastValue: number | null = null;

  constructor(
    private minCutoff: number,
    private beta: number,
    private dCutoff: number,
  ) {}

  private alpha(cutoff: number, dt: number): number {
    const tau = 1 / (2 * Math.PI * cutoff);
    return 1 / (1 + tau / dt);
  }

  filter(value: number, dt: number): number {
    const dtSafe = dt > 1e-4 ? dt : 1 / 60;
    const dx = this.lastValue === null ? 0 : (value - this.lastValue) / dtSafe;
    this.lastValue = value;
    const edx = this.dxFilter.filter(dx, this.alpha(this.dCutoff, dtSafe));
    const cutoff = this.minCutoff + this.beta * Math.abs(edx);
    return this.xFilter.filter(value, this.alpha(cutoff, dtSafe));
  }

  reset() {
    this.xFilter.reset();
    this.dxFilter.reset();
    this.lastValue = null;
  }
}

/**
 * Smooths a whole 33-point pose stream. One filter triplet (x/y/z) per
 * landmark. `minCutoff` lower = smoother but laggier; `beta` higher = more
 * responsive to fast motion. Defaults tuned for exercise reps at ~30fps.
 */
export class PoseSmoother {
  private filters = new Map<number, { x: OneEuro; y: OneEuro; z: OneEuro }>();
  private lastTs = 0;

  constructor(
    private minCutoff = 1.7,
    private beta = 0.35,
    private dCutoff = 1.0,
  ) {}

  private forIndex(i: number) {
    let f = this.filters.get(i);
    if (!f) {
      f = {
        x: new OneEuro(this.minCutoff, this.beta, this.dCutoff),
        y: new OneEuro(this.minCutoff, this.beta, this.dCutoff),
        z: new OneEuro(this.minCutoff, this.beta, this.dCutoff),
      };
      this.filters.set(i, f);
    }
    return f;
  }

  filter(pose: Pose, timestampMs: number): Pose {
    const dt = this.lastTs ? (timestampMs - this.lastTs) / 1000 : 1 / 30;
    this.lastTs = timestampMs;
    return pose.map((lm, i) => {
      const f = this.forIndex(i);
      const out: Landmark = {
        x: f.x.filter(lm.x, dt),
        y: f.y.filter(lm.y, dt),
        visibility: lm.visibility,
      };
      if (lm.z !== undefined) out.z = f.z.filter(lm.z, dt);
      return out;
    });
  }

  reset() {
    this.filters.clear();
    this.lastTs = 0;
  }
}

/* ------------------------------------------------------------------------- */
/* Standalone One-Euro API (timestamp-driven)                                 */
/*                                                                            */
/* The classes below expose the same 1€ math with a timestamp-based surface  */
/* so callers outside the pose hook (setup checks, analytics, ad-hoc signal  */
/* smoothing) don't have to carry dt bookkeeping themselves. Defaults are    */
/* tuned for ~30fps webcam pose landmarks: minCutoff 1.0 keeps slow drift    */
/* smooth, beta 0.007 loosens the filter during fast rep motion.             */
/* Ref: Casiez, Roussel & Vogel, "1€ Filter" (CHI 2012).                     */
/* ------------------------------------------------------------------------- */

export type OneEuroOptions = {
  /** Baseline cutoff (Hz). Lower = smoother when still, but laggier. Default 1.0. */
  minCutoff?: number;
  /** Speed coefficient. Higher = more responsive during fast motion. Default 0.007. */
  beta?: number;
  /** Cutoff (Hz) for the derivative low-pass. Default 1.0. */
  dCutoff?: number;
};

/**
 * Single-channel One-Euro filter driven by wall-clock timestamps.
 *
 * Feed it one scalar signal (e.g. a landmark's x coordinate, or a joint
 * angle) with the frame's timestamp in milliseconds; it derives dt internally
 * and adapts smoothing to how fast the signal is moving.
 */
export class OneEuroFilter {
  private inner: OneEuro;
  private lastTs: number | null = null;

  constructor(opts: OneEuroOptions = {}) {
    this.inner = new OneEuro(opts.minCutoff ?? 1.0, opts.beta ?? 0.007, opts.dCutoff ?? 1.0);
  }

  /**
   * Filter the next sample.
   * @param value Raw sample value.
   * @param timestampMs Sample time in milliseconds (monotonic, e.g. performance.now()).
   * @returns The smoothed value.
   */
  filter(value: number, timestampMs: number): number {
    const dt = this.lastTs === null ? 1 / 30 : (timestampMs - this.lastTs) / 1000;
    this.lastTs = timestampMs;
    return this.inner.filter(value, dt);
  }

  /** Clear all internal state; the next sample passes through unfiltered. */
  reset() {
    this.inner.reset();
    this.lastTs = null;
  }
}

/**
 * Applies per-coordinate One-Euro filters to a full landmark array
 * (MediaPipe NormalizedLandmark-compatible: `{x, y, z?, visibility?}`).
 *
 * x, y and z are smoothed independently per landmark index; `visibility` is
 * passed through untouched (it is a confidence, not a position — smoothing it
 * would hide tracking dropouts from downstream quality gates).
 */
export class LandmarkSmoother {
  private filters = new Map<number, { x: OneEuroFilter; y: OneEuroFilter; z: OneEuroFilter }>();
  private opts: OneEuroOptions;

  constructor(opts: OneEuroOptions = {}) {
    this.opts = {
      minCutoff: opts.minCutoff ?? 1.0,
      beta: opts.beta ?? 0.007,
      dCutoff: opts.dCutoff ?? 1.0,
    };
  }

  private forIndex(i: number) {
    let f = this.filters.get(i);
    if (!f) {
      f = {
        x: new OneEuroFilter(this.opts),
        y: new OneEuroFilter(this.opts),
        z: new OneEuroFilter(this.opts),
      };
      this.filters.set(i, f);
    }
    return f;
  }

  /**
   * Smooth one frame of landmarks.
   * @param landmarks Landmark array for this frame (any length; filters are keyed by index).
   * @param timestampMs Frame time in milliseconds.
   * @returns A new array of smoothed landmarks (input is not mutated).
   */
  smooth(landmarks: Pose, timestampMs: number): Pose {
    return landmarks.map((lm, i) => {
      const f = this.forIndex(i);
      const out: Landmark = {
        x: f.x.filter(lm.x, timestampMs),
        y: f.y.filter(lm.y, timestampMs),
        visibility: lm.visibility,
      };
      if (lm.z !== undefined) out.z = f.z.filter(lm.z, timestampMs);
      return out;
    });
  }

  /** Drop every per-landmark filter; the next frame passes through unfiltered. */
  reset() {
    this.filters.clear();
  }
}
