# RepMint Supabase Backend Setup

> **STALE — pre-rebuild.** This doc describes the original schema
> (`workout_sessions`, `set_results`, `movement_profiles`, `gemini-coach`,
> `001_repmint_backend.sql`), all of which were replaced in the 2026-07-09
> rebuild (see `BUILD_SPEC.md` §2–3 and `DECISIONS.md`). The live schema is
> `profiles` / `exercises` / `workout_templates` / `template_exercises` /
> `plans` / `plan_days` / `sessions` / `session_sets` / `coach_messages` /
> `user_settings`, migrated via `supabase/migrations/0001_schema.sql` through
> `0004_seed_exercises.sql`, with edge functions `ai-coach` and
> `generate-plan` (OpenRouter + Gemini-fallback, not Gemini-only). Kept here
> for historical reference; needs a full rewrite against the current schema
> before it should be treated as a setup guide.

This setup gives RepMint authenticated user profiles, onboarding data, training plans, workout history, set history, rep events, form-signal summaries, private optional media storage, and a Gemini-powered coach endpoint.

## 1. Create The Supabase Project

1. Create a Supabase project.
2. In Authentication, enable the providers you want first:
   - Email/password
   - Magic link
   - Google OAuth, optional
3. Set the Site URL and redirect URLs for your app:
   - Local: `http://localhost:3000`
   - Production: your deployed RepMint URL

## 2. Run The SQL

Run [001_repmint_backend.sql](../supabase/migrations/001_repmint_backend.sql) in the Supabase SQL editor.

If you use the Supabase CLI later:

```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

The migration creates:

- `profiles`, tied 1:1 to Supabase Auth users
- `user_settings` and `camera_calibrations`
- configurable `movement_profiles` and `exercise_library`
- `training_plans`, `plan_workouts`, `workout_blocks`, `block_exercises`
- `workout_sessions`, `set_results`, `rep_events`, `form_signal_summaries`
- `daily_hub_snapshots`
- `ai_conversations`, `ai_messages`, `ai_agent_runs`, `ai_recommendations`
- private `training-media` storage bucket

Every user-owned table has Row Level Security enabled. Users can only read and write their own data.

## 3. Environment Variables

Add these to the Next.js app:

```bash
NEXT_PUBLIC_SUPABASE_URL="https://YOUR_PROJECT_REF.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="YOUR_SUPABASE_ANON_KEY"
```

Do not put the Gemini key in `NEXT_PUBLIC_` variables.

Add these as Supabase Edge Function secrets:

```bash
supabase secrets set GEMINI_API_KEY="YOUR_GOOGLE_AI_STUDIO_KEY"
supabase secrets set GEMINI_MODEL="gemini-2.5-flash"
```

Supabase automatically provides:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## 4. Deploy The Gemini Coach

Deploy [gemini-coach](../supabase/functions/gemini-coach/index.ts):

```bash
supabase functions deploy gemini-coach
```

The function verifies the logged-in Supabase user, loads that user's RepMint context, calls Gemini server-side, stores the AI run and chat messages, and writes coach recommendations into `ai_recommendations`.

Google's Gemini docs currently show `models.generateContent` on `https://generativelanguage.googleapis.com/v1beta/{model=models/*}:generateContent`, and their model docs list `gemini-2.5-flash` as a stable Flash model. Keep `GEMINI_MODEL` configurable so you can switch models without code changes.

Sources:

