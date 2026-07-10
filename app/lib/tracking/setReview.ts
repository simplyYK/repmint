// Post-set review: ONE genuine, personalized focus line for the next set.
//
// Shown on the logging screen after every camera-tracked set. The line is
// derived from what actually happened — the dominant form fault, range or
// tempo trends across the rep metrics, fatigue state, and target adherence —
// in priority order, so the athlete gets the single most useful adjustment
// rather than a list. Two phrasings per case, rotated by set, so back-to-back
// sets don't read identically. Pure function, no side effects.

export type SetReviewInput = {
  /** Per-rep metrics as recorded by the live coach (rom/tempo are 0..1). */
  repMetrics: Array<{ score?: number; rom?: number; tempo?: number; concentricSeconds?: number }>;
  /** Fault tally from the FormCoach, most frequent first. */
  faults: Array<{ signal: string; cue: string; count: number }>;
  reps: number | null;
  targetReps: number;
  /** Time under tension for the set (seconds) and the per-rep target. */
  tutSeconds: number | null;
  tutTargetPerRep: number;
  fatigue: "fresh" | "productive" | "high_fatigue" | "stop_suggested";
  /** Rotates phrasing variants so consecutive sets don't repeat. */
  setIndex: number;
};

// Fault signal → next-set focus phrasings (2 variants each). Falls back to
// the fault's own cue text for signals not mapped here.
const FAULT_FOCUS: Record<string, [string, string]> = {
  short_range: [
    "A few reps cut the range short — next set, own the full stretch on every rep.",
    "Range dipped on some reps. Slow down a touch and hit full depth each time.",
  ],
  hip_sag: [
    "Your hips dropped out of line — brace your core and squeeze your glutes next set.",
    "Watch the hip sag: think one straight line from shoulders to ankles.",
  ],
  hip_pike: [
    "Hips drifted high — keep them level with your shoulders next set.",
    "Lower the hips into one straight line — no piking.",
  ],
  torso_lean: [
    "You leaned forward under load — chest up and proud next set.",
    "Keep the torso taller through the middle of each rep.",
  ],
  knee_valgus: [
    "Knees caved in a little — push them out over your toes next set.",
    "Drive the knees out as you stand; track them over your toes.",
  ],
  elbow_drift: [
    "Elbows drifted forward — pin them to your sides next set.",
    "Lock the upper arms still; let only the forearms move.",
  ],
  torso_swing: [
    "Some body swing crept in — brace and let the target muscle do the work.",
    "Quieter torso next set: if you have to swing, the weight is winning.",
  ],
  too_much_knee: [
    "The hinge turned squatty — push the hips back and keep shins quieter.",
    "Think hips back, not knees forward, on the next set.",
  ],
  torso_angle_drift: [
    "Your back angle drifted — set your brace and hold one torso angle throughout.",
    "Hold the hinge steady next set; no standing up mid-pull.",
  ],
  elbow_flare: [
    "Elbows flared at the bottom — tuck them to about 45° next set.",
    "Keep the elbows tracking under the wrists on the way down.",
  ],
  too_high: [
    "You raised past shoulder height — stop at parallel to keep tension where it counts.",
    "Cap the raise at shoulder height next set.",
  ],
  tempo_fast: [
    "The descent got quick — take a full two seconds down next set.",
    "Slow the lowering phase; control builds more than momentum does.",
  ],
};

function pick(pair: [string, string], setIndex: number): string {
  return pair[setIndex % 2];
}

/** The single most useful focus line for the next set (never empty). */
export function buildSetReview(input: SetReviewInput): string {
  const { repMetrics, faults, reps, targetReps, tutTargetPerRep, fatigue, setIndex } = input;

  // 1. A repeated form fault is the highest-value fix.
  const topFault = faults.find((f) => f.count >= 2);
  if (topFault) {
    const mapped = FAULT_FOCUS[topFault.signal];
    if (mapped) return pick(mapped, setIndex);
    if (topFault.cue) return `Focus for next set: ${topFault.cue}`;
  }

  // 2. Range fading across the set (first third vs last third).
  const roms = repMetrics.map((m) => m.rom).filter((r): r is number => typeof r === "number");
  if (roms.length >= 4) {
    const third = Math.max(1, Math.floor(roms.length / 3));
    const early = roms.slice(0, third).reduce((s, r) => s + r, 0) / third;
    const late = roms.slice(-third).reduce((s, r) => s + r, 0) / third;
    if (early - late > 0.18) {
      return pick(
        [
          "Range faded on the last reps — rest a little longer, or stop one rep earlier and keep every rep full.",
          "Your first reps were the deepest. Next set, match that early range to the very end.",
        ],
        setIndex,
      );
    }
  }

  // 3. Bounced concentrics = momentum doing the work.
  const concs = repMetrics
    .map((m) => m.concentricSeconds)
    .filter((c): c is number => typeof c === "number" && c > 0);
  if (concs.length >= 3) {
    const avgConc = concs.reduce((s, c) => s + c, 0) / concs.length;
    if (avgConc < 0.35) {
      return pick(
        [
          "Reps were snappy — smooth, controlled reps will score higher and build more.",
          `You're moving fast: aim for about ${Math.max(2, Math.round(tutTargetPerRep))}s of tension per rep next set.`,
        ],
        setIndex,
      );
    }
  }

  // 4. Fatigue signal from velocity loss.
  if (fatigue === "stop_suggested" || fatigue === "high_fatigue") {
    return pick(
      [
        "Power dropped near the end — take a longer rest before the next set.",
        "Bar speed faded late. Extra rest now buys better reps next set.",
      ],
      setIndex,
    );
  }

  // 5. Under target: chase the gap.
  if (reps !== null && targetReps > 0 && reps < targetReps) {
    return pick(
      [
        `${reps} of ${targetReps} — solid work. Same weight next set, chase the last ${targetReps - reps}.`,
        `You left ${targetReps - reps} on the table. Rest well and go get ${targetReps} next set.`,
      ],
      setIndex,
    );
  }

  // 6. Clean set: reinforce, and nudge progression when it was crisp.
  const scores = repMetrics.map((m) => m.score).filter((s): s is number => typeof s === "number");
  const avgScore = scores.length ? scores.reduce((s, x) => s + x, 0) / scores.length : 0;
  if (avgScore >= 90 && reps !== null && targetReps > 0 && reps >= targetReps) {
    return pick(
      [
        "Crisp set — full range, steady tempo. If that felt easy, nudge the weight up next set.",
        "That's how every set should look. Feeling strong? Add a little load next set.",
      ],
      setIndex,
    );
  }
  return pick(
    [
      "Clean set. Same focus next time: full range, controlled tempo.",
      "Good work — keep the same range and rhythm going into the next set.",
    ],
    setIndex,
  );
}
