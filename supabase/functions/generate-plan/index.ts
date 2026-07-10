// generate-plan — AI workout plan generator.
//
// Same provider chain as ai-coach (OpenRouter -> Gemini fallback). Input:
// { goal, level, equipment, daysPerWeek, sessionMinutes, weeks, fallbackSlugs? }
// Output: strict JSON plan (validated, one retry on failure), then writes
// plans/plan_days/workout_templates/template_exercises rows and returns the
// plan id.

import { createClient } from "npm:@supabase/supabase-js@2";

// Kept in sync with supabase/functions/ai-coach/index.ts's
// DEFAULT_PLANNER_INSTRUCTIONS. Duplicated (not imported) so each edge
// function deploys as a standalone bundle.
const DEFAULT_PLANNER_INSTRUCTIONS = `You are the RepMint workout planner — the agent that designs workouts and multi-week training plans.

PRINCIPLES:
- Build only from the allowed exercise bank you are given. Never invent exercises.
- Balance the week: don't stack the same movement pattern or muscle group on consecutive days without reason.
- Match volume and exercise selection to the user's goal, experience level, available equipment, and session length.
- Progress conservatively: a plan someone finishes beats an ambitious plan they abandon.
- Respect the tracked-only constraint when given: camera-tracked exercises are tier 1 and 2; tier 3 exercises are logged manually with a timer.

SAFETY:
- No clinical, injury-prevention, or guaranteed-outcome claims in any title, focus, or notes field.
- Keep notes practical and encouraging.`;

type GenerateRequest = {
  goal?: string;
  level?: string;
  equipment?: string[];
  daysPerWeek?: number;
  sessionMinutes?: number;
  weeks?: number;
  trackedOnly?: boolean;
  fallbackSlugs?: string[];
  /** "plan" (default) = full weekly plan. "workout" = one standalone session
   * for today, saved to the workout library WITHOUT touching the active plan. */
  mode?: "plan" | "workout";
  /** Workout mode only: what the user wants to hit today ("chest and triceps,
   * shoulder is tweaky", "quick full-body burner"). */
  focus?: string;
};

type PlanDayExercise = {
  slug: string;
  sets: number;
  targetReps?: number;
  targetSeconds?: number;
  restSeconds?: number;
  supersetGroup?: number | null;
  notes?: string;
};

type PlanDayJson = {
  dayIndex: number;
  weekday?: number | null;
  title: string;
  focus?: string;
  isRest: boolean;
  exercises: PlanDayExercise[];
};

