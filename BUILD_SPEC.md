# RepMint Rebuild — BUILD_SPEC (v1, 2026-07-09)

Shared contract for all build agents. Read this fully before touching code.
Also read: `AGENTS.md` (claim-safety rules apply to ALL copy), `PRD.md`,
`app/lib/movements/types.ts`, `app/lib/tracking/repEngine.ts`.

## Product summary

RepMint = AI camera personal trainer. Before the gym: AI-generated custom
workout plans + exercise clarity. In the gym: camera coach counts reps,
scores form %, tracks ROM, tempo, time-under-tension, live cues drawn on the
body skeleton. After the gym: sessions auto-logged to an in-app calendar,
insights dashboard (reps/load/quality over time), AI coach gives
recommendations grounded in the user's actual session data. Auth + profiles
must be social-ready (friends/sharing later).

## Stack

Next.js 15 (App Router) + React 19 + TypeScript, @mediapipe/tasks-vision,
@supabase/supabase-js. Supabase project: `jpbmlcpsnxceksmprnyi`
(eu-central-1) — WIPED and rebuilt from scratch. No new heavyweight deps
without strong reason (framer-motion allowed for the UI overhaul; nothing
else without noting it in DECISIONS.md).

## 1. Exercise model (extends existing MovementDef)

Keep the existing engine (`repEngine.ts`, depth-normalized rep state machine,
`restAngle`/`activeAngle`/`minRepFraction`, FormChecks). Extend
`app/lib/movements/types.ts` with:

```ts
export type TrackingTier = 1 | 2 | 3;
// 1 = full camera coaching: rep counting + form % + ROM + live cues
// 2 = camera rep counting only (no reliable form judgment)
// 3 = timer/manual logging (camera can't see the load path usefully)

export type MuscleGroup = "chest"|"back"|"shoulders"|"biceps"|"triceps"|
  "forearms"|"quads"|"hamstrings"|"glutes"|"calves"|"core"|"obliques"|
  "hip_flexors"|"adductors"|"abductors"|"traps"|"lats"|"lower_back"|"full_body";

export type ExerciseMeta = {
  slug: string;              // stable id, snake_case, == DB exercises.slug
  name: string;
  aliases: string[];
  primaryMuscles: MuscleGroup[];
  secondaryMuscles: MuscleGroup[];
  equipment: ("bodyweight"|"dumbbell"|"barbell"|"kettlebell"|"cable"|
    "machine"|"band"|"bench"|"pull_up_bar"|"box"|"medicine_ball")[];
  difficulty: "beginner"|"intermediate"|"advanced";
  tier: TrackingTier;
  loadType: "bodyweight"|"external"|"both"; // drives weight-logging UI
  instructions: string[];    // 3-6 numbered setup/execution steps
  formPoints: string[];      // 3-5 evidence-based technique points
  commonMistakes: string[];  // 2-4
  safetyNote?: string;       // claim-safe wording only (see AGENTS.md)
  romGuideline: string;      // human-readable target range of motion
  tutTarget?: [number, number]; // seconds per rep band
};
```

- Tier 1/2 exercises: full `MovementDef` (measure fn, angles, formChecks).
- Tier 3 exercises: `ExerciseMeta` only + optional timer config.
- Registry: split `app/lib/movements/registry.ts` into
  `app/lib/movements/defs/<category>.ts` files + an index that exports
  `MOVEMENTS: Record<slug, MovementDef>` and `EXERCISES: Record<slug, ExerciseMeta>`.
- A build script exports the bank to `supabase/seed/exercises.json` for DB
  seeding. TS registry is the single source of truth.

Form parameters must be defensible (standard kinesiology guidance, e.g. squat
depth = hip crease below knee ≈ knee angle ≤ ~90–100° side view; elbow
extension range for curls ~30–160°). No fake precision, no injury-prevention
claims in user-facing copy.

## 2. Database schema (Postgres / Supabase)

All tables `public.*`, RLS ENABLED on every table, owner-only by default.
`auth.users` is the identity root. Use `uuid` PKs (`gen_random_uuid()`),
`created_at timestamptz default now()`.

- `profiles` — id (= auth.users.id), username (unique, citext), display_name,
  avatar_url, goal, experience_level, equipment text[], is_public bool
  default false, units ('kg'|'lb'), created_at. RLS: owner full; public rows
  readable by any authenticated user (social-ready).
- `exercises` — global read-only bank. slug unique, name, aliases text[],
  category, primary_muscles text[], secondary_muscles text[], equipment
  text[], difficulty, tier smallint, load_type, instructions jsonb,
  form_points jsonb, common_mistakes jsonb, rom_guideline, tut_target
  int4range null, tracking jsonb (rest_angle, active_angle, min_rep_fraction,
  view, mode, unilateral — for reference/analytics; the TS registry drives
  runtime). RLS: SELECT for anon+authenticated; no client writes.
- `workout_templates` — id, owner_id (null = system/AI-preset), title,
  description, source ('user'|'ai'|'system'), goal, est_duration_min,
  is_public bool default false. RLS: owner CRUD; public/system readable.
- `template_exercises` — template_id FK, position, exercise_slug FK
  (exercises.slug), sets, target_reps, target_seconds, target_weight numeric
  null, rest_seconds, superset_group smallint null, notes.
- `plans` — id, owner_id, title, goal, weeks, source ('ai'|'user'),
  model_used text null, status ('active'|'archived'|'completed'), created_at.
- `plan_days` — plan_id FK, day_index, weekday smallint null, template_id FK
  null, title, focus, is_rest bool.
- `sessions` — id, owner_id, template_id null, plan_day_id null, title,
  started_at, ended_at, status ('active'|'completed'|'discarded'),
  total_reps int, total_sets int, active_seconds int, avg_form_score numeric
  null, notes. This IS the calendar: calendar view = sessions by date.
