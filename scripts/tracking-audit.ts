// Unit-level audit of RepMint's tracking math (3D joint angles + per-exercise
// ROM thresholds). Run with: npx tsx scripts/tracking-audit.ts
//
// 1. Proves the bicep-curl root cause: the 2D projected elbow angle collapses
//    far faster than the true anatomical angle when the forearm moves toward
//    the camera; the 3D jointAngle tracks truth.
// 2. Runs EVERY tier 1/2 rep movement's config through the RepEngine with
//    synthetic angle streams: a full-ROM rep must count exactly once, a
//    half-ROM rep must NOT count, a rep just past the counting gate must
//    count, and tempo phase timings must be sane.
// 3. Sanity-checks per-rep quality scoring.

import { jointAngle, type Landmark } from "../app/lib/pose/landmarks";
import { MOVEMENT_LIST } from "../app/lib/movements/defs/index";
import { RepEngine, type RepEvent } from "../app/lib/tracking/repEngine";
import { scoreRep } from "../app/lib/tracking/repQuality";

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  if (!ok) {
    failures++;
    console.log(`  FAIL  ${name}${detail ? " — " + detail : ""}`);
  }
}

// ---------------------------------------------------------------------------
// 1. Front-view curl: 2D collapse vs 3D truth
// ---------------------------------------------------------------------------
console.log("1) 2D vs 3D elbow angle on a front-view curl");
// Shoulder above elbow (upper arm vertical, in the image plane). Forearm of
// length 0.2 swings from hanging straight down (flexion 0°) up toward the
// camera in the sagittal plane (y-z plane).
const shoulder: Landmark = { x: 0.5, y: 0.3, z: 0 };
const elbow: Landmark = { x: 0.5, y: 0.5, z: 0 };
const FOREARM = 0.2;
for (const flexionDeg of [0, 45, 90, 120, 135]) {
  const anatomical = 180 - flexionDeg; // true elbow angle
  const phi = (flexionDeg * Math.PI) / 180;
  // Wrist rotates in the y-z plane: down (+y) toward the camera (-z).
  const wrist: Landmark = {
    x: 0.5,
    y: 0.5 + FOREARM * Math.cos(phi),
    z: 0 - FOREARM * Math.sin(phi),
  };
  const with3d = jointAngle(shoulder, elbow, wrist)!;
  // At exactly 90° flexion the 2D projection is degenerate (the wrist lands on
  // the elbow in the image) — the collapse at its purest.
  const only2d = jointAngle(
    { x: shoulder.x, y: shoulder.y },
    { x: elbow.x, y: elbow.y },
    { x: wrist.x, y: wrist.y },
  );
  console.log(
    `  flexion ${String(flexionDeg).padStart(3)}° → true ${anatomical}°, 3D ${with3d.toFixed(1)}°, 2D-only ${only2d === null ? "degenerate" : only2d.toFixed(1) + "°"}`,
  );
  check(`3D angle tracks anatomical at ${flexionDeg}° flexion`, Math.abs(with3d - anatomical) < 1.5);
}
// The old bug in one line: just past 90° flexion (half a curl) the 2D-only
// angle flips through degenerate to ~0° → depth (165-0)/120 ≈ 1.35 → ROM
// pegged >100% at half a curl. The 3D angle never does this.

// ---------------------------------------------------------------------------
// 2. Every rep movement: full rep counts once, half rep never counts
// ---------------------------------------------------------------------------
console.log("\n2) RepEngine gates for every tier 1/2 movement");

function simulateRep(movementId: string, fraction: number): { reps: number; event: RepEvent | null } {
  const move = MOVEMENT_LIST.find((m) => m.id === movementId)!;
  const engine = new RepEngine(move);
  const { restAngle, activeAngle } = move;
  const target = restAngle + (activeAngle - restAngle) * fraction;
  const fps = 30;
  let t = 0;
  let lastEvent: RepEvent | null = null;
  let reps = 0;
  const feed = (angle: number) => {
    t += 1000 / fps;
    const frame = engine.update({ angle, side: "left", quality: 1 }, t);
    if (frame.repEvent) {
      lastEvent = frame.repEvent;
      reps = frame.reps;
    }
  };
  // settle at rest 0.5s → descend 1s → hold 0.3s → ascend 1s → settle 0.5s
  for (let i = 0; i < 15; i++) feed(restAngle);
  for (let i = 1; i <= 30; i++) feed(restAngle + (target - restAngle) * (i / 30));
  for (let i = 0; i < 9; i++) feed(target);
  for (let i = 29; i >= 0; i--) feed(restAngle + (target - restAngle) * (i / 30));
  for (let i = 0; i < 15; i++) feed(restAngle);
  return { reps, event: lastEvent };
}