type PlanJson = {
  title: string;
  goal: string;
  days: PlanDayJson[];
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ error: "Missing server configuration" }, 500);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Missing authorization header" }, 401);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: authData, error: authError } = await userClient.auth.getUser();
  if (authError || !authData.user) return json({ error: "Invalid user session" }, 401);
  const userId = authData.user.id;

  const body = (await req.json().catch(() => ({}))) as GenerateRequest;
  const mode = body.mode === "workout" ? "workout" : "plan";
  const goal = (body.goal ?? "general fitness").trim();
  const level = (body.level ?? "beginner").trim();
  const equipment = Array.isArray(body.equipment) && body.equipment.length ? body.equipment : ["bodyweight"];
  const daysPerWeek = clampInt(body.daysPerWeek, 1, 7, 3);
  const sessionMinutes = clampInt(body.sessionMinutes, 10, 120, 30);
  const weeks = clampInt(body.weeks, 1, 52, 4);
  const trackedOnly = Boolean(body.trackedOnly);
  const focus = (body.focus ?? "").trim().slice(0, 400);

  const { openRouterKey, geminiKey } = await resolveAiKeys(adminClient);
  if (!openRouterKey && !geminiKey) {
    return json(
      {
        error:
          "The plan generator isn't set up yet. Add an OpenRouter or Gemini API key in Settings / server env to enable it.",
      },
      503,
    );
  }

  // Slugs the model is allowed to use. Prefer the live exercises table
  // (filtered to camera-tracked tiers when requested); fall back to slugs
  // passed in the request if the table is empty (e.g. during initial
  // bring-up before seeding runs).
  const { data: exerciseRows } = await adminClient.from("exercises").select("slug, tier, equipment").limit(500);
  let availableSlugs = (exerciseRows ?? [])
    .filter((r) => !trackedOnly || (r.tier as number) <= 2)
    .map((r) => r.slug as string);
  if (availableSlugs.length === 0) {
    if (Array.isArray(body.fallbackSlugs) && body.fallbackSlugs.length > 0) {
      availableSlugs = body.fallbackSlugs;
    } else {
      return json(
        {
          error:
            "No exercises are available yet to build a plan. Seed the exercises table or pass fallbackSlugs in the request.",
        },
        422,
      );
    }
  }

  const { data: settings } = await adminClient
    .from("user_settings")
    .select("ai_model, ai_model_planner, ai_instructions_override, ai_prompt_planner")
    .eq("owner_id", userId)
    .maybeSingle();
  const model = settings?.ai_model_planner || settings?.ai_model || "google/gemini-2.5-flash";

  const systemPrompt = [
    settings?.ai_prompt_planner?.trim() || DEFAULT_PLANNER_INSTRUCTIONS,
    settings?.ai_instructions_override?.trim(),
    mode === "workout" ? WORKOUT_SYSTEM_APPENDIX : PLAN_SYSTEM_APPENDIX,
  ]
    .filter(Boolean)
    .join("\n\n---\n");

  const userPrompt =
    mode === "workout"
      ? buildWorkoutPrompt({ goal, level, equipment, sessionMinutes, trackedOnly, availableSlugs, focus })
      : buildPlanPrompt({ goal, level, equipment, daysPerWeek, sessionMinutes, weeks, trackedOnly, availableSlugs });

  let planJson: PlanJson | null = null;
  let lastError = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw = await callProviderChain({
        openRouterKey,
        geminiKey,
        model,
        systemPrompt,
        userPrompt: attempt === 0 ? userPrompt : `${userPrompt}\n\nYour previous output was invalid: ${lastError}\nReturn ONLY strict JSON matching the schema, no markdown fences.`,
      });
      planJson = validatePlanJson(raw, availableSlugs);
      break;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }

  if (!planJson) {
    return json({ error: `The AI coach could not generate a valid ${mode === "workout" ? "workout" : "plan"}: ${lastError}` }, 502);
  }

  try {
    if (mode === "workout") {
      const day = planJson.days.find((d) => !d.isRest && d.exercises.length > 0);
      if (!day) return json({ error: "The AI returned a workout with no exercises — try again." }, 502);
      const { templateId, title } = await persistWorkout(adminClient, userId, day, {
        goal: focus || goal,
        planTitle: planJson.title,
        sessionMinutes,
      });
      return json({ templateId, title });
    }
    const planId = await persistPlan(adminClient, userId, planJson, { goal, weeks, model, sessionMinutes });
    return json({ planId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not save the generated workout";
    return json({ error: message }, 500);
  }
});

function clampInt(value: unknown, min: number, max: number, fallback: number) {
  const n = typeof value === "number" ? Math.round(value) : fallback;
  return Math.min(max, Math.max(min, Number.isFinite(n) ? n : fallback));
}

async function resolveAiKeys(adminClient: ReturnType<typeof createClient>) {
  let openRouterKey = Deno.env.get("OPENROUTER_API_KEY") || null;
  let geminiKey = Deno.env.get("GEMINI_API_KEY") || null;
  if (!openRouterKey) {
    const { data } = await adminClient.rpc("get_secret", { secret_name: "openrouter_api_key" });
    if (typeof data === "string" && data.trim()) openRouterKey = data.trim();
  }
  if (!geminiKey) {
    const { data } = await adminClient.rpc("get_secret", { secret_name: "gemini_api_key" });
    if (typeof data === "string" && data.trim()) geminiKey = data.trim();
  }
  return { openRouterKey, geminiKey };
}

