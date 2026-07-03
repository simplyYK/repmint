# RepMint

Your AI camera coach for goal-based training — a personal trainer in your pocket.

RepMint uses your phone or laptop camera to count reps, track time under tension
and tempo, and give one live form cue at a time, then reviews each set and tracks
progress over time. It's coaching software, not clinical guidance.

## Features

- **Live camera coach** — in-browser pose estimation (MediaPipe Pose, 33-point
  full-body model) with a skeleton overlay.
- **Rep counting** — a depth-normalized state machine with hysteresis, a
  range-of-motion gate (partial reps don't count), and a refractory window so
  jitter can't double-count. Works for movements where the joint angle shrinks
  under load (squat, curl) and where it grows (press, glute bridge).
- **Time under tension & tempo** — per-rep eccentric / pause / concentric timing
  and set-level TUT.
- **Real-time form coach** — per-exercise checks turn joint angles into calm,
  supportive cues ("Sit a little deeper", "Lift your hips into one line"),
  debounced so you get one cue at a time. Thresholds follow mainstream
  strength-coaching technique standards (NSCA / ACE / NASM).
- **Progress & memory** — local-first history, plus optional Supabase sync of
  profiles, sessions, sets, per-rep events and form signals.

## Exercise library

Movements are pure config in [`app/lib/movements/registry.ts`](app/lib/movements/registry.ts),
grouped so new exercises are cheap to add:

- **Legs** — Squat, Reverse Lunge, Hip Hinge / RDL, Glute Bridge
- **Push** — Push-up, Overhead Press, Lateral Raise
- **Pull** — Bicep Curl, Bent-over Row
- **Core** — Front Plank (hold), Crunch

## Architecture

Pose detection, movement rules, tracking logic, and UI are kept separate:

```
app/lib/pose/        landmark math + One-Euro smoothing
app/lib/movements/   exercise registry, form-check factories, types
app/lib/tracking/    rep engine, form coach, tempo/TUT
app/hooks/           usePoseTracker — camera + model + engine bridge
app/page.tsx         hub / coach / progress / settings UI
```

## Local development

```bash
npm install
cp .env.local.example .env.local   # fill in Supabase values (optional)
npm run dev
```

Open http://localhost:3000. The app is local-first — it works fully without
Supabase; sign-in just adds cross-device sync and AI review.

## Environment variables

```bash
NEXT_PUBLIC_SUPABASE_URL="https://YOUR_PROJECT_REF.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="YOUR_SUPABASE_ANON_OR_PUBLISHABLE_KEY"
```

The Gemini set-review key is **server-only** and lives in Supabase Edge Function
secrets, never in the client. See [docs/SUPABASE_REPMINT_SETUP.md](docs/SUPABASE_REPMINT_SETUP.md).

## Quick engine test

```bash
npx tsx scripts/engine-smoketest.mts
```

Feeds synthetic joint-angle streams through the rep engine to confirm counting,
partial-rep rejection, and inverted-direction movements.
