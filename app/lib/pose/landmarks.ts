// Pose landmark helpers and joint-angle math.
// Coordinates are MediaPipe Pose "normalized" values: x, y in [0, 1] with the
// origin at the top-left of the frame, x increasing to the right, y increasing
// downward. z is roughly in the same scale as x, negative toward the camera.
//
// This module has no MediaPipe or React dependency on purpose. It is pure math
// so it can be unit-reasoned about and reused by the rep engine and form coach.

export type Landmark = {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
};

export type Pose = Landmark[];

// MediaPipe Pose landmark indices (33-point model).
// Ref: https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker
export const LM = {
  nose: 0,
  leftEye: 2,
  rightEye: 5,
  leftEar: 7,
  rightEar: 8,
  leftShoulder: 11,
  rightShoulder: 12,
  leftElbow: 13,
  rightElbow: 14,
  leftWrist: 15,
  rightWrist: 16,
  leftHip: 23,
  rightHip: 24,
  leftKnee: 25,
  rightKnee: 26,
  leftAnkle: 27,
  rightAnkle: 28,
  leftHeel: 29,
  rightHeel: 30,
  leftFootIndex: 31,
  rightFootIndex: 32,
} as const;

// Skeleton pairs used for drawing the overlay.
export const SKELETON: Array<[number, number]> = [
  [LM.leftShoulder, LM.rightShoulder],
  [LM.leftShoulder, LM.leftHip],
  [LM.rightShoulder, LM.rightHip],
  [LM.leftHip, LM.rightHip],
  [LM.leftShoulder, LM.leftElbow],
  [LM.leftElbow, LM.leftWrist],
  [LM.rightShoulder, LM.rightElbow],
  [LM.rightElbow, LM.rightWrist],
  [LM.leftHip, LM.leftKnee],
  [LM.leftKnee, LM.leftAnkle],
  [LM.rightHip, LM.rightKnee],
  [LM.rightKnee, LM.rightAnkle],
  [LM.leftAnkle, LM.leftFootIndex],
  [LM.rightAnkle, LM.rightFootIndex],
];

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function visible(point: Landmark | undefined, threshold = 0.5): boolean {
  return !!point && (point.visibility ?? 1) >= threshold;
}

export function visibilityOf(point: Landmark | undefined): number {
  return point ? point.visibility ?? 1 : 0;
}

/**
 * Interior angle (in degrees) at vertex `b` formed by points a-b-c.
 *
 * Uses full 3D (x, y, z) when every point carries a z estimate, falling back
 * to the 2D (x, y) projection otherwise. The 3D form matters: MediaPipe z is
 * in roughly the same scale as x, and any limb segment moving toward or away
 * from the camera (a curl seen from the front, a fly, a face pull) makes the
 * 2D projected angle collapse far faster than the real anatomical angle —
 * which is how "100% ROM at half a curl" bugs happen. The One-Euro smoother
 * upstream filters z alongside x/y, so the 3D angle is stable enough to coach
 * with. Returns null if any point is missing or degenerate.
 */
export function jointAngle(a?: Landmark, b?: Landmark, c?: Landmark): number | null {
  if (!a || !b || !c) return null;
  const use3d = a.z !== undefined && b.z !== undefined && c.z !== undefined;
  const abx = a.x - b.x;
  const aby = a.y - b.y;
  const abz = use3d ? (a.z as number) - (b.z as number) : 0;
  const cbx = c.x - b.x;
  const cby = c.y - b.y;
  const cbz = use3d ? (c.z as number) - (b.z as number) : 0;
  const abMag = Math.hypot(abx, aby, abz);
  const cbMag = Math.hypot(cbx, cby, cbz);
  if (abMag < 1e-6 || cbMag < 1e-6) return null;
  const cos = clamp((abx * cbx + aby * cby + abz * cbz) / (abMag * cbMag), -1, 1);
  return (Math.acos(cos) * 180) / Math.PI;
}

/**
 * Angle (in degrees) of segment a->b relative to the vertical axis.
 * 0 = perfectly vertical, 90 = horizontal. Useful for torso-lean checks.
 */
export function angleFromVertical(a?: Landmark, b?: Landmark): number | null {
  if (!a || !b) return null;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const mag = Math.hypot(dx, dy);
  if (mag < 1e-6) return null;
  // vertical unit vector is (0, 1) in image space
  const cos = clamp(Math.abs(dy) / mag, -1, 1);
  return (Math.acos(cos) * 180) / Math.PI;
}

export function midpoint(a?: Landmark, b?: Landmark): Landmark | undefined {
  if (!a || !b) return undefined;
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    z: a.z !== undefined && b.z !== undefined ? (a.z + b.z) / 2 : undefined,
    visibility: Math.min(visibilityOf(a), visibilityOf(b)),
  };
}

export function distance(a?: Landmark, b?: Landmark): number | null {
  if (!a || !b) return null;
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export type Side = "left" | "right";

// Which landmark index to use for a joint on a given side.
export const SIDE_JOINTS = {
  left: {
    shoulder: LM.leftShoulder,
    elbow: LM.leftElbow,
    wrist: LM.leftWrist,
    hip: LM.leftHip,
    knee: LM.leftKnee,
    ankle: LM.leftAnkle,
    ear: LM.leftEar,
    foot: LM.leftFootIndex,
    heel: LM.leftHeel,
  },
  right: {
    shoulder: LM.rightShoulder,
    elbow: LM.rightElbow,
    wrist: LM.rightWrist,
    hip: LM.rightHip,
    knee: LM.rightKnee,
    ankle: LM.rightAnkle,
    ear: LM.rightEar,
    foot: LM.rightFootIndex,
    heel: LM.rightHeel,
  },
} as const;

export type JointName = keyof typeof SIDE_JOINTS["left"];

export function jointPoint(pose: Pose, side: Side, joint: JointName): Landmark | undefined {
  return pose[SIDE_JOINTS[side][joint]];
}

/**
 * Choose the better-tracked side for a set of joints by summed visibility.
 * Falls back to "left" when tracking is symmetric.
 */
export function bestSide(pose: Pose, joints: JointName[]): Side {
  const score = (side: Side) =>
    joints.reduce((sum, j) => sum + visibilityOf(jointPoint(pose, side, j)), 0);
  return score("right") > score("left") ? "right" : "left";
}

/**
 * Fraction (0..1) of the given joints that are confidently tracked, across the
 * better side. Used to gate rep counting and form cues so we never coach on a
 * bad frame.
 */
export function trackingQuality(pose: Pose, joints: JointName[]): number {
  const side = bestSide(pose, joints);
  const tracked = joints.filter((j) => visible(jointPoint(pose, side, j), 0.5)).length;
  return joints.length ? tracked / joints.length : 0;
}