const PLAN_SYSTEM_APPENDIX = `You are now generating a structured training plan, not chatting.
Output STRICT JSON only — no markdown fences, no commentary — matching exactly this schema:

{
  "title": string,
  "goal": string,
  "days": [
    {
      "dayIndex": number,        // 0-based index within the weekly cycle
      "weekday": number | null,  // 0=Sunday..6=Saturday, or null if unspecified
      "title": string,
      "focus": string,
      "isRest": boolean,
      "exercises": [
        {
          "slug": string,        // MUST be one of the provided allowed exercise slugs
          "sets": number,
          "targetReps": number | null,
          "targetSeconds": number | null,
          "restSeconds": number,
          "supersetGroup": number | null,
          "notes": string | null
        }
      ]
    }
  ]
}

Rules:
- Use ONLY exercise slugs from the allowed list provided in the user message. Never invent slugs.
- Rest days have isRest=true and an empty exercises array.
- Number of non-rest days should match the requested days per week; total days in the array should cover one full weekly cycle (7 entries recommended, rest days included).
- Keep each session realistic for the requested session length: include enough exercises and sets to genuinely FILL it, counting work time, the prescribed rest after every set, and ~90s between exercises.
- Vary rep ranges by each exercise's role and the goal: heavy compounds ~4-8 reps with 90-150s rests, accessories/isolation 8-15 reps with 60-90s rests, core/endurance work 12-20 reps or targetSeconds holds. Don't give every exercise the same scheme.
- No clinical, injury-prevention, or guaranteed-outcome claims in any text field (see AGENTS.md claim-safety rules).`;

const WORKOUT_SYSTEM_APPENDIX = `You are now generating ONE standalone workout for today, not a weekly plan and not a chat reply.
Output STRICT JSON only — no markdown fences, no commentary — matching exactly this schema:

{
  "title": string,             // short, specific to today's focus (e.g. "Chest & Triceps — Push Day")
  "goal": string,
  "days": [
    {
      "dayIndex": 0,
      "weekday": null,
      "title": string,         // same as the top-level title
      "focus": string,         // one-line description of the session
      "isRest": false,
      "exercises": [
        {
          "slug": string,      // MUST be one of the provided allowed exercise slugs
          "sets": number,
          "targetReps": number | null,
          "targetSeconds": number | null,
          "restSeconds": number,
          "supersetGroup": number | null,
          "notes": string | null
        }
      ]
    }
  ]
}

Rules:
- Exactly ONE day, isRest=false, 3-8 exercises sized to the requested session length.
- Honor the user's stated focus for today (muscle groups, vibe, constraints they mention).
- Use ONLY exercise slugs from the allowed list. Never invent slugs.
- Size the session to genuinely FILL the requested minutes: count work time, the prescribed rest after every set, and ~90s between exercises.
- Vary rep ranges by each exercise's role and the goal: heavy compounds ~4-8 reps with 90-150s rests, accessories/isolation 8-15 reps with 60-90s rests, core/endurance work 12-20 reps or targetSeconds holds. Don't give every exercise the same scheme.
- No clinical, injury-prevention, or guaranteed-outcome claims in any text field.`;

function buildWorkoutPrompt(input: {
  goal: string;
  level: string;
  equipment: string[];
  sessionMinutes: number;
  trackedOnly: boolean;
  availableSlugs: string[];
  focus: string;
}) {
  return JSON.stringify({
    task: "generate_single_workout",
    todays_focus: input.focus || "coach's choice based on the overall goal",
    overall_goal: input.goal,
    level: input.level,
    equipment: input.equipment,
    session_minutes: input.sessionMinutes,
    camera_tracked_exercises_only: input.trackedOnly,
    allowed_exercise_slugs: input.availableSlugs,
  });
}

function buildPlanPrompt(input: {
  goal: string;
  level: string;
  equipment: string[];
  daysPerWeek: number;
  sessionMinutes: number;
  weeks: number;
  trackedOnly: boolean;
  availableSlugs: string[];
}) {
  return JSON.stringify({
    task: "generate_plan",
    goal: input.goal,
    level: input.level,
    equipment: input.equipment,
    days_per_week: input.daysPerWeek,
    session_minutes: input.sessionMinutes,
    weeks: input.weeks,
    camera_tracked_exercises_only: input.trackedOnly,
    allowed_exercise_slugs: input.availableSlugs,
  });
}