const repMovements = MOVEMENT_LIST.filter((m) => m.mode === "rep");
console.log(
  `  auditing ${repMovements.length} rep-mode movements (+${MOVEMENT_LIST.length - repMovements.length} hold-mode)`,
);
for (const move of repMovements) {
  const full = simulateRep(move.id, 1.0);
  check(`${move.id}: full-ROM rep counts exactly once`, full.reps === 1, `got ${full.reps}`);
  if (full.event) {
    // Synthetic rep: ~1s descent + 0.3s hold + ~1s ascent, measured between
    // rest-zone crossings — so ~1.9-2.1s duration with real eccentric time.
    check(
      `${move.id}: full rep tempo sane`,
      full.event.durationSeconds >= 1.8 &&
        full.event.durationSeconds <= 2.6 &&
        full.event.eccentricSeconds >= 0.3 &&
        full.event.concentricSeconds >= 0.6 &&
        full.event.pauseSeconds <= 1.5,
      JSON.stringify(full.event),
    );
    check(`${move.id}: peakDepth ≈ 1`, Math.abs(full.event.peakDepth - 1) < 0.08, String(full.event.peakDepth));
  }
  const half = simulateRep(move.id, 0.5);
  check(
    `${move.id}: HALF rep must NOT count (minFrac=${move.minRepFraction})`,
    half.reps === 0,
    `got ${half.reps}`,
  );
  // A rep just past the counting gate should count (full ROM stays reachable).
  const atGate = simulateRep(move.id, Math.min(1, move.minRepFraction + 0.08));
  check(`${move.id}: rep just past the gate counts`, atGate.reps === 1, `got ${atGate.reps}`);
}

// ---------------------------------------------------------------------------
// 3. Rep quality scoring still sane
// ---------------------------------------------------------------------------
console.log("\n3) Rep quality scoring");
const q = scoreRep({
  peakDepth: 1,
  minFrac: 0.75,
  tutSeconds: 4,
  tutTargetSeconds: 4,
  concentricSeconds: 1,
  severity1Faults: 0,
  severity2Faults: 0,
});
check("perfect rep scores ≥ 95", q.score >= 95, String(q.score));
const shallow = scoreRep({
  peakDepth: 0.78,
  minFrac: 0.75,
  tutSeconds: 4,
  tutTargetSeconds: 4,
  concentricSeconds: 1,
  severity1Faults: 0,
  severity2Faults: 0,
});
check("barely-counted rep scores noticeably lower", shallow.score < q.score - 10, `${shallow.score} vs ${q.score}`);

// ---------------------------------------------------------------------------
// 4. Range calibration: an athlete whose MEASURED range is offset from config
//    (straighter rest, sensor-compressed peak — the MediaPipe z-noise reality)
//    must still count reps, reach ~100% ROM on the bar, and never get credit
//    for half reps even after the range adapts to them.
// ---------------------------------------------------------------------------
console.log("\n4) Per-athlete range calibration (offset-athlete scenario, every movement)");

function runCalibrationScenario(moveId: string) {
  const move = MOVEMENT_LIST.find((m) => m.id === moveId)!;
  const engine = new RepEngine(move);
  const span = move.activeAngle - move.restAngle;
  // This athlete rests BEYOND the config rest (e.g. straighter arm) and their
  // sensor-measured full ROM stops 10% short of the config target.
  const athleteRest = move.restAngle - 0.1 * span;
  const athleteActive = athleteRest + 0.9 * span;
  const fps = 30;
  let t = 0;
  let reps = 0;
  const feed = (angle: number) => {
    t += 1000 / fps;
    const frame = engine.update({ angle, side: "left", quality: 1 }, t);
    reps = frame.reps;
    return frame;
  };
  const doRep = (toAngle: number) => {
    for (let i = 1; i <= 30; i++) feed(athleteRest + (toAngle - athleteRest) * (i / 30));
    for (let i = 0; i < 9; i++) feed(toAngle);
    for (let i = 29; i >= 0; i--) feed(athleteRest + (toAngle - athleteRest) * (i / 30));
    for (let i = 0; i < 15; i++) feed(athleteRest);
  };

  // Phase 1: 3s idle at the athlete's own rest — restCal converges, no phantom reps.
  let idleFrame = feed(athleteRest);
  for (let i = 0; i < 90; i++) idleFrame = feed(athleteRest);
  check(`${move.id}: idle at athlete rest reads ~0 depth`, Math.abs(idleFrame.depth) <= 0.12, String(idleFrame.depth));
  check(`${move.id}: idle creates no phantom reps`, reps === 0, `got ${reps}`);

  // Phase 2: first full (athlete-range) rep counts, despite the offset.
  doRep(athleteActive);
  check(`${move.id}: offset athlete's full rep counts`, reps === 1, `got ${reps}`);

  // Phase 3: after one counted rep the bar reads ~100% at THEIR full range.
  for (let i = 0; i < 15; i++) feed(athleteRest);
  let peakFrame = feed(athleteActive);
  for (let i = 0; i < 5; i++) peakFrame = feed(athleteActive);
  check(
    `${move.id}: calibrated bar reaches ≥93% at athlete's full ROM`,
    peakFrame.depth >= 0.93,
    peakFrame.depth.toFixed(3),
  );
  // walk back home so the machine settles (this may legitimately count a rep)
  for (let i = 29; i >= 0; i--) feed(athleteRest + (athleteActive - athleteRest) * (i / 30));
  for (let i = 0; i < 15; i++) feed(athleteRest);
  const repsAfterProbe = reps;

  // Phase 4: HALF of the athlete's own range still never counts (for movements
  // with an honest gate; ≤0.5-gate movements are deliberately lenient).
  if (move.minRepFraction >= 0.55) {
    doRep(athleteRest + 0.45 * span);
    check(`${move.id}: half rep still never counts post-calibration`, reps === repsAfterProbe, `got ${reps} vs ${repsAfterProbe}`);
  }

  // Phase 5: another full rep still counts.
  doRep(athleteActive);
  check(`${move.id}: full rep still counts post-calibration`, reps === repsAfterProbe + 1, `got ${reps}`);
}

for (const move of repMovements) runCalibrationScenario(move.id);

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
