// The RepMint exercise library.
//
// Each movement is described declaratively so the tracking engine stays generic
// and new exercises are cheap to add: pick a rep-driving joint angle, its rest
// and full-range values, a minimum range-of-motion gate, and a few form checks.
// Angle thresholds follow mainstream strength-coaching technique standards
// (NSCA / ACE / NASM) and are widened slightly to tolerate single-camera noise.

import {
  jointAngle,
  jointPoint,
  visibilityOf,
  type Pose,
  type Side,
} from "../pose/landmarks";
import {
  bodyLineCheck,
  depthCheck,
  elbowDriftCheck,
  hingeKneeCheck,
  kneeValgusCheck,
  topHeightCheck,
  torsoLeanCheck,
  torsoStillCheck,
} from "./checks";
import type { JointName } from "../pose/landmarks";
import type { MovementDef, MovementMeasure } from "./types";

// Build a rep-driving angle measure from a joint triplet. `prefer` decides how
// to pick between the left/right sides each frame:
//   best = highest visibility (side-on lifts), min/max = most/least flexed.
function angleMeasure(
  a: JointName,
  b: JointName,
  c: JointName,
  prefer: "best" | "min" | "max" = "best",
): (pose: Pose) => MovementMeasure | null {
  return (pose) => {
    const sides: Side[] = ["left", "right"];
    const results = sides
      .map((side) => {
        const pa = jointPoint(pose, side, a);
        const pb = jointPoint(pose, side, b);
        const pc = jointPoint(pose, side, c);
        const quality = (visibilityOf(pa) + visibilityOf(pb) + visibilityOf(pc)) / 3;
        const angle = jointAngle(pa, pb, pc);
        return { side, angle, quality };
      })
      .filter((r): r is { side: Side; angle: number; quality: number } => r.angle !== null && r.quality >= 0.4);
    if (!results.length) return null;
    let chosen = results[0];
    for (const r of results) {
      if (prefer === "best" && r.quality > chosen.quality) chosen = r;
      else if (prefer === "min" && r.angle < chosen.angle) chosen = r;
      else if (prefer === "max" && r.angle > chosen.angle) chosen = r;
    }
    return { angle: chosen.angle, side: chosen.side, quality: chosen.quality };
  };
}

const abductionMeasure = angleMeasure("hip", "shoulder", "elbow", "best");

const kneeTriplet: JointName[] = ["hip", "knee", "ankle"];
const elbowTriplet: JointName[] = ["shoulder", "elbow", "wrist"];
const hipTriplet: JointName[] = ["shoulder", "hip", "knee"];
const bodyTriplet: JointName[] = ["shoulder", "hip", "ankle"];

