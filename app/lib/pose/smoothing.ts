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
