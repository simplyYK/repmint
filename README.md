# RepMint

Your AI camera coach for goal-based training — a personal trainer in your pocket.

RepMint builds a plan around your goal, uses your phone or laptop camera to
count reps, score form %, track ROM/tempo/time-under-tension, and give one
live cue at a time, then auto-logs each session to a calendar and an insights
dashboard, with an AI coach grounded in your own training data. It's coaching
software, not clinical guidance.

## Features

- **AI plan generator** — goal + level + equipment + days/week in, a
  week-by-week plan of workouts (built only from exercises in the bank) out.
- **Live camera coach** — in-browser pose estimation (MediaPipe Pose, 33-point
  full-body model) with a skeleton overlay, rep counter, form ring, ROM bar,
  and TUT/tempo readouts.
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
- **History & insights** — every session writes to Supabase; `/history` is a
  calendar of sessions, `/insights` charts volume/reps/form-quality trends and
  per-exercise progress.
- **AI coach** — chat grounded in your recent sessions/sets/plan, via
  OpenRouter (configurable model) with a Gemini fallback.

## Exercise library

115 exercises live as pure config under
[`app/lib/movements/defs/`](app/lib/movements/defs/) (one file per category —
legs, hinge, core, push, pull, shoulders, arms, mobility, machines,
conditioning — plus `_shared.ts` and an `index.ts` that assembles the bank).
[`app/lib/movements/registry.ts`](app/lib/movements/registry.ts) re-exports it
(`MOVEMENTS`, `EXERCISES`, plus a legacy-compatible surface). Every exercise
has full `ExerciseMeta` (muscles, equipment, instructions, form points, common
mistakes); tier 1/2 exercises additionally carry a `MovementDef` (measure fn,
angles, form checks) for camera tracking:

- **Tier 1 (58)** — full camera coaching: rep counting + form % + ROM + live
  cues (squats, lunges, hinges, pushups, presses, rows, pulls, curls,
  extensions, dips, raises, planks, and a few mobility drills).
- **Tier 2 (18)** — camera rep counting only, no form judgment (machines/cables
  where a joint angle counts reps reliably but per-camera form scoring would
  be fake precision — lat pulldown, leg press, cable rows, etc.).
- **Tier 3 (39)** — timer/manual logging (camera can't usefully see the load
  path — carries, sleds, conditioning machines, isolation/ab work, stretches).

`scripts/export-exercises.mjs` exports the TS registry to
`supabase/seed/exercises.json`, which seeds the `exercises` table
(`supabase/migrations/0004_seed_exercises.sql`). The TS registry is the single
source of truth; the DB copy is for querying/analytics.

## Architecture

Pose detection, movement rules, tracking logic, data access, and UI are kept
separate:

```
app/lib/pose/         landmark math + One-Euro smoothing
app/lib/movements/    exercise bank (115 exercises), form-check factories, types
app/lib/tracking/     rep engine, form coach, tempo/TUT
app/lib/db.ts         typed Supabase data access (sessions, templates, plans…)
app/lib/ai.ts         edge-function client (askCoach, generatePlan, instructions)
app/lib/library.ts    UI-facing view over the exercise bank (tiers, muscles)
app/lib/session.ts    client-side auth/session hook + guard helper
app/hooks/            usePoseTracker (camera + model + engine), useWakeLock
supabase/migrations/  schema, RLS, views/triggers, exercise seed (SQL)
supabase/functions/   ai-coach, generate-plan (Deno edge functions)
```

### App structure (App Router)

The old single-page monolith was split into routes. The public shell is at the
project root; the signed-in app lives under the `(app)` route group behind a
client-side auth guard (`AppShell`), with a bottom tab bar on mobile and a left
rail on desktop.

```
app/layout.tsx              root layout, fonts, metadata, viewport
app/page.tsx                logged-out landing (→ /hub when signed in)
app/auth/                   sign in / up + magic link + first-run onboarding
app/(app)/layout.tsx        AppShell (nav + auth guard + page transitions)
app/(app)/hub/              daily hub: today's session, streak, quick actions
app/(app)/exercises/        115-exercise library (search + filters)
app/(app)/exercises/[slug]/ exercise detail (muscle map, cues, train/log CTA)
app/(app)/train/            flagship live camera coach + workout runner
app/(app)/workouts/         my templates + custom workout builder
app/(app)/plan/             AI plan wizard + week × day plan view
app/(app)/history/          month calendar + session detail (edit/delete)
app/(app)/insights/         hand-rolled SVG dashboard (volume, trends, PRs)
app/(app)/coach/            AI coach chat over coach_messages
app/(app)/settings/         profile, units, coaching prefs, AI model + instructions
app/components/shell/        AppShell (rail + tab bar)
app/components/ui/           shared primitives (Button, Card, Metric, Chip…)
app/components/visuals/      MuscleMap, MovementGlyph, EmptyState, HeroVisual
```

All persistent state lives in Supabase (via `app/lib/db.ts`); only ephemeral UI
state and per-device conveniences (last-used weight per exercise) use the client.

## Local development

```bash
npm install
cp .env.local.example .env.local   # fill in Supabase values
npm run dev
```

Open http://localhost:3000. Sign in to sync training, plans, and the AI coach.

## Environment variables

```bash
NEXT_PUBLIC_SUPABASE_URL="https://YOUR_PROJECT_REF.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="YOUR_SUPABASE_ANON_OR_PUBLISHABLE_KEY"
```

AI provider keys (`OPENROUTER_API_KEY`, preferred, with `GEMINI_API_KEY` as a
fallback) are **server-only** and live in Supabase Edge Function secrets
(`supabase secrets set ...`), never in the client or this file. See
[.env.local.example](.env.local.example) and
[docs/SUPABASE_REPMINT_SETUP.md](docs/SUPABASE_REPMINT_SETUP.md).

## Quick engine test

```bash
npx tsx scripts/engine-smoketest.mts
```

Feeds synthetic joint-angle streams through the rep engine to confirm counting,
partial-rep rejection, and inverted-direction movements.