export const MOVEMENTS: MovementDef[] = [
  // ------------------------------------------------------------------ LEGS
  {
    id: "squat",
    name: "Squat",
    category: "legs",
    dbCategory: "squat",
    dbSlug: "bodyweight-squat",
    equipment: ["Bodyweight", "Dumbbells", "Barbell"],
    mode: "rep",
    view: "side",
    unilateral: false,
    target: { reps: 8, sets: 3 },
    tempo: "3-1-1-0",
    camera: "Side or front view, full body from head to feet",
    setupCue: "Stand tall in frame with your whole body visible.",
    keyJoints: kneeTriplet,
    measure: angleMeasure("hip", "knee", "ankle", "min"),
    restAngle: 172,
    activeAngle: 88,
    minRepFraction: 0.72,
    formChecks: [
      depthCheck("Sit a little deeper — aim for thighs parallel.", 0.72),
      kneeValgusCheck("Push your knees out over your toes."),
      torsoLeanCheck("Chest up and proud.", 58),
    ],
    focus: ["depth", "tempo", "control"],
    reviewCue: "Keep the descent controlled and hit the same depth each rep.",
  },
  {
    id: "reverse-lunge",
    name: "Reverse Lunge",
    category: "legs",
    dbCategory: "lunge",
    dbSlug: "reverse-lunge",
    equipment: ["Bodyweight", "Dumbbells"],
    mode: "rep",
    view: "side",
    unilateral: true,
    target: { reps: 8, sets: 3 },
    tempo: "2-1-1-0",
    camera: "Side view with room behind you, full body visible",
    setupCue: "Step into frame with room to lunge backward.",
    keyJoints: kneeTriplet,
    measure: angleMeasure("hip", "knee", "ankle", "min"),
    restAngle: 170,
    activeAngle: 92,
    minRepFraction: 0.62,
    formChecks: [
      depthCheck("Sink a little lower — front thigh toward parallel.", 0.62),
      torsoLeanCheck("Stay tall through your chest.", 34),
    ],
    focus: ["depth", "balance", "control"],
    reviewCue: "Use the same range on each side and finish tall.",
  },
  {
    id: "hip-hinge",
    name: "Hip Hinge / RDL",
    category: "legs",
    dbCategory: "hinge",
    dbSlug: "hip-hinge",
    equipment: ["Bodyweight", "Dumbbells", "Kettlebell", "Barbell"],
    mode: "rep",
    view: "side",
    unilateral: false,
    target: { reps: 10, sets: 3 },
    tempo: "3-1-2-0",
    camera: "Side view from head to feet",
    setupCue: "Turn side-on so your hips and shoulders are visible.",
    keyJoints: hipTriplet,
    measure: angleMeasure("shoulder", "hip", "knee", "best"),
    restAngle: 172,
    activeAngle: 95,
    minRepFraction: 0.6,
    formChecks: [
      hingeKneeCheck("Push your hips back, not down."),
      depthCheck("Hinge a touch further — feel it in the hamstrings.", 0.6),
    ],
    focus: ["hip_pattern", "tempo", "control"],
    reviewCue: "Keep the hinge smooth and drive the hips to stand tall.",
  },
  {
    id: "glute-bridge",
    name: "Glute Bridge",
    category: "legs",
    dbCategory: "other",
    dbSlug: null,
    equipment: ["Bodyweight", "Dumbbells"],
    mode: "rep",
    view: "side",
    unilateral: false,
    target: { reps: 12, sets: 3 },
    tempo: "2-1-1-1",
    camera: "Side view lying down, hips and knees visible",
    setupCue: "Lie side-on to the camera with knees bent.",
    keyJoints: hipTriplet,
    measure: angleMeasure("shoulder", "hip", "knee", "best"),
    restAngle: 120,
    activeAngle: 173,
    minRepFraction: 0.7,
    formChecks: [depthCheck("Squeeze all the way up to a straight line.", 0.7)],
    focus: ["range", "control", "tempo"],
    reviewCue: "Drive the hips fully up and pause at the top.",
  },
  // ------------------------------------------------------------------ PUSH
  {
    id: "push-up",
    name: "Push-up",
    category: "push",
    dbCategory: "push_up",
    dbSlug: "strict-push-up",
    equipment: ["Bodyweight"],
    mode: "rep",
    view: "side",
    unilateral: false,
    target: { reps: 8, sets: 3 },
    tempo: "2-1-1-0",
    camera: "Side view — shoulders, hips, and ankles visible",
    setupCue: "Set a straight line from shoulders to ankles.",
    keyJoints: [...elbowTriplet, "hip", "ankle"],
    measure: angleMeasure("shoulder", "elbow", "wrist", "best"),
    restAngle: 165,
    activeAngle: 88,
    minRepFraction: 0.7,
    formChecks: [
      bodyLineCheck(
        "Lift your hips into one straight line.",
        "Drop your hips level with your shoulders.",
      ),
      depthCheck("Lower a little more — chest toward the floor.", 0.7),
    ],
    focus: ["line", "depth", "tempo"],
    reviewCue: "Hold the body line steady as the reps get harder.",
  },
  {
    id: "overhead-press",
    name: "Overhead Press",
    category: "push",
    dbCategory: "other",
    dbSlug: null,
    equipment: ["Dumbbells", "Barbell"],
    mode: "rep",
    view: "front",
    unilateral: false,
    target: { reps: 8, sets: 3 },
    tempo: "1-1-2-0",
    camera: "Front view, shoulders and arms visible",
    setupCue: "Face the camera with weights at your shoulders.",
    keyJoints: elbowTriplet,
    measure: angleMeasure("shoulder", "elbow", "wrist", "best"),
    restAngle: 82,
    activeAngle: 172,
    minRepFraction: 0.8,
    formChecks: [
      torsoStillCheck("Keep your ribs down — don't lean back.", 20),
      depthCheck("Press all the way up until your arms are straight.", 0.8),
    ],
    focus: ["lockout", "control", "tempo"],
    reviewCue: "Finish each rep locked out with the weight over your shoulders.",
  },
  {
    id: "lateral-raise",
    name: "Lateral Raise",
    category: "push",
    dbCategory: "other",
    dbSlug: null,
    equipment: ["Dumbbells"],
    mode: "rep",
    view: "front",
    unilateral: false,
    target: { reps: 12, sets: 3 },
    tempo: "1-1-2-0",
    camera: "Front view, both arms visible",
    setupCue: "Face the camera with arms at your sides.",
    keyJoints: ["hip", "shoulder", "elbow"],
    measure: abductionMeasure,
    restAngle: 14,
    activeAngle: 88,
    minRepFraction: 0.62,
    formChecks: [
      topHeightCheck(
        "Lift to shoulder height, no higher.",
        (pose) => abductionMeasure(pose)?.angle ?? null,
        104,
      ),
      torsoStillCheck("No swinging — control it up and down.", 20),
    ],
    focus: ["range", "control", "tempo"],
    reviewCue: "Lead with your elbows and stop at shoulder height.",
  },
  // ------------------------------------------------------------------ PULL
  {
    id: "bicep-curl",
    name: "Bicep Curl",
    category: "pull",
    dbCategory: "other",
    dbSlug: null,
    equipment: ["Dumbbells", "Barbell", "Bands"],
    mode: "rep",
    view: "side",
    unilateral: false,
    target: { reps: 10, sets: 3 },
    tempo: "2-1-2-0",
    camera: "Side or front view, elbow to wrist visible",
    setupCue: "Stand tall with arms extended at your sides.",
    keyJoints: elbowTriplet,
    measure: angleMeasure("shoulder", "elbow", "wrist", "best"),
    restAngle: 158,
    activeAngle: 50,
    minRepFraction: 0.65,
    formChecks: [
      elbowDriftCheck("Keep your elbows pinned to your sides."),
      torsoStillCheck("Still torso — let only your forearms move.", 20),
    ],
    focus: ["range", "control", "tempo"],
    reviewCue: "Straighten fully at the bottom and squeeze at the top.",
  },
  {
    id: "bent-over-row",
    name: "Bent-over Row",
    category: "pull",
    dbCategory: "other",
    dbSlug: null,
    equipment: ["Dumbbells", "Barbell", "Kettlebell"],
    mode: "rep",
    view: "side",
    unilateral: false,
    target: { reps: 10, sets: 3 },
    tempo: "1-1-2-0",
    camera: "Side view, torso and arms visible",
    setupCue: "Hinge forward and hold a steady flat-back position.",
    keyJoints: elbowTriplet,
    measure: angleMeasure("shoulder", "elbow", "wrist", "best"),
    restAngle: 160,
    activeAngle: 70,
    minRepFraction: 0.55,
    formChecks: [depthCheck("Drive your elbows back to your hips.", 0.55)],
    focus: ["range", "control", "tempo"],
    reviewCue: "Keep the torso steady and pull with the elbows.",
  },
  // ------------------------------------------------------------------ CORE
  {
    id: "front-plank",
    name: "Front Plank",
    category: "core",
    dbCategory: "plank",
    dbSlug: "front-plank",
    equipment: ["Bodyweight"],
    mode: "hold",
    view: "side",
    unilateral: false,
    target: { seconds: 40, sets: 2 },
    tempo: "hold",
    camera: "Side view — shoulders, hips, and ankles visible",
    setupCue: "Frame your full side profile before you start.",
    keyJoints: bodyTriplet,
    measure: angleMeasure("shoulder", "hip", "ankle", "best"),
    restAngle: 180,
    activeAngle: 150,
    minRepFraction: 1,
    holdBand: [158, 182],
    holdMeasure: (pose) => {
      const m = angleMeasure("shoulder", "hip", "ankle", "best")(pose);
      return m ? { angle: m.angle, quality: m.quality } : null;
    },
    formChecks: [
      bodyLineCheck(
        "Squeeze your glutes and lift your hips into one line.",
        "Drop your hips down, long and level.",
      ),
    ],
    focus: ["hold_time", "control", "line"],
    reviewCue: "Hold a long, level line and keep the timer honest.",
  },
  {
    id: "crunch",
    name: "Crunch",
    category: "core",
    dbCategory: "other",
    dbSlug: null,
    equipment: ["Bodyweight"],
    mode: "rep",
    view: "side",
    unilateral: false,
    target: { reps: 15, sets: 3 },
    tempo: "2-1-1-0",
    camera: "Side view lying down, torso and knees visible",
    setupCue: "Lie side-on to the camera with knees bent.",
    keyJoints: hipTriplet,
    measure: angleMeasure("shoulder", "hip", "knee", "best"),
    restAngle: 125,
    activeAngle: 72,
    minRepFraction: 0.45,
    formChecks: [depthCheck("Peel your shoulder blades off the floor.", 0.45)],
    focus: ["range", "control", "tempo"],
    reviewCue: "Curl up from the chest and lower with control.",
  },
];

export const MOVEMENT_MAP: Record<string, MovementDef> = Object.fromEntries(
  MOVEMENTS.map((m) => [m.id, m]),
);

export const CATEGORY_LABEL: Record<MovementDef["category"], string> = {
  push: "Push",
  pull: "Pull",
  legs: "Legs",
  core: "Core",
};

export const CATEGORY_ORDER: MovementDef["category"][] = ["legs", "push", "pull", "core"];

export function getMovement(id: string): MovementDef {
  return MOVEMENT_MAP[id] ?? MOVEMENTS[0];
}

export function movementsByCategory(): Array<{
  category: MovementDef["category"];
  label: string;
  items: MovementDef[];
}> {
  return CATEGORY_ORDER.map((category) => ({
    category,
    label: CATEGORY_LABEL[category],
    items: MOVEMENTS.filter((m) => m.category === category),
  }));
}
