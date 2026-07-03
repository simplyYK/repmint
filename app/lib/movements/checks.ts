// Reusable form-check factories. Each returns a FormCheck that measures joint
// angles / landmark positions from the current frame and yields either a
// supportive cue (fault), an "ok" (measured and clean), or null (can't measure
// confidently this frame — stay quiet rather than guess).
//
// Thresholds come from mainstream strength-coaching technique standards
// (NSCA / ACE / NASM and coaching references). They are intentionally widened
// a little from textbook ideals to tolerate single-camera landmark jitter, and
// every cue is framed as a practical form tip — never a medical/injury claim.

import {
  angleFromVertical,
  distance,
  jointAngle,
  jointPoint,
  LM,
  visibilityOf,
} from "../pose/landmarks";
import type { FormCheck, PoseContext } from "./types";

const VIS = 0.4;

// ---- Depth / range of motion --------------------------------------------
// Fires at the bottom of the rep if the range reached was too shallow.
export function depthCheck(cue: string, minFraction: number): FormCheck {
  return {
    id: "depth",
    when: "bottom",
    evaluate: (ctx) => {
      if (ctx.quality < 0.5) return null;
      if (ctx.peakDepth < minFraction) {
        return { ok: false, cue, severity: 1, signal: "short_range" };
      }
      return { ok: true };
    },
  };
}

// ---- Plank / push-up body line ------------------------------------------
// Signed offset of the hip from the shoulder->ankle line, normalized by body
// length. Positive = hips sag toward the floor, negative = hips pike up.
export function bodyLineCheck(sagCue: string, pikeCue: string, tol = 0.1): FormCheck {
  return {
    id: "body_line",
    when: "always",
    evaluate: (ctx) => {
      const sh = jointPoint(ctx.pose, ctx.side, "shoulder");
      const hip = jointPoint(ctx.pose, ctx.side, "hip");
      const ank = jointPoint(ctx.pose, ctx.side, "ankle");
      if (
        visibilityOf(sh) < VIS ||
        visibilityOf(hip) < VIS ||
        visibilityOf(ank) < VIS
      )
        return null;
      const bodyLen = distance(sh, ank);
      if (!bodyLen || bodyLen < 0.15) return null; // too small = unreliable
      const dx = ank!.x - sh!.x;
      const expectedY =
        Math.abs(dx) > 1e-3
          ? sh!.y + ((hip!.x - sh!.x) / dx) * (ank!.y - sh!.y)
          : (sh!.y + ank!.y) / 2;
      const dev = (hip!.y - expectedY) / bodyLen;
      if (dev > tol) return { ok: false, cue: sagCue, severity: 2, signal: "hip_sag" };
      if (dev < -tol) return { ok: false, cue: pikeCue, severity: 1, signal: "hip_pike" };
      return { ok: true };
    },
  };
}

// ---- Torso lean (squat / lunge stay tall) -------------------------------
export function torsoLeanCheck(
  cue: string,
  maxLean: number,
  gate: [number, number] = [0.35, 1.2],
): FormCheck {
  return {
    id: "torso_lean",
    when: "always",
    evaluate: (ctx) => {
      if (ctx.depth < gate[0] || ctx.depth > gate[1]) return { ok: true };
      const sh = jointPoint(ctx.pose, ctx.side, "shoulder");
      const hip = jointPoint(ctx.pose, ctx.side, "hip");
      if (visibilityOf(sh) < VIS || visibilityOf(hip) < VIS) return null;
      const lean = angleFromVertical(sh, hip);
      if (lean === null) return null;
      if (lean > maxLean) return { ok: false, cue, severity: 1, signal: "torso_lean" };
      return { ok: true };
    },
  };
}

