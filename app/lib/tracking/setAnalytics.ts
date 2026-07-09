// Within-set fatigue analytics: velocity loss + tempo drift.
//
// Why: reps slow down as a set approaches failure. Tracking concentric
// velocity loss (VL%) inside the set lets the coach say "that's productive
// work" or "consider racking it" with an evidence-based basis instead of a
// vibe. Thresholds follow velocity-based-training research: Pareja-Blanco
// et al. (2017, Scand J Med Sci Sports 27(7):724–735) compared 20% vs 40%
// velocity-loss cutoffs and found ~20% VL gave comparable strength gains with
// far less fatigue/neuromuscular strain, while pushing toward ~40% mostly
// added fatigue. We treat <10% as fresh, 10–20% as the productive zone,
// sustained ≥20% as high fatigue, and sustained ≥35% as a stop suggestion —
// deliberately below the 40% arm. Tempo drift (concentric slowing per rep) is
// a camera-friendly proxy for the same phenomenon. Pure state machine — no
// camera, no React, no DOM.

/** One completed rep's inputs. */
export type AnalyticsRep = {
  /** Mean concentric velocity proxy for the rep (depth units/second or m/s — any consistent unit). */
  vConc: number;
  /** Concentric phase duration, seconds. */
  concentricSeconds: number;
};

/** Coach-facing fatigue state derived from velocity loss. */
export type FatigueStatus = "fresh" | "productive" | "high_fatigue" | "stop_suggested";

const BASELINE_REPS = 3; // vBest = fastest of the first N reps
const MIN_REPS_FOR_VL = 4; // need a baseline plus at least one comparison rep
const MIN_REPS_FOR_DRIFT = 5; // linear fit under 5 points is noise
const SUSTAIN_REPS = 2; // a threshold must hold for N consecutive reps

const VL_FRESH = 10; // % — below this the lifter is still fresh
const VL_HIGH = 20; // % — sustained ≥ this = high fatigue (Pareja-Blanco 2017 low-VL arm)
const VL_STOP = 35; // % — sustained ≥ this = suggest ending the set

/**
 * Accumulates per-rep velocity/tempo data across one set and derives
 * velocity-loss percentage, a fatigue status, and tempo drift.
 *
 * Usage: call {@link addRep} after every counted rep, read the getters for
 * the HUD, and {@link reset} between sets.
 */
export class SetAnalytics {
  private reps: AnalyticsRep[] = [];
  private vlHistory: number[] = []; // VL% per rep, from rep MIN_REPS_FOR_VL onward

  /**
   * Record one completed rep. Non-finite or non-positive velocities are
   * recorded but excluded from the baseline, so a single bad frame can't
   * poison the whole set's VL math.
   */
  addRep(rep: AnalyticsRep): void {
    this.reps.push(rep);
    const vl = this.computeVelocityLoss();
    if (vl !== null) this.vlHistory.push(vl);
  }

  /**
   * Velocity loss percentage: `(1 − vLatest / vBest) × 100`, where vBest is
   * the fastest of the first three reps. Null until 4 reps are recorded
   * (baseline + one comparison rep). Clamped at 0 — getting FASTER is 0% loss.
   */
  get velocityLossPct(): number | null {
    return this.computeVelocityLoss();
  }

  /**
   * Fatigue status from velocity loss (thresholds per Pareja-Blanco 2017):
   * - `fresh`: VL < 10% (or not enough reps to judge),
   * - `productive`: 10–20% — the effective-training zone,
   * - `high_fatigue`: VL ≥ 20% sustained for 2 consecutive reps,
   * - `stop_suggested`: VL ≥ 35% sustained for 2 consecutive reps.
   * Sustain requirements stop one slow rep (lost balance, re-grip) from
   * flipping the coach's advice.
   */
  get status(): FatigueStatus {
    const n = this.vlHistory.length;
    if (n === 0) return "fresh";
    const latest = this.vlHistory[n - 1];
    const prev = n >= SUSTAIN_REPS ? this.vlHistory[n - SUSTAIN_REPS] : null;

    const sustained = (threshold: number) =>
      prev !== null && latest >= threshold && this.vlHistory.slice(n - SUSTAIN_REPS).every((v) => v >= threshold);

    if (sustained(VL_STOP)) return "stop_suggested";
    if (sustained(VL_HIGH)) return "high_fatigue";
    if (latest < VL_FRESH) return "fresh";
    return "productive";
  }

  /**
   * Tempo drift: slope of a least-squares linear fit of concentricSeconds
   * across rep index, expressed as a percentage of the mean concentric time
   * per rep. Positive = each rep's concentric is slowing (fatigue), negative
   * = speeding up. Null until 5 reps are recorded.
   */
  get tempoDriftPct(): number | null {
    const n = this.reps.length;
    if (n < MIN_REPS_FOR_DRIFT) return null;
    const ys = this.reps.map((r) => r.concentricSeconds);
    const meanX = (n - 1) / 2;
    const meanY = ys.reduce((a, b) => a + b, 0) / n;
    if (!(meanY > 1e-6)) return null;
    let num = 0;
    let den = 0;
    for (let i = 0; i < n; i++) {
      num += (i - meanX) * (ys[i] - meanY);
      den += (i - meanX) ** 2;
    }
    if (den < 1e-9) return null;
    const slope = num / den; // seconds per rep
    return (slope / meanY) * 100;
  }

  /** Number of reps recorded so far. */
  get repCount(): number {
    return this.reps.length;
  }

  /** Clear all recorded reps — call between sets. */
  reset(): void {
    this.reps = [];
    this.vlHistory = [];
  }

  // ---- internals ----------------------------------------------------------

  private computeVelocityLoss(): number | null {
    if (this.reps.length < MIN_REPS_FOR_VL) return null;
    const baseline = this.reps
      .slice(0, BASELINE_REPS)
      .map((r) => r.vConc)
      .filter((v) => Number.isFinite(v) && v > 0);
    if (!baseline.length) return null;
    const vBest = Math.max(...baseline);
    const latest = this.reps[this.reps.length - 1].vConc;
    if (!Number.isFinite(latest) || latest <= 0) return 100;
    return Math.max(0, (1 - latest / vBest) * 100);
  }
}
