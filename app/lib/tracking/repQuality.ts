// Per-rep quality scoring.
//
// Why: the live HUD shows a single 0–100 "rep quality" number after every rep
// so users get immediate "you did it right" feedback (Priya) and comparable
// week-over-week data (Mateo). The score blends the three things a single
// camera can judge honestly:
//   - ROM: how deep the rep went past the movement's minimum counting range,
//   - tempo: how close time-under-tension was to the exercise's target band
//     (with a penalty for an uncontrolled/bounced concentric),
//   - stability: how many form faults the FormCoach flagged during the rep.
// Weights (0.4 / 0.3 / 0.3) put range first — it's the most reliable camera
// signal — while tempo and form share the rest. Pure math, no side effects.

/** Inputs describing one completed rep. Depth/fractions are 0..1 rep-range units. */
export type RepQualityInput = {
  /** Deepest normalized depth reached during the rep (from RepEngine's RepEvent). */
  peakDepth: number;
  /** The movement's minimum rep fraction — the depth a rep must reach to count. */
  minFrac: number;
  /** Time under tension for this rep, seconds. */
  tutSeconds: number;
  /** Target TUT per rep for this exercise, seconds. */
  tutTargetSeconds: number;
  /** Duration of the concentric (rising) phase, seconds. */
  concentricSeconds: number;
  /** Count of severity-1 (minor) form faults flagged during the rep. */
  severity1Faults: number;
  /** Count of severity-2 (major) form faults flagged during the rep. */
  severity2Faults: number;
};

/** Component scores (each 0..1) plus the blended 0–100 rep score. */
export type RepQuality = {
  /** Blended quality, 0–100: round(100 × (0.4·rom + 0.3·tempo + 0.3·stability)). */
  score: number;
  /** Range-of-motion component, 0.5–1.0 (a counted rep never scores below 0.5). */
  rom: number;
  /** Tempo component, 0..1 (gaussian around the TUT target). */
  tempo: number;
  /** Stability component, 0..1 (fault-count penalty). */
  stability: number;
};

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/**
 * Score one rep from its measured range, tempo and fault counts.
 *
 * - `rom`: excess depth beyond the counting minimum, normalized to 0..1 and
 *   mapped onto 0.5–1.0 — a rep that barely counted still earns half marks.
 * - `tempo`: gaussian `exp(−(tut−target)² / (2σ²))` with σ = target/2, so
 *   half the target off costs ~61% and a full target off costs ~13%; a
 *   concentric under 0.3s (a bounce, not a lift) multiplies tempo by 0.7.
 * - `stability`: `max(0, 1 − 0.25·sev1 − 0.5·sev2)` — two major faults or
 *   four minor ones zero the component.
 */
export function scoreRep(input: RepQualityInput): RepQuality {
  const {
    peakDepth,
    minFrac,
    tutSeconds,
    tutTargetSeconds,
    concentricSeconds,
    severity1Faults,
    severity2Faults,
  } = input;

  // ROM: 0 at the bare counting minimum, 1 at (or past) full range, then
  // mapped onto 0.5–1.0. Guard the degenerate minFrac ≈ 1 case.
  const romSpan = 1 - minFrac;
  const romRaw = romSpan > 1e-6 ? clamp01((peakDepth - minFrac) / romSpan) : peakDepth >= minFrac ? 1 : 0;
  const rom = 0.5 + 0.5 * romRaw;

  // Tempo: gaussian around the target TUT; σ = target/2.
  const target = tutTargetSeconds > 1e-6 ? tutTargetSeconds : 3;
  const sigma = target / 2;
  let tempo = Math.exp(-((tutSeconds - target) ** 2) / (2 * sigma * sigma));
  if (concentricSeconds < 0.3) tempo *= 0.7;
  tempo = clamp01(tempo);

  // Stability: minor faults cost a quarter each, major faults half each.
  const stability = Math.max(0, 1 - 0.25 * severity1Faults - 0.5 * severity2Faults);

  const score = Math.max(0, Math.min(100, Math.round(100 * (0.4 * rom + 0.3 * tempo + 0.3 * stability))));

  return { score, rom, tempo, stability };
}