// ---- Knee valgus (front view): knees caving narrower than the ankles -----
export function kneeValgusCheck(cue: string): FormCheck {
  return {
    id: "knee_valgus",
    when: "bottom",
    evaluate: (ctx) => {
      const lk = ctx.pose[LM.leftKnee];
      const rk = ctx.pose[LM.rightKnee];
      const la = ctx.pose[LM.leftAnkle];
      const ra = ctx.pose[LM.rightAnkle];
      if (
        visibilityOf(lk) < 0.5 ||
        visibilityOf(rk) < 0.5 ||
        visibilityOf(la) < 0.5 ||
        visibilityOf(ra) < 0.5
      )
        return null;
      const ankleWidth = Math.abs(la!.x - ra!.x);
      const kneeWidth = Math.abs(lk!.x - rk!.x);
      // Only meaningful from a front-ish view where the feet are clearly apart.
      if (ankleWidth < 0.06) return null;
      if (kneeWidth < ankleWidth * 0.72) {
        return { ok: false, cue, severity: 1, signal: "knee_valgus" };
      }
      return { ok: true };
    },
  };
}

// ---- Elbow drift (curls: keep the upper arm vertical) --------------------
export function elbowDriftCheck(cue: string, maxLean = 30): FormCheck {
  return {
    id: "elbow_drift",
    when: "always",
    evaluate: (ctx) => {
      if (ctx.depth < 0.2 || ctx.depth > 0.95) return { ok: true };
      const sh = jointPoint(ctx.pose, ctx.side, "shoulder");
      const el = jointPoint(ctx.pose, ctx.side, "elbow");
      if (visibilityOf(sh) < VIS || visibilityOf(el) < VIS) return null;
      const lean = angleFromVertical(sh, el);
      if (lean === null) return null;
      if (lean > maxLean) return { ok: false, cue, severity: 1, signal: "elbow_drift" };
      return { ok: true };
    },
  };
}

// ---- Torso still / no lean-back (standing curls & presses) ---------------
export function torsoStillCheck(cue: string, maxLean = 22): FormCheck {
  return {
    id: "torso_still",
    when: "always",
    evaluate: (ctx) => {
      if (ctx.depth < 0.25) return { ok: true };
      const sh = jointPoint(ctx.pose, ctx.side, "shoulder");
      const hip = jointPoint(ctx.pose, ctx.side, "hip");
      if (visibilityOf(sh) < VIS || visibilityOf(hip) < VIS) return null;
      const lean = angleFromVertical(sh, hip);
      if (lean === null) return null;
      if (lean > maxLean) return { ok: false, cue, severity: 1, signal: "torso_swing" };
      return { ok: true };
    },
  };
}

// ---- Hip-hinge knee discipline: don't turn the hinge into a squat --------
export function hingeKneeCheck(cue: string): FormCheck {
  return {
    id: "hinge_knee",
    when: "always",
    evaluate: (ctx) => {
      if (ctx.depth < 0.4) return { ok: true };
      const sh = jointPoint(ctx.pose, ctx.side, "shoulder");
      const hip = jointPoint(ctx.pose, ctx.side, "hip");
      const knee = jointPoint(ctx.pose, ctx.side, "knee");
      const ankle = jointPoint(ctx.pose, ctx.side, "ankle");
      if (
        visibilityOf(hip) < VIS ||
        visibilityOf(knee) < VIS ||
        visibilityOf(ankle) < VIS ||
        visibilityOf(sh) < VIS
      )
        return null;
      const hipAngle = jointAngle(sh, hip, knee);
      const kneeAngle = jointAngle(hip, knee, ankle);
      if (hipAngle === null || kneeAngle === null) return null;
      const hipFlex = 180 - hipAngle;
      const kneeFlex = 180 - kneeAngle;
      // In a hinge the hips flex far more than the knees.
      if (hipFlex > 25 && kneeFlex > hipFlex * 0.7) {
        return { ok: false, cue, severity: 1, signal: "too_much_knee" };
      }
      return { ok: true };
    },
  };
}

// ---- Overhead height cap (lateral raise): don't lift past shoulder -------
export function topHeightCheck(
  cue: string,
  measure: (pose: PoseContext["pose"]) => number | null,
  maxAngle: number,
): FormCheck {
  return {
    id: "top_height",
    when: "bottom",
    evaluate: (ctx) => {
      if (ctx.quality < 0.5) return null;
      const angle = measure(ctx.pose);
      if (angle === null) return null;
      if (angle > maxAngle) return { ok: false, cue, severity: 1, signal: "too_high" };
      return { ok: true };
    },
  };
}