function validatePlanJson(raw: string, availableSlugs: string[]): PlanJson {
  const cleaned = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error("response was not valid JSON");
  }

  if (typeof parsed !== "object" || parsed === null) throw new Error("response was not a JSON object");
  const obj = parsed as Record<string, unknown>;
  if (typeof obj.title !== "string" || !obj.title.trim()) throw new Error("missing title");
  if (typeof obj.goal !== "string" || !obj.goal.trim()) throw new Error("missing goal");
  if (!Array.isArray(obj.days) || obj.days.length === 0) throw new Error("missing days array");
  if (obj.days.length > 21) throw new Error("too many days (max 21 per weekly cycle block)");

  const slugSet = new Set(availableSlugs);
  const days: PlanDayJson[] = obj.days.map((d, i) => {
    if (typeof d !== "object" || d === null) throw new Error(`day ${i} is not an object`);
    const day = d as Record<string, unknown>;
    const isRest = Boolean(day.isRest);
    const exercisesRaw = Array.isArray(day.exercises) ? day.exercises : [];
    const exercises: PlanDayExercise[] = isRest
      ? []
      : exercisesRaw.slice(0, 12).map((e, j) => {
          if (typeof e !== "object" || e === null) throw new Error(`day ${i} exercise ${j} is not an object`);
          const ex = e as Record<string, unknown>;
          const slug = typeof ex.slug === "string" ? ex.slug : "";
          if (!slugSet.has(slug)) throw new Error(`day ${i} exercise ${j} uses unknown slug "${slug}"`);
          return {
            slug,
            // Clamp model output: this is untrusted, user-steerable content.
            sets: typeof ex.sets === "number" && ex.sets > 0 ? Math.min(10, Math.round(ex.sets)) : 3,
            targetReps: typeof ex.targetReps === "number" ? Math.min(100, Math.max(1, Math.round(ex.targetReps))) : undefined,
            targetSeconds: typeof ex.targetSeconds === "number" ? Math.min(600, Math.max(5, Math.round(ex.targetSeconds))) : undefined,
            restSeconds: typeof ex.restSeconds === "number" ? Math.min(600, Math.max(0, Math.round(ex.restSeconds))) : 60,
            supersetGroup: typeof ex.supersetGroup === "number" ? Math.round(ex.supersetGroup) : null,
            notes: typeof ex.notes === "string" ? ex.notes.slice(0, 300) : undefined,
          };
        });

    return {
      dayIndex: typeof day.dayIndex === "number" ? Math.round(day.dayIndex) : i,
      weekday: typeof day.weekday === "number" ? Math.round(day.weekday) : null,
      title: typeof day.title === "string" && day.title.trim() ? day.title.slice(0, 120) : `Day ${i + 1}`,
      focus: typeof day.focus === "string" ? day.focus.slice(0, 300) : "",
      isRest,
      exercises,
    };
  });

  if (days.every((d) => d.isRest)) throw new Error("plan has no training days");

  return { title: obj.title.slice(0, 120), goal: obj.goal.slice(0, 120), days };
}

/** Workout mode: save ONE ai-sourced template + its exercises. Deliberately
 * never touches plans/plan_days — the user's active weekly plan stays live. */
async function persistWorkout(
  adminClient: ReturnType<typeof createClient>,
  userId: string,
  day: PlanDayJson,
  meta: { goal: string; planTitle: string; sessionMinutes: number },
) {
  const title = day.title?.trim() || meta.planTitle;
  const { data: templateRow, error: templateError } = await adminClient
    .from("workout_templates")
    .insert({
      owner_id: userId,
      title,
      description: day.focus || null,
      source: "ai",
      goal: meta.goal.slice(0, 120) || null,
      est_duration_min: meta.sessionMinutes,
      is_public: false,
    })
    .select("id")
    .single();
  if (templateError || !templateRow) throw new Error(templateError?.message ?? "Could not create workout template");
  const templateId = templateRow.id as string;

  const rows = day.exercises.map((ex, index) => ({
    template_id: templateId,
    position: index + 1,
    exercise_slug: ex.slug,
    sets: ex.sets,
    target_reps: ex.targetReps ?? null,
    target_seconds: ex.targetSeconds ?? null,
    target_weight: null,
    rest_seconds: ex.restSeconds ?? 60,
    superset_group: ex.supersetGroup ?? null,
    notes: ex.notes ?? null,
  }));
  const { error: exercisesError } = await adminClient.from("template_exercises").insert(rows);
  if (exercisesError) throw new Error(exercisesError.message);

  return { templateId, title };
}

