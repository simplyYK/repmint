// Synthetic validation of the rep engine (no camera needed).
// Feeds fabricated joint-angle streams through RepEngine and checks counts.
import { RepEngine } from "../app/lib/tracking/repEngine";
import { getMovement } from "../app/lib/movements/registry";
import type { MovementMeasure } from "../app/lib/movements/types";

type Case = { name: string; movementId: string; angles: number[]; expect: number };

const fps = 30;
const dt = 1000 / fps;

// Build a smooth angle wave between `top` and `bottom` over `nReps` reps,
// with `frames` frames per half-stroke.
function reps(top: number, bottom: number, nReps: number, frames = 12): number[] {
  const out: number[] = [];
  for (let r = 0; r < nReps; r++) {
    for (let i = 0; i <= frames; i++) out.push(top + ((bottom - top) * i) / frames); // down
    for (let i = 0; i <= frames; i++) out.push(bottom + ((top - bottom) * i) / frames); // up
    for (let i = 0; i < 4; i++) out.push(top); // brief pause at top between reps
  }
  return out;
}

const cases: Case[] = [
  { name: "squat x5 full depth", movementId: "squat", angles: reps(172, 82, 5), expect: 5 },
  { name: "squat x3 shallow (partial, should not count)", movementId: "squat", angles: reps(172, 135, 3), expect: 0 },
  { name: "pushup x8", movementId: "push-up", angles: reps(165, 85, 8), expect: 8 },
  { name: "curl x10", movementId: "bicep-curl", angles: reps(158, 48, 10), expect: 10 },
  { name: "overhead press x6 (inverted: angle grows under load)", movementId: "overhead-press", angles: reps(82, 172, 6), expect: 6 },
  { name: "glute bridge x12 (inverted)", movementId: "glute-bridge", angles: reps(118, 172, 12), expect: 12 },
];

let pass = 0;
for (const c of cases) {
  const movement = getMovement(c.movementId);
  const engine = new RepEngine(movement);
  let ts = 0;
  let lastTut = 0;
  for (const angle of c.angles) {
    ts += dt;
    const m: MovementMeasure = { angle, side: "left", quality: 0.9 };
    const frame = engine.update(m, ts);
    lastTut = frame.tutSeconds;
  }
  const got = engine.repCount;
  const ok = got === c.expect;
  if (ok) pass++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${c.name}: got ${got}, expected ${c.expect} (tut ~${lastTut.toFixed(1)}s)`);
}
console.log(`\n${pass}/${cases.length} passed`);
process.exit(pass === cases.length ? 0 : 1);