- [Gemini generateContent API](https://ai.google.dev/api/generate-content)
- [Gemini model list](https://ai.google.dev/gemini-api/docs/models)

## 5. Install Client Package

When the frontend is ready to connect auth and data:

```bash
npm install @supabase/supabase-js
```

Create a browser client:

```ts
import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);
```

## 6. Auth Flow

Sign up:

```ts
await supabase.auth.signUp({
  email,
  password,
  options: {
    data: { display_name: displayName },
  },
});
```

Sign in:

```ts
await supabase.auth.signInWithPassword({ email, password });
```

Sign out:

```ts
await supabase.auth.signOut();
```

When a new auth user is created, the database trigger creates:

- one `profiles` row
- one `user_settings` row

## 7. Save Onboarding Profile

After onboarding:

```ts
const { data: userData } = await supabase.auth.getUser();
const userId = userData.user?.id;

await supabase
  .from("profiles")
  .update({
    display_name: displayName,
    experience_level: "beginner",
    primary_goal: "strength_foundation",
    secondary_goals: ["mobility_flow"],
    available_equipment: ["bodyweight", "dumbbells"],
    workouts_per_week: 3,
    session_minutes: 25,
    coaching_intensity: "standard",
    movement_preferences: {
      allowed_first_movements: ["squat", "lunge", "push_up", "hinge", "plank", "mobility_drill"],
    },
    onboarding_completed_at: new Date().toISOString(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  })
  .eq("id", userId);
```

## 8. Create A Plan

```ts
const { data: plan } = await supabase
  .from("training_plans")
  .insert({
    user_id: userId,
    name: "Strength Foundation",
    goal: "strength_foundation",
    status: "active",
    start_date: new Date().toISOString().slice(0, 10),
    weeks_count: 4,
    sessions_per_week: 3,
    source: "ai",
    progression_rules: {
      style: "repeatable starter plan",
      adjustment: "adjust today's plan based on recent training",
    },
  })
  .select()
  .single();
```

Then create `plan_workouts`, `workout_blocks`, and `block_exercises` for the plan. Keep exercise rules in `movement_profiles`; do not hard-code squat-only logic in the UI.

## 9. Track Workout History

Start a session:

```ts
const { data: session } = await supabase
  .from("workout_sessions")
  .insert({
    user_id: userId,
    plan_id: planId,
    plan_workout_id: planWorkoutId,
    name: "Lower Body Control",
    status: "in_progress",
    started_at: new Date().toISOString(),
  })
  .select()
  .single();
```

Save a completed set:

```ts
await supabase.from("set_results").insert({
  user_id: userId,
  session_id: session.id,
  block_exercise_id: blockExerciseId,
  movement_profile_id: movementProfileId,
  exercise_name: "Bodyweight Squat",
  set_number: 1,
  target_reps: 10,
  reps_count: 10,
  duration_seconds: 42.5,
  tut_seconds: 38.2,
  avg_rep_seconds: 4.25,
  tempo: "3-1-2-0",
  range_signal: "consistent",
  control_signal: "steady",
  stability_signal: "steady",
  cues_triggered: ["Keep the descent controlled"],
  next_focus: "Keep the same tempo for the first five reps.",
  tracker_version: "form-agent-v1",
  tracker_payload: {
    source: "camera_tracker",
    sample_output: false,
    counters: { accepted_reps: 10, ignored_movements: 1 },
  },
});
```

The database automatically refreshes `workout_sessions.total_sets`, `total_reps`, `active_seconds`, `avg_tut_seconds`, and `avg_tempo_seconds` when set results are inserted or updated.

Save per-rep details when the tracker has them:

```ts
await supabase.from("rep_events").insert({
  user_id: userId,
  set_result_id: setResultId,
  rep_number: 1,
  started_at: repStartedAt,
  completed_at: repCompletedAt,
  duration_seconds: 4.1,
  tut_seconds: 3.8,
  eccentric_seconds: 2.2,
  pause_seconds: 0.6,
  concentric_seconds: 1.3,
  range_signal: "consistent",
  control_signal: "steady",
  cue: null,
  metrics: {
    tracker_confidence: 0.86,
    phase_path: ["descent", "bottom", "ascent"],
  },
});
```

Save form-signal summaries:

```ts
await supabase.from("form_signal_summaries").insert({
  user_id: userId,
  set_result_id: setResultId,
  movement_profile_id: movementProfileId,
  signal_name: "tempo_rushed",
  signal_value: "last_3_reps",
  severity: 1,
  observed_count: 3,
  metadata: {
    cue: "Slow the next descent slightly.",
  },
});
```

Complete the session:

```ts
await supabase
  .from("workout_sessions")
  .update({
    status: "completed",
    completed_at: new Date().toISOString(),
    duration_seconds: Math.round((Date.now() - startedAtMs) / 1000),
    recurring_cues: ["tempo_rushed"],
    user_notes: "Felt good. Push-ups got slower near the end.",
  })
  .eq("id", session.id);
```

## 10. Call The Gemini Coach

```ts
const { data, error } = await supabase.functions.invoke("gemini-coach", {
  body: {
    mode: "set_review",
    message: "What should I focus on next set?",
    sessionId: session.id,
    setResultId,
  },
});
```

Supported modes:

- `chat`
- `daily_recommendation`
- `set_review`
- `plan_builder`

The response shape:

```ts
type GeminiCoachResponse = {
  conversationId: string;
  message: string;
  recommendations: Array<{
    title: string;
    recommendation: string;
    reason: string;
    action_label?: string;
    priority: number;
  }>;
};
```

## 11. Notes For The Parallel Form And Rep Tracking Agent

Use these tables as the integration contract:

- Read movement configuration from `movement_profiles`.
- Write one row per completed set to `set_results`.
- Write optional per-rep details to `rep_events`.
- Write summarized tracking cues to `form_signal_summaries`.
- Put tracker-specific raw values in `tracker_payload` or `metrics`.
- Do not store raw video by default.
- If media storage is enabled by the user, store objects under `training-media/{user_id}/{session_id}/...` so storage policies work.

The tracker should not create separate workout history tables. `workout_sessions`, `set_results`, and `rep_events` are the canonical history path.

## 12. Security Checklist Before Production

- Rotate any Gemini key that was ever shared in a zip, chat, screenshot, or client-side file.
- Keep `GEMINI_API_KEY` only in Supabase Edge Function secrets.
- Never expose the Supabase service role key to the frontend.
- Keep RLS enabled.
- Confirm `training-media` is private.
- Store only summarized pose/form data unless the user explicitly opts into media storage.
- Add a privacy screen explaining what RepMint stores: profile, plans, sessions, set metrics, rep metrics, and optional media.