async function persistPlan(
  adminClient: ReturnType<typeof createClient>,
  userId: string,
  plan: PlanJson,
  meta: { goal: string; weeks: number; model: string; sessionMinutes: number },
) {
  // One active plan at a time: generating a new plan retires the old one.
  await adminClient.from("plans").update({ status: "archived" }).eq("owner_id", userId).eq("status", "active");

  const { data: planRow, error: planError } = await adminClient
    .from("plans")
    .insert({
      owner_id: userId,
      title: plan.title,
      goal: meta.goal,
      weeks: meta.weeks,
      source: "ai",
      model_used: meta.model,
      status: "active",
    })
    .select("id")
    .single();
  if (planError || !planRow) throw new Error(planError?.message ?? "Could not create plan");
  const planId = planRow.id as string;

  for (const day of plan.days) {
    let templateId: string | null = null;

    if (!day.isRest && day.exercises.length > 0) {
      const { data: templateRow, error: templateError } = await adminClient
        .from("workout_templates")
        .insert({
          owner_id: userId,
          title: day.title,
          description: day.focus || null,
          source: "ai",
          goal: meta.goal,
          est_duration_min: meta.sessionMinutes,
          is_public: false,
        })
        .select("id")
        .single();
      if (templateError || !templateRow) throw new Error(templateError?.message ?? "Could not create workout template");
      templateId = templateRow.id as string;

      const templateExerciseRows = day.exercises.map((ex, index) => ({
        template_id: templateId,
        position: index + 1,
        exercise_slug: ex.slug,
        sets: ex.sets,
        target_reps: ex.targetReps ?? null,
        target_seconds: ex.targetSeconds ?? null,
        target_weight: null,
        rest_seconds: ex.restSeconds ?? 60,
        superset_group: ex.supersetGroup ?? null,
        notes: ex.notes ?? null,
      }));

      const { error: exercisesError } = await adminClient.from("template_exercises").insert(templateExerciseRows);
      if (exercisesError) throw new Error(exercisesError.message);
    }

    const { error: planDayError } = await adminClient.from("plan_days").insert({
      plan_id: planId,
      day_index: day.dayIndex,
      weekday: day.weekday,
      template_id: templateId,
      title: day.title,
      focus: day.focus || null,
      is_rest: day.isRest,
    });
    if (planDayError) throw new Error(planDayError.message);
  }

  return planId;
}

async function callProviderChain(input: {
  openRouterKey: string | null;
  geminiKey: string | null;
  model: string;
  systemPrompt: string;
  userPrompt: string;
}): Promise<string> {
  if (input.openRouterKey) {
    try {
      return await callOpenRouter(input.openRouterKey, input.model, input.systemPrompt, input.userPrompt);
    } catch (err) {
      if (!input.geminiKey) throw err;
    }
  }
  if (input.geminiKey) {
    return await callGemini(input.geminiKey, "gemini-2.5-flash", input.systemPrompt, input.userPrompt);
  }
  throw new Error("No AI provider configured");
}

async function callOpenRouter(apiKey: string, model: string, systemPrompt: string, userPrompt: string) {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://repmint.app",
      "X-Title": "RepMint Plan Generator",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.4,
      response_format: { type: "json_object" },
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error?.message ?? `OpenRouter request failed (${response.status})`);
  }
  const text = payload?.choices?.[0]?.message?.content;
  if (typeof text !== "string" || !text.trim()) throw new Error("OpenRouter returned an empty response");
  return text.trim();
}

async function callGemini(apiKey: string, model: string, systemPrompt: string, userPrompt: string) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const response = await fetch(endpoint, {
    method: "POST",
    // Key goes in a header, never the URL: fetch errors embed the request URL
    // in their message, and our catch-all returns messages to the caller.
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      generationConfig: { temperature: 0.4, responseMimeType: "application/json" },
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error?.message ?? `Gemini request failed (${response.status})`);
  }
  const text = payload?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("").trim();
  if (!text) throw new Error("Gemini returned an empty response");
  return text;
}