- `session_sets` — id, session_id FK, owner_id (denormalized for RLS),
  exercise_slug, set_index, reps int, seconds int null, weight numeric null,
  weight_unit, is_bodyweight bool, avg_form_score numeric null, rom_score
  numeric null, tut_seconds numeric null, top_cues jsonb, rep_metrics jsonb
  (per-rep: depth, duration, tut), created_at.
- `coach_messages` — id, owner_id, session_id null, role
  ('user'|'assistant'), content text, model text null, created_at. For AI
  coach history.
- `user_settings` — owner_id PK, ai_model text default
  'google/gemini-2.5-flash', ai_instructions_override text null, coach_voice,
  audio_cues bool, haptics bool, rest_timer_default int.
- Social scaffold (build tables + RLS now, UI later):
  `friendships` — user_id, friend_id, status ('pending'|'accepted'),
  unique pair, RLS: either party reads, requester inserts, recipient updates.
  `shared_workouts` — template_id, owner_id, visibility ('friends'|'public').
- Views (security_invoker = on): `v_calendar_days` (sessions per day),
  `v_exercise_progress` (per exercise: date, max weight, total reps, avg
  form), `v_weekly_stats`.

RLS pattern for owner tables:
`using (owner_id = (select auth.uid()))` for ALL of select/insert/update/delete
(+ `with check`). Wrap auth.uid() in (select ...) for performance. Add
indexes on every FK + owner_id. Trigger: on auth.users insert → create
profiles + user_settings rows.

Migrations: write to `supabase/migrations/` as NEW numbered files
(0001_schema.sql, 0002_rls.sql, 0003_views_triggers.sql, 0004_seed_exercises.sql)
AND apply to the remote project. Delete the old 001_repmint_backend.sql.

## 3. AI layer

Edge functions (Deno, `supabase/functions/`):

- `ai-coach` — replaces gemini-coach. Provider chain: if `OPENROUTER_API_KEY`
  secret set → call OpenRouter (`https://openrouter.ai/api/v1/chat/completions`)
  with model from user_settings.ai_model; else fall back to Gemini
  (`GEMINI_API_KEY`). Verifies the Supabase JWT, loads the user's recent
  sessions/sets/plan as context, system prompt = DEFAULT_COACH_INSTRUCTIONS
  (exported constant, also returned by a `?mode=instructions` GET so the
  Settings screen can show it) + user override from
  user_settings.ai_instructions_override. Modes: post-session insight,
  general Q&A, recommendation. Persist convo to coach_messages.
- `generate-plan` — same provider chain; input: goal, level, equipment, days
  per week, session length; output: STRICT JSON (validate + retry once) of a
  plan with plan_days + workout_templates referencing ONLY slugs present in
  the exercises table (pass the slug list in the prompt); writes rows,
  returns plan id.

Client: `app/lib/ai.ts` wrapper calling the functions with the session token.
Settings screen: model picker (curated list: google/gemini-2.5-flash,
anthropic/claude-sonnet, openai/gpt-4o-mini, meta-llama free tier, + free-text
custom model id), instructions viewer + editable override.
Env: `OPENROUTER_API_KEY` (+ keep GEMINI_* as fallback) documented in
`.env.local.example`; secrets set via `supabase secrets set` (user pastes key
later — code must degrade gracefully: clear "add your key in settings/env"
empty-state, never crash).

## 4. Frontend routes (App Router)

Split the monolith `app/page.tsx`:

- `/` — logged-out: product landing; logged-in: redirect `/hub`.
- `/auth` — sign in/up (email+password, magic link), profile bootstrap.
- `/hub` — today's session, plan progress, streak, quick actions.
- `/exercises` + `/exercises/[slug]` — library: search, filter by muscle/
  equipment/tier; detail: form points, instructions, animated diagram,
  "Start with camera" (tier 1/2) or "Log manually" (tier 3).
- `/workouts` — my templates + builder (create/edit custom workout: pick
  exercises, sets/reps/weight/rest, supersets, drag order).
- `/plan` — AI plan generator wizard + current plan view.
- `/train/[sessionId]` — live coach: camera, skeleton overlay, rep count,
  form %, ROM bar, TUT, tempo, cue; set flow with rest timer; per-set weight
  quick-log (stepper, remembers last weight, bodyweight toggle); session
  summary on finish → writes session + sets → lands on `/history`.
- `/history` — calendar month view (sessions as dots/chips) + list; session
  detail drawer with per-set data + "Ask coach about this session".
- `/insights` — dashboard: volume/reps/est-1RM-free load trends, form-quality
  trend, consistency heatmap, per-exercise progress.
- `/coach` — chat with AI coach (context-aware).
- `/settings` — profile, units, coaching prefs, AI model picker, agent
  instructions view/override, sign out.

Shell: mobile-first. Bottom tab bar (Hub, Exercises, Train, History, Coach) on
<md; left sidebar on desktop. Camera screen works in portrait AND landscape;
big touch targets (min 44px); safe-area insets; PWA-quality feel. Keep the
Kinetic Performance design direction (`brands/repmint/`), dark athletic theme,
one accent (mint). All state that must survive refresh → Supabase; ephemeral
UI state → React. Auth-guard all app routes (middleware or client guard).

## 5. Quality bars

- `npm run build` and `npm run lint` must pass.
- Engine smoketest (`scripts/engine-smoketest.mts`) must pass, extended to a
  sample of new tier-1 movements.
- Supabase advisors: zero security errors (RLS everywhere, no
  security-definer views without reason, functions pin search_path).
- Claim-safe copy per AGENTS.md everywhere.
- No secrets committed. `.env.local` stays gitignored.
- Agents record notable choices in `DECISIONS.md` (append-only).
