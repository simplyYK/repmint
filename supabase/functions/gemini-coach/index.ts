import { createClient } from "npm:@supabase/supabase-js@2";

type CoachMode = "chat" | "daily_recommendation" | "set_review" | "plan_builder";

type CoachRequest = {
  mode?: CoachMode;
  message?: string;
  conversationId?: string;
  sessionId?: string;
  setResultId?: string;
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
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
  const geminiModel = Deno.env.get("GEMINI_MODEL") ?? "gemini-2.5-flash";

  if (!supabaseUrl || !anonKey || !serviceRoleKey || !geminiApiKey) {
    return json({ error: "AI coach is not configured yet. Add GEMINI_API_KEY to enable set review." }, 500);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return json({ error: "Missing authorization header" }, 401);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: authData, error: authError } = await userClient.auth.getUser();
  if (authError || !authData.user) {
    return json({ error: "Invalid user session" }, 401);
  }

  const userId = authData.user.id;
  const body = (await req.json().catch(() => ({}))) as CoachRequest;
  const mode: CoachMode = body.mode ?? "chat";
  const message = body.message?.trim() ?? "";

  if (!message && mode === "chat") {
    return json({ error: "Message is required for coach chat" }, 400);
  }

  const run = await adminClient
    .from("ai_agent_runs")
    .insert({
      user_id: userId,
      conversation_id: body.conversationId ?? null,
      run_type: mode,
      model: geminiModel,
      status: "running",
      request_payload: { mode, message, sessionId: body.sessionId, setResultId: body.setResultId },
    })
    .select("id")
    .single();

  if (run.error) {
    return json({ error: run.error.message }, 500);
  }

  try {
    const context = await loadUserContext(adminClient, userId, body);
    const conversationId = await ensureConversation(adminClient, userId, body.conversationId, mode);

    if (message) {
      await adminClient.from("ai_messages").insert({
        conversation_id: conversationId,
        user_id: userId,
        role: "user",
        content: message,
        metadata: { mode },
      });
    }

    const geminiResponse = await callGemini({
      apiKey: geminiApiKey,
      model: geminiModel,
      mode,
      message,
      context,
    });

    const coachText = extractText(geminiResponse);
    const parsed = parseCoachJson(coachText);
    const assistantMessage = parsed.coach_message || coachText;

    await adminClient.from("ai_messages").insert({
      conversation_id: conversationId,
      user_id: userId,
      role: "assistant",
      content: assistantMessage,
      metadata: { mode, parsed },
    });

    const recommendationRows = (parsed.recommendations ?? []).slice(0, 4).map((rec) => ({
      user_id: userId,
      agent_run_id: run.data.id,
      session_id: body.sessionId ?? null,
      title: rec.title,
      recommendation: rec.recommendation,
      reason: rec.reason,
      action_label: rec.action_label ?? null,
      priority: rec.priority ?? 1,
      metadata: { mode },
    }));

    if (recommendationRows.length > 0) {
      await adminClient.from("ai_recommendations").insert(recommendationRows);
    }

    await adminClient
      .from("ai_agent_runs")
      .update({
        status: "succeeded",
        conversation_id: conversationId,
        response_payload: { raw: geminiResponse, parsed },
        completed_at: new Date().toISOString(),
      })
      .eq("id", run.data.id);

    return json({
      conversationId,
      message: assistantMessage,
      recommendations: recommendationRows,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown Gemini coach error";
    await adminClient
      .from("ai_agent_runs")
      .update({
        status: "failed",
        error_message: errorMessage,
        completed_at: new Date().toISOString(),
      })
      .eq("id", run.data.id);

    return json({ error: errorMessage }, 500);
  }
});

async function loadUserContext(adminClient: ReturnType<typeof createClient>, userId: string, body: CoachRequest) {
  const [profile, settings, activePlans, recentSessions, recentSets, targetSet] = await Promise.all([
    adminClient.from("profiles").select("*").eq("id", userId).single(),
    adminClient.from("user_settings").select("*").eq("user_id", userId).maybeSingle(),
    adminClient
      .from("training_plans")
      .select("id,name,goal,status,current_week,sessions_per_week,progression_rules,created_at")
      .eq("user_id", userId)
      .in("status", ["active", "draft"])
      .order("created_at", { ascending: false })
      .limit(3),
    adminClient
      .from("workout_sessions")
      .select("id,name,status,started_at,completed_at,duration_seconds,active_seconds,total_reps,total_sets,avg_tut_seconds,recurring_cues,ai_summary")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(8),
    adminClient
      .from("set_results")
      .select("id,session_id,exercise_name,set_number,reps_count,target_reps,duration_seconds,tut_seconds,avg_rep_seconds,tempo,range_signal,control_signal,stability_signal,cues_triggered,next_focus,completed_at")
      .eq("user_id", userId)
      .order("completed_at", { ascending: false })
      .limit(12),
    body.setResultId
      ? adminClient
          .from("set_results")
          .select("*")
          .eq("user_id", userId)
          .eq("id", body.setResultId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  return {
    profile: profile.data,
    settings: settings.data,
    activePlans: activePlans.data ?? [],
    recentSessions: recentSessions.data ?? [],
    recentSets: recentSets.data ?? [],
    targetSet: targetSet.data,
  };
}

async function ensureConversation(
  adminClient: ReturnType<typeof createClient>,
  userId: string,
  conversationId: string | undefined,
  mode: CoachMode,
) {
  if (conversationId) {
    const existing = await adminClient
      .from("ai_conversations")
      .select("id")
      .eq("id", conversationId)
      .eq("user_id", userId)
      .maybeSingle();

    if (existing.data) {
      return existing.data.id as string;
    }
  }

  const created = await adminClient
    .from("ai_conversations")
    .insert({
      user_id: userId,
      title: mode === "chat" ? "Coach chat" : mode.replaceAll("_", " "),
      context: { mode },
    })
    .select("id")
    .single();

  if (created.error) {
    throw new Error(created.error.message);
  }

  return created.data.id as string;
}

async function callGemini(input: {
  apiKey: string;
  model: string;
  mode: CoachMode;
  message: string;
  context: unknown;
}) {
  const prompt = buildCoachPrompt(input.mode, input.message, input.context);
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${input.model}:generateContent?key=${input.apiKey}`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: REPMINT_SYSTEM_INSTRUCTION }],
      },
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.4,
        responseMimeType: "application/json",
      },
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error?.message ?? "Gemini request failed");
  }

  return payload;
}

function buildCoachPrompt(mode: CoachMode, message: string, context: unknown) {
  return JSON.stringify({
    task: mode,
    user_message: message,
    repmint_context: context,
    output_contract: {
      coach_message: "Short, direct trainer-style response. No clinical or guaranteed-outcome claims.",
      recommendations: [
        {
          title: "Short title",
          recommendation: "Practical next action",
          reason: "Plain-language reason based on recent training data",
          action_label: "Optional short CTA",
          priority: "1, 2, or 3",
        },
      ],
    },
  });
}

function extractText(payload: any) {
  return (
    payload?.candidates?.[0]?.content?.parts
      ?.map((part: { text?: string }) => part.text ?? "")
      .join("")
      .trim() || "{}"
  );
}

function parseCoachJson(text: string): {
  coach_message?: string;
  recommendations?: Array<{
    title: string;
    recommendation: string;
    reason: string;
    action_label?: string;
    priority?: number;
  }>;
} {
  try {
    const parsed = JSON.parse(text);
    return {
      coach_message: typeof parsed.coach_message === "string" ? parsed.coach_message : undefined,
      recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
    };
  } catch {
    return { coach_message: text, recommendations: [] };
  }
}

const REPMINT_SYSTEM_INSTRUCTION = `
You are the RepMint AI camera coach, a practical personal trainer in the user's pocket.
Use only supportive, non-clinical coaching language.
Do not diagnose, claim injury prevention, promise perfect form, or guarantee body changes.
Give one or two useful next actions based on the user's goal, recent sessions, set results, cues, tempo, rep counts, and time under tension.
Frame all numbers from demo or sample data as training context, not precise medical or biomechanical assessment.
Return valid JSON only.
`;
