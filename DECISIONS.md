# DECISIONS.md

Append-only log of notable choices made by build agents. Newest entries at the bottom.

## 2026-07-09 — Backend agent (schema, RLS, edge functions, client glue)

**Wipe.** Dropped all 19 old `public.*` tables (profiles, user_settings,
camera_calibrations, movement_profiles, exercise_library, training_plans,
plan_workouts, workout_blocks, block_exercises, workout_sessions, set_results,
rep_events, form_signal_summaries, daily_hub_snapshots, ai_conversations,
ai_messages, ai_agent_runs, ai_recommendations, training_media), 6 old
functions (`handle_new_user`, `refresh_session_totals`,
`refresh_session_totals_from_set`, `set_updated_at`, `rls_auto_enable`,
`get_secret`), 10 old enums, and the `on_auth_user_created` trigger on
`auth.users`. Left `auth.*` schema itself untouched. Left the
`storage.training-media` bucket in place (couldn't drop it via SQL — Supabase
blocks direct deletion from storage tables; it's unused by the new schema and
harmless to leave; a future agent can delete it via the Storage API/dashboard
if desired).

**Schema.** Implemented BUILD_SPEC section 2 essentially as specified:
`profiles`, `exercises`, `workout_templates`, `template_exercises`, `plans`,
`plan_days`, `sessions`, `session_sets`, `coach_messages`, `user_settings`,
plus the social scaffold (`friendships`, `shared_workouts`). Used real
Postgres enums for every constrained text field mentioned in the spec
(experience_level, units, exercise_difficulty, load_type, template_source,
plan_source, plan_status, session_status, weight_unit, coach_role,
friendship_status, share_visibility) rather than plain `text` — matches the
"enums where sensible" instruction and gives Postgres-level validation.

`username` uses `citext` for case-insensitive uniqueness, but the `citext`
extension was moved out of `public` into a dedicated `extensions` schema (the
advisor flags extensions installed in `public`); the column type is
`extensions.citext`.

**RLS.** Owner-only pattern via `using (owner_id = (select auth.uid()))` (+
`with check`) on every owner table, wrapping `auth.uid()` in `(select ...)`
per the spec's performance note (avoids per-row re-evaluation, per Supabase's
RLS performance guidance). `exercises` is `select`-able by both `anon` and
`authenticated` (global read-only bank, no client writes — seeding happens via
migrations only). `profiles` and `workout_templates` allow reading
public/system rows in addition to the owner's own rows, per spec.
`template_exercises` and `plan_days` inherit visibility/ownership from their
parent row via `exists (...)` subqueries rather than a denormalized owner_id,
since the spec didn't list an owner_id column on those tables.
`session_sets` does carry a denormalized `owner_id` (as specified) for a fast
direct-equality RLS check instead of a join.

