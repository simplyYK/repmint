// Camera setup pre-flight for the live coach.
//
// Why: most "the tracker isn't counting my reps" complaints are really setup
// problems — user half out of frame, too close, facing the wrong way, or in a
// dim room. This module inspects a single pose frame BEFORE the set starts
// and returns plain-language fixes ("Step back", "Turn to your side") so the
// user gets framing right in seconds instead of discovering mid-set that
// their ankles were never visible. Pure geometry over MediaPipe Pose
// landmarks (33-point model: shoulders 11/12, hips 23/24) — no camera, no
// React, no DOM.

import type { Landmark } from "../pose/landmarks";

/** Which way the movement expects the user to face the camera. */
export type ExpectedView = "front" | "side" | "any";

/** Body region the movement needs in frame (mirrors MovementDef.region). */
export type SetupRegion = "upper" | "lower" | "full";

/** One actionable setup problem. */
export type SetupIssue = {
  /** Machine-readable category: framing (joints cut off), distance, view, visibility (lighting). */
  code: "framing" | "distance" | "view" | "visibility";
  /** Plain-language fix, ready to show in the setup HUD. */
  message: string;
};

/** Result of a setup evaluation: ok when there is nothing to fix. */
export type SetupResult = {
  ok: boolean;
  issues: SetupIssue[];
};

// MediaPipe Pose indices used for framing diagnostics.
const LEFT_SHOULDER = 11;
const RIGHT_SHOULDER = 12;
const LEFT_HIP = 23;
const RIGHT_HIP = 24;

// Torso length (mid-shoulder → mid-hip, normalized image units) that reads as
// a good working distance for rep tracking at typical webcam FOVs. Upper-body
// movements (curls, presses, raises) only need the torso and arms in frame,
// so they tolerate standing much closer — forcing "step back" there just
// pushes the athlete's phone across the room for no tracking benefit.
const TORSO_MIN = 0.15;
const TORSO_MAX = 0.45;
const TORSO_MIN_UPPER = 0.13;
const TORSO_MAX_UPPER = 0.62;

// shoulderWidth / torsoLength: wide = facing the camera, narrow = side-on.
const FRONT_RATIO = 0.55;
const SIDE_RATIO = 0.45;

const KEY_VIS = 0.5; // per-joint visibility floor
const MEAN_VIS = 0.6; // mean visibility floor (lighting/contrast proxy)

function vis(lm: Landmark | undefined): number {
  return lm ? lm.visibility ?? 1 : 0;
}

// Human-readable name for a cut-off body region, by landmark index.
function regionName(index: number): string {
  if (index >= 25 && index <= 28) return "ankles/knees";
  if (index === 15 || index === 16) return "hands";
  if (index === 0) return "head";
  if (index === LEFT_SHOULDER || index === RIGHT_SHOULDER) return "shoulders";
  if (index === LEFT_HIP || index === RIGHT_HIP) return "hips";
  return "body";
}

function midpoint(a: Landmark, b: Landmark): { x: number; y: number } {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/**
 * Evaluate one pose frame for camera setup quality.
 *
 * Checks, in order:
 * 1. **Framing** — every key joint must have visibility > 0.5; cut-off joints
 *    are named by region ("ankles/knees", "hands", "head") in the message.
 * 2. **Distance** — normalized torso length (mid-shoulder → mid-hip) must sit
 *    in 0.15–0.45. Shorter reads as too far ("Step closer"), longer as too
 *    close ("Step back").
 * 3. **View** — shoulderWidth/torsoLength > 0.55 reads as facing the camera,
 *    < 0.45 as side-on; in between, either expectation passes. Compared
 *    against `expectedView` ("any" always passes).
 * 4. **Visibility** — mean key-joint visibility < 0.6 suggests a lighting or
 *    contrast problem even when nothing is fully cut off.
 *
 * @param landmarks Full pose landmark array (MediaPipe 33-point, normalized).
 * @param keyJointIndices Landmark indices this movement needs tracked.
 * @param expectedView Camera view the movement is designed for.
 * @param region Body region the movement needs in frame ("upper" relaxes the
 *   working-distance band so close, upper-body-only framing passes).
 * @returns `ok: true` with no issues, or every applicable fix.
 */
export function evaluateSetup(
  landmarks: Landmark[],
  keyJointIndices: number[],
  expectedView: ExpectedView,
  region: SetupRegion = "full",
): SetupResult {
  const issues: SetupIssue[] = [];

  if (!landmarks.length) {
    return {
      ok: false,
      issues: [{ code: "framing", message: "Step into frame so the camera can see you." }],
    };
  }

  // 1. Framing: every key joint confidently in frame.
  const missingRegions: string[] = [];
  for (const idx of keyJointIndices) {
    if (vis(landmarks[idx]) <= KEY_VIS) {
      const region = regionName(idx);
      if (!missingRegions.includes(region)) missingRegions.push(region);
    }
  }
  if (missingRegions.length > 0) {
    issues.push({
      code: "framing",
      message: `Adjust the camera so your ${missingRegions.join(" and ")} are in frame.`,
    });
  }

  // 2 & 3 need a measurable torso.
  const ls = landmarks[LEFT_SHOULDER];
  const rs = landmarks[RIGHT_SHOULDER];
  const lh = landmarks[LEFT_HIP];
  const rh = landmarks[RIGHT_HIP];
  const torsoVisible = vis(ls) > KEY_VIS && vis(rs) > KEY_VIS && vis(lh) > KEY_VIS && vis(rh) > KEY_VIS;

  if (torsoVisible) {
    const midShoulder = midpoint(ls, rs);
    const midHip = midpoint(lh, rh);
    const torsoLen = Math.hypot(midShoulder.x - midHip.x, midShoulder.y - midHip.y);

    // 2. Distance (relaxed band for upper-body-only movements).
    const minTorso = region === "upper" ? TORSO_MIN_UPPER : TORSO_MIN;
    const maxTorso = region === "upper" ? TORSO_MAX_UPPER : TORSO_MAX;
    if (torsoLen < minTorso) {
      issues.push({ code: "distance", message: "Step closer to the camera." });
    } else if (torsoLen > maxTorso) {
      issues.push({ code: "distance", message: "Step back so your whole movement fits in frame." });
    }

    // 3. View orientation.
    if (expectedView !== "any" && torsoLen > 1e-6) {
      const shoulderWidth = Math.hypot(ls.x - rs.x, ls.y - rs.y);
      const ratio = shoulderWidth / torsoLen;
      const reads: ExpectedView | null = ratio > FRONT_RATIO ? "front" : ratio < SIDE_RATIO ? "side" : null;
      if (reads !== null && reads !== expectedView) {
        issues.push({
          code: "view",
          message:
            expectedView === "side"
              ? "Turn to show the camera your side."
              : "Turn to face the camera.",
        });
      }
    }
  }

  // 4. Overall visibility as a lighting/contrast proxy.
  if (keyJointIndices.length > 0) {
    const meanVis =
      keyJointIndices.reduce((sum, idx) => sum + vis(landmarks[idx]), 0) / keyJointIndices.length;
    if (meanVis < MEAN_VIS) {
      issues.push({ code: "visibility", message: "Improve lighting or contrast so the camera can track you." });
    }
  }

  return { ok: issues.length === 0, issues };
}
