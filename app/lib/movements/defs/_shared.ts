// Shared building blocks for the exercise definition files.
//
// The rep-driving `angleMeasure` factory (moved here from the old monolithic
// registry) plus the common joint triplets and small helpers used across every
// category file. Keeping this pure and dependency-light means the category defs
// stay declarative and easy to audit against kinesiology references.

import {
  jointAngle,
  jointPoint,
  visibilityOf,
  type Pose,
  type Side,
} from "../../pose/landmarks";
import type { JointName } from "../../pose/landmarks";
import type { ExerciseEntry, MovementMeasure } from "../types";

const OTHER_SIDE: Record<Side, Side> = { left: "right", right: "left" };

// Build a rep-driving angle measure from a joint triplet. `prefer` decides how
// to pick between the left/right sides each frame:
//   best = highest visibility (side-on lifts), min/max = most/least flexed.
export function angleMeasure(
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
        const quality =
          (visibilityOf(pa) + visibilityOf(pb) + visibilityOf(pc)) / 3;
        const angle = jointAngle(pa, pb, pc);
        return { side, angle, quality };
      })
      .filter(
        (r): r is { side: Side; angle: number; quality: number } =>
          r.angle !== null && r.quality >= 0.4,
      );
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

// Horizontal-adduction driver for the fly family (chest fly, pec deck,
// reverse fly). The angle at the working shoulder between the forearm-side
// elbow and the OPPOSITE shoulder: arms open wide reads ~160-175°, arms
// squeezed together in front reads ~90-100°. This works in true 3D from any
// camera view — unlike hip/shoulder/elbow, which stays ~90° through the whole
// fly arc (abduction and flexion are the same angle off the torso axis).
export function crossBodyMeasure(): (pose: Pose) => MovementMeasure | null {
  return (pose) => {
    const sides: Side[] = ["left", "right"];
    const results = sides
      .map((side) => {
        const elbow = jointPoint(pose, side, "elbow");
        const shoulder = jointPoint(pose, side, "shoulder");
        const opposite = jointPoint(pose, OTHER_SIDE[side], "shoulder");
        const quality =
          (visibilityOf(elbow) + visibilityOf(shoulder) + visibilityOf(opposite)) / 3;
        const angle = jointAngle(elbow, shoulder, opposite);
        return { side, angle, quality };
      })
      .filter(
        (r): r is { side: Side; angle: number; quality: number } =>
          r.angle !== null && r.quality >= 0.4,
      );
    if (!results.length) return null;
    let chosen = results[0];
    for (const r of results) if (r.quality > chosen.quality) chosen = r;
    return { angle: chosen.angle, side: chosen.side, quality: chosen.quality };
  };
}

// Common joint triplets reused across movements.
export const kneeTriplet: JointName[] = ["hip", "knee", "ankle"];
export const elbowTriplet: JointName[] = ["shoulder", "elbow", "wrist"];
export const hipTriplet: JointName[] = ["shoulder", "hip", "knee"];
export const bodyTriplet: JointName[] = ["shoulder", "hip", "ankle"];

// Convenience: assemble the two lookup maps from a flat list of entries.
export function collect(entries: ExerciseEntry[]): ExerciseEntry[] {
  return entries;
}