**Bootstrap trigger.** `handle_new_user()` on `auth.users` insert creates a
`profiles` row (display_name from `raw_user_meta_data`) and a `user_settings`
row, both `on conflict do nothing`. Locked down: revoked `EXECUTE` on
`handle_new_user()` from `anon`/`authenticated`/`public` so it can only run as
the trigger (this addressed two WARN-level "SECURITY DEFINER function
executable by public" advisor findings).

**Views.** `v_calendar_days`, `v_exercise_progress`, `v_weekly_stats`, all
`security_invoker = on` so the caller's own RLS on `sessions`/`session_sets`
applies — no privilege escalation through the view.

**Migrations applied to project `jpbmlcpsnxceksmprnyi`:** `repmint_schema`,
`repmint_rls`, `repmint_views_triggers` (plus the citext-schema-move and
`handle_new_user` EXECUTE revoke, folded into the local
`0001_schema.sql`/`0003_views_triggers.sql` files so the on-disk migrations
match what's actually live). Local files: `supabase/migrations/0001_schema.sql`,
`0002_rls.sql`, `0003_views_triggers.sql`. Deleted the old
`001_repmint_backend.sql` and `supabase/seed.sql`.

**Edge functions.** Rewrote `gemini-coach` + `auth-signup` as two functions
per BUILD_SPEC section 3, both deployed with `verify_jwt = true` (no more
`auth-signup`'s custom-signup-before-session pattern — sign-up now goes
through standard Supabase Auth client-side, which is a frontend concern):

- `ai-coach` — provider chain OpenRouter (`OPENROUTER_API_KEY`, model from
  `user_settings.ai_model`) → Gemini (`GEMINI_API_KEY`) fallback. Exports
  `DEFAULT_COACH_INSTRUCTIONS`; `GET ?mode=instructions` returns it
  unauthenticated so the Settings screen can display it without a session.
  Loads profile + last 10 sessions + their sets + active plan as context,
  persists both sides of the conversation to `coach_messages`.
- `generate-plan` — same provider chain. Reads `exercises.slug` at runtime for
  the allowed-slugs list; if the table is empty, accepts a `fallbackSlugs`
  array in the request body, else returns a 422 with a clear message (per
  spec: "still return a valid plan using slugs passed in the request's
  fallback list or fail with a clear message"). Validates strict JSON output
  and retries once with an error-annotated prompt on failure. On success,
  writes `plans` → `plan_days` → (`workout_templates` +
  `template_exercises` per non-rest day) and returns `{ planId }`.
  `DEFAULT_COACH_INSTRUCTIONS` is duplicated (not imported) from `ai-coach`
  inside `generate-plan/index.ts` because each Supabase Edge Function deploys
  as an independent bundle — a relative cross-function import would only work
  in local `supabase functions serve`, not against isolated remote deploys.

Both functions degrade gracefully: no `OPENROUTER_API_KEY`/`GEMINI_API_KEY`
configured → `503` with a clear "isn't set up yet" message, never a crash.

**Client glue.**
- `app/lib/supabaseClient.ts` — unchanged, env var names already matched spec.
- `app/lib/ai.ts` (new) — `askCoach`, `getCoachInstructions`, `generatePlan`,
  all passing the current session's access token. Works around
  `supabase-js` `functions.invoke` always issuing POST by hitting the GET
  `?mode=instructions` route with a direct `fetch` for
  `getCoachInstructions`.
- `app/lib/db.ts` (new) — `saveSession` (+ sets, rolls up aggregate stats onto
  the session row), `listSessions(month)`, `getSessionDetail`,
  `getExerciseProgress(slug)`, `getSettings`/`upsertSettings`,
  `listTemplates`/`saveTemplate`/`deleteTemplate`, `getActivePlan`, plus
  `listExercises`/`getExercise` and basic profile helpers. All RLS-scoped
  (no service role on the client, ever).
- `app/lib/types.ts` — extended additively with `Db*` types mirroring the new
  schema (`DbProfile`, `DbExercise`, `DbSession`, `DbSessionSet`, etc.).
  Existing exports (`Profile`, `SetResult`, `View`, etc., used by
  `app/page.tsx` and components) were left untouched — those are owned by the
  frontend/exercise-registry agents rebuilding `app/lib/movements/*` and the
  route split per BUILD_SPEC section 4, and this file's old local-first
  `Profile`/`SetResult` shape will presumably be superseded by those agents'
  work against the new `Db*` types.
- Did NOT touch `app/lib/persistence.ts`, `app/page.tsx`,
  `app/components/*`, or `app/lib/movements/*` — those reference the old
  `workout_sessions`/`set_results`/`movement_profiles` tables and old
  `gemini-coach`/`auth-signup` functions and will need to be rewired by the
  frontend agent(s) onto `app/lib/db.ts` / `app/lib/ai.ts` / the new schema.
  Flagging this explicitly so it isn't missed: **`persistence.ts` and the
  Supabase calls in `page.tsx`/`AuthScreen.tsx`/`AiCoach.tsx` are now stale**
  against the live DB and will error at runtime until updated.

**Env.** `.env.local` updated to this project's real URL
(`https://jpbmlcpsnxceksmprnyi.supabase.co`) and both the legacy anon key and
the modern `sb_publishable_...` key (both are non-secret, safe to commit to a
local-only gitignored file). Removed the old `GEMINI_API_KEY`/`GEMINI_MODEL`
lines from `.env.local` — AI secrets live in Supabase (`supabase secrets set
OPENROUTER_API_KEY=...` / `GEMINI_API_KEY=...`), not in the Next.js app's env,
since the edge functions run on Supabase's infrastructure. Neither
`OPENROUTER_API_KEY` nor `GEMINI_API_KEY` has been set as a Supabase secret
yet — both AI edge functions currently return a 503 "isn't set up yet" until
the user runs `supabase secrets set OPENROUTER_API_KEY=...` (or the Gemini
equivalent).

**Seed script.** `scripts/seed-exercises.mjs` reads
`supabase/seed/exercises.json` (owned by the exercise-registry agent) and
generates `supabase/migrations/0004_seed_exercises.sql` as plain idempotent
`insert ... on conflict (slug) do update` SQL — no `jsonb_populate_record`
needed since the script maps fields explicitly and handles `tut_target` as a
Postgres `int4range`. Script only writes the SQL file; per instructions it
was not run and the exercises table has not been seeded by this agent.

**Verification.** `get_advisors(security)` → zero errors, one WARN (leaked
password protection disabled at the Auth-project level — not a schema issue,
recommend enabling in Supabase Auth settings as a follow-up).
`get_advisors(performance)` → only INFO-level "unused index" notices, expected
on empty tables. Confirmed via `execute_sql` as `anon`: `exercises` is
readable (0 rows, unseeded) and an `insert` into `sessions` is rejected by RLS
(no row was created).

**Stale remote functions.** The Supabase MCP tools available don't expose a
"delete edge function" operation, so the old `gemini-coach` and `auth-signup`
functions (whose local `supabase/functions/` folders were deleted) still
exist as deployed functions in the project — they'd otherwise keep running
against the dropped tables and throw confusing 500s. Redeployed both as thin
stubs that return `410 Gone` with a message pointing to the replacement
(`ai-coach`, and `supabase.auth.signUp()` client-side). If the Supabase
dashboard or CLI is available later, these two slugs can be deleted outright.

**Known follow-ups for other agents / later work:**
- Enable "leaked password protection" in Supabase Auth settings (dashboard or
  `update_auth_config`-style call — not exposed through the migration tools
  used here).
- Rewire `app/lib/persistence.ts`, `app/page.tsx`, `app/components/AuthScreen.tsx`,
  `app/components/AiCoach.tsx` onto `app/lib/db.ts` / `app/lib/ai.ts` (old
  code targets the wiped schema and old function names).
- Set `OPENROUTER_API_KEY` (and optionally `GEMINI_API_KEY`) as Supabase
  secrets before the AI coach / plan generator will work end-to-end.
- Run `scripts/seed-exercises.mjs` and apply the generated
  `0004_seed_exercises.sql` once `supabase/seed/exercises.json` exists.

## 2026-07-09 — Exercise Bank agent (library rebuild, tiers, seed export)

**Scope.** Extended the movement model into a full exercise bank of **115
exercises** (target was ~100), migrated the original 12 movements into it,
restructured the registry into category files, and added a seed exporter +
smoketest coverage. The TS registry stays the single source of truth.

**Types (`types.ts`).** Added `TrackingTier` (1|2|3), `MuscleGroup`,
`Equipment`, `Difficulty`, `LoadType`, `ExerciseMeta`, and `ExerciseEntry`
(`{ meta, def? }`) per BUILD_SPEC §1. All existing exports kept intact; nothing
in the runtime engine changed.

**Registry split.** `movements/defs/` now holds category files
(`legs, hinge, core, push, pull, shoulders, arms, mobility, machines,
conditioning`) + `_shared.ts` (the `angleMeasure` factory + joint triplets,
moved out of the old monolith) + `index.ts`. The index flattens every
`ExerciseEntry` into `MOVEMENTS` (slug → MovementDef, tier 1–2 only) and
`EXERCISES` (slug → ExerciseMeta, all tiers), with a load-time integrity guard
that throws on duplicate slugs or a tier-1/2 entry missing a def.
`registry.ts` is now a thin re-export preserving the old surface
(`MOVEMENTS` array, `MOVEMENT_MAP`, `getMovement`, `movementsByCategory`,
`CATEGORY_LABEL/ORDER`) so `page.tsx`, `Landing.tsx`, and `persistence.ts`
compile and behave unchanged.

**Slug vs id.** New exercises use snake_case slugs (e.g. `goblet_squat`). The
original 12 keep their hyphenated `MovementDef.id` (`squat`, `push-up`,
`bicep-curl`, …) because `page.tsx` selects by id and I must not touch it.
`MOVEMENT_MAP`/`getMovement` resolve by BOTH id and slug, so old and new call
sites work. The index pins every `def.dbSlug = meta.slug` at load, so DB
references line up regardless of what the category file authored — this also
promotes the previously-`null` dbSlugs (curls, presses, raises) to real slugs,
which lets `persistence.ts` link those sets to a seeded exercise.

**Tier assignments (rationale).**
- **Tier 1 (58):** big camera-trackable patterns where a joint angle drives
  reps AND a single camera can read at least a couple of honest form faults —
  all squat/lunge/hinge variants, pushup family, bench/press, rows, pull/chin-
  ups, curls, tricep extensions, dips, raises, planks (hold mode), calf raise,
  and a few mobility rep/hold drills (bird dog, dead bug, toe touch).
- **Tier 2 (18):** a joint angle counts reps reliably but form judgment from
  one camera would be fake precision — lat pulldown, cable/seated rows, chest
  fly / pec deck, leg press, hack/smith squat, machine presses, assisted pull-
  up, straight-arm pulldown, plus shrug / upright row / face pull. These carry
  a full `MovementDef` with `formChecks: []`.
- **Tier 3 (39):** machines/cables/isolation/carries/conditioning where camera
  tracking isn't honest — leg extension/curl, cable crunch/woodchop/pushdowns,
  glute/hip machines, back extension, ab wheel, farmer/suitcase/overhead
  carries, sled push/pull, yoke, rowing/assault/treadmill/bike/stair machines,
  jump rope, battle ropes, box jump, burpee, med-ball slam, Turkish get-up, and
  9 stretch/warm-up drills. Meta-only (no `def`), still fully documented.

**New form-check factories (`checks.ts`).** Added two reusable, landmark-honest
checks used by tier-1 hinges/rows/presses:
- `flatBackCheck(cue, band, gate)` — side view; keeps the shoulder→hip torso
  angle within a lean band while the rep is loaded (deadlift, barbell/t-bar/
  single-arm rows, good morning).
- `elbowFlareCheck(cue, maxRatio)` — bottom-of-rep; flags the elbow drifting
  far off the wrist stack, normalized by forearm length (bench press).
Both are framed as practical coaching cues, no medical/precision claims.

**Angles.** Physiologically grounded per NSCA/ACE/NASM-style guidance and
widened slightly for camera jitter: squat/lunge knee ~85–95° at depth, RDL/
hinge hip ~90–100°, curl elbow ~158→~45–50°, press/pushup elbow ~165→~85–90°,
lockouts ~168–172°. `minRepFraction` set 0.5–0.8 by pattern (looser for
big-swing / partial-range moves, tighter for lockout-dependent presses).

**Seed export (`scripts/export-exercises.mjs`).** Imports the TS registry and
writes `supabase/seed/exercises.json` — one row per exercise matching the
BUILD_SPEC §2 `exercises` columns (slug, name, aliases, category,
primary/secondary_muscles, equipment, difficulty, tier, load_type,
instructions, form_points, common_mistakes, rom_guideline, tut_target as an
int4range literal, tracking jsonb). Category for tier-3 (no def) is inferred
from the primary muscle group. Rows sorted by tier then slug for stable diffs.
Run with `npx tsx scripts/export-exercises.mjs` (same runner the smoketest
uses; imports the `.ts` registry directly). **Verified: 115 records, 0 missing
required fields, 0 tier-3 rows carrying tracking.**

**Tooling.** Added `tsx` as a devDependency — the repo already documented
`npx tsx scripts/engine-smoketest.mts` in the README but tsx wasn't installed.
It's needed to run the smoketest and the seed exporter (both import `.ts`).

**Smoketest.** Extended `engine-smoketest.mts` with 9 new tier-1 cases (goblet
squat, reverse lunge, RDL, deadlift, hip thrust [inverted], bench press,
pull-up, hammer curl, overhead tricep extension [inverted]). **15/15 pass.**

**Quality.** `npx tsc --noEmit` exits 0; `npm run lint` exits 0 (no errors, no
warnings).

## 2026-07-09 — Visuals agent (app/components/visuals/, public/brand/)

Built the self-contained visuals library at `app/components/visuals/`:
`MuscleMap.tsx`, `MovementGlyph.tsx`, `EmptyState.tsx`, `HeroVisual.tsx`,
`visuals.css` (scoped styles, class prefix `rmviz-`), `index.ts` barrel
(imports `visuals.css` once), and `README.md`. Also dropped 3 brand assets
into `public/brand/`: `logomark.svg`, `wordmark.svg`, `og-image.svg`
(1200x630 social share card), all built from the existing lightning-bolt
mark in `brands/repmint/reference/.../repmint_lightning_logo/code.html`.

**API matches spec exactly**: `MuscleMap({primary, secondary, className})`,
`MovementGlyph({category, animated, className})`,
`EmptyState({name, className})`, `HeroVisual({className})`. `MuscleMap`'s
`primary`/`secondary` types are `MuscleGroup[]` imported directly from
`app/lib/movements/types.ts` — no local redefinition, so it can't drift from
the engine's type.

**Pre-existing placeholder removed.** Found `app/components/visuals/index.tsx`
already in the tree — a minimal typed stub apparently left by another agent
so the app would typecheck before this work landed. It matched the same
prop contract but had placeholder visuals (single ellipse muscle map, generic
glyph, etc.) and, critically, coexisting with my new `index.ts` barrel would
have created an ambiguous module resolution (two files resolving to
`./index`). Deleted it — my `index.ts` barrel is the single source of truth
now. No other files outside `app/components/visuals/` and `public/brand/`
were touched.

**MuscleMap implementation.** Hand-authored front + back SVG silhouette
pair (`viewBox 0 0 120 260` each), not clip-art — one `<path>` region per
`MuscleGroup` value overlaid on a shared outline body. Front view carries
chest/shoulders/biceps/forearms/core/obliques/hip_flexors/quads/adductors/
abductors/calves; back view carries traps/shoulders/back/lats/lower_back/
triceps/forearms/glutes/hamstrings/adductors/calves — mirroring real
anatomy-chart conventions (a muscle only gets geometry on the view where it
reads visually). `full_body` in `primary` or `secondary` lights every region
at that tier. Fill/stroke transitions are CSS (420ms cubic-bezier) so
swapping the selected exercise animates smoothly. Verified render by
rasterizing the exact path data in an isolated preview — silhouette and
region geometry are coherent, no malformed paths.

**MovementGlyph.** 10 named categories (legs/hinge/push/pull/core/shoulders/
arms/mobility/machines/conditioning) each a distinct minimal stroke figure
plus a dumbbell fallback for any unrecognized `category` string (never
throws). `currentColor`-based so callers theme via CSS `color`. `animated`
triggers a category-specific CSS keyframe loop (bob/hinge-tilt/pull-shift/
press-lift/curl-rotate/sway/run-bounce); all disabled under
`prefers-reduced-motion: reduce`.

**HeroVisual.** Stylized mid-squat figure (torso + head as SVG shapes) with
a 13-joint pose-tracking skeleton overlay (connecting lines + pulsing dots,
staggered animation-delay) layered on top, plus three floating metric chips
(Reps/Form %/TUT) as absolutely-positioned HTML overlays with a gentle
float animation (form chip additionally pulses via its border/glow). Sized
to fill its parent (100%/100%) — intended to drop into `.hero-stage` in
`globals.css`, which already sets `aspect-ratio: 4/5`.

**Constraints honored.** Zero new npm dependencies. No `globals.css` edits —
`visuals.css` mirrors the handful of design tokens it needs as local
`--rmviz-*` custom properties with `var(--accent, #b7ff3c)`-style fallback
chains, so components pick up the live app theme when mounted inside the
shell and still render correctly in isolation. All four components are
plain functions with no hooks/browser APIs — server-component-safe by
default; CSS keyframes need no `"use client"`. `prefers-reduced-motion` is
respected everywhere motion is used (glyph loops, hero pulses/floats, region
transitions keep their (short) transition but no infinite loop to disable
there).

**Verification.** `npx tsc --noEmit` exits 0 across the whole repo (typechecks
against the real `MuscleGroup` type). `npm run lint` exits 0. No files outside
`app/components/visuals/`, `public/brand/`, and this DECISIONS.md entry were
modified.

## 2026-07-09 — Frontend agent (route split, app shell, live coach rebuild)

**Monolith split.** Replaced the single `app/page.tsx` trainer with an App
Router structure: root `/` (landing/redirect), `/auth` (+ onboarding), and a
`(app)` route group (hub, exercises[+slug], train, workouts, plan, history,
insights, coach, settings) behind a client-side auth guard in `AppShell`.
Deleted the old view components from `page.tsx` and the now-dead
`app/lib/persistence.ts`, `app/components/AuthScreen.tsx`,
`app/components/AiCoach.tsx`, `app/components/WaitlistForm.tsx` (their roles are
now db.ts/ai.ts + the new /auth and /coach routes). `Landing.tsx` was evolved
(not rewritten) to route via next/navigation and count the full 115-exercise
bank.

**Static export constraint.** `next.config.ts` uses `output: "export"`, so
there is NO middleware — the auth guard is client-side (`app/lib/session.ts`
`useSession()` + `AppShell` redirect to `/auth`). The `/exercises/[slug]` route
is a server component exporting `generateStaticParams()` over the exercise
registry (115 detail pages pre-rendered) wrapping a client detail component.
Routes reading `useSearchParams` (`/auth`, `/train`, `/history`, `/coach`) are
wrapped in `<Suspense>` as the export build requires.

**Shell + design.** Evolved the existing dark/mint Kinetic Performance system
rather than reskinning: added semantic tokens (radius/shadow/safe-area/warn),
an `AppShell` (left rail ≥860px, bottom tab bar below, safe-area insets, 44px+
targets), and a shared primitive kit (`app/components/ui/primitives.tsx`) all
route agents build on. Page transitions use framer-motion (added as the one new
dep, allowed by BUILD_SPEC). Per-route CSS lives in route-local `.css` files
imported by each page (avoids one giant globals.css and parallel-edit
conflicts); only the shell/primitive styles were appended to globals.css.

**Fonts / offline build.** Dropped the `next/font/google` JetBrains Mono import
from `layout.tsx` (it hard-fails `next build` in network-restricted CI) in favor
of the CSS fallback stack `"JetBrains Mono", var(--font-geist-mono),
ui-monospace` — Geist Mono is self-hosted via `geist`, so the mono look holds
with zero network dependency. Satoshi stays as a runtime `<link>` (degrades
gracefully). Added a `viewport` export (viewport-fit=cover, theme-color) for
PWA-quality safe-area behaviour.

**Live coach (`/train`).** Reworked the monolith's CameraCoach into a full
workout runner without touching tracking logic: `usePoseTracker` is reused
as-is. A template (or ad-hoc exercise) is expanded into ordered set slots
(`workoutModel.ts`); the runner steps set → live coach → weight quick-log →
rest timer → next → summary → `db.saveSession`. Tier 1/2 exercises get the
camera pipeline (big rep counter, form ring from pose quality, ROM/depth bar,
TUT + tempo readouts, one live cue); tier 3 falls back to a manual/timer set.
Per-set weight logger remembers the last weight per exercise in localStorage
(the only client-persisted convenience), honors the user's kg/lb unit, and has a
bodyweight toggle. Added `useWakeLock` (best-effort screen wake during a set)
and `db.getTemplate`.

**Data access.** Every route reads/writes through `app/lib/db.ts` /
`app/lib/ai.ts` (RLS-scoped). The exercise library and detail pages read the TS
registry directly via `app/lib/library.ts` (no DB round-trip for static
reference data — works before the `exercises` table is seeded). AI-dependent
screens (`/plan`, `/coach`) detect the "no provider key" 4xx/503 and show a
friendly "AI needs an API key — add OPENROUTER_API_KEY in Supabase secrets"
empty-state instead of crashing.

**Visuals contract.** Coded `/hub`, `/exercises`, etc. against the visuals
module API (`MuscleMap`, `MovementGlyph`, `EmptyState`, `HeroVisual`); the
parallel visuals agent's real implementation landed in
`app/components/visuals/` and is what ships (my temporary stub was superseded).

**Quality.** `npx tsc --noEmit` clean, `npm run lint` clean (0 errors, 0
warnings), `npm run build` succeeds — 129 static pages (12 routes + 115 exercise
detail pages). Nothing left stubbed.
