"use client";

// Client wrapper around the ai-coach and generate-plan Supabase edge
// functions. Every call passes the signed-in user's session token so the
// functions can verify the caller and scope reads/writes with RLS.
//
// Degrades gracefully: if Supabase isn't configured, or the user has no
// session, or no AI provider key is configured on the server, callers get a
// typed error string back instead of a thrown exception — screens should
// render that as an inline empty-state, never crash.

import { supabase } from "./supabaseClient";

export type CoachChatMode = "chat" | "post_session" | "recommendation";

export type AskCoachInput = {
  message: string;
  mode?: CoachChatMode;
  sessionId?: string;
  /** Conversation this message belongs to (omit for quick-ask dock chats). */
  conversationId?: string;
  /** What the user is currently looking at (route + on-screen summary), so the
   * coach can answer "about this page" questions. */
  pageContext?: string;
};

export type CoachWorkout = { id: string; title: string; exerciseCount: number };

export type AskCoachResult =
  | { message: string; model: string; workout?: CoachWorkout | null }
  | { error: string };

export type GeneratePlanInput = {
  goal: string;
  level: string;
  equipment: string[];
  daysPerWeek: number;
  sessionMinutes: number;
  weeks: number;
  /** Restrict the plan to camera-tracked (tier 1-2) exercises. */
  trackedOnly?: boolean;
  /** Only used if the exercises table is empty server-side. */
  fallbackSlugs?: string[];
};

export type GeneratePlanResult = { planId: string } | { error: string };

async function getAccessToken(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export type AgentPrompts = { coach: string; planner: string };

/** GET the built-in default system prompts for both AI agents (chat coach +
 * workout/plan creator). Per-user overrides are applied server-side only.
 * Public, no auth required. */
export async function getAgentPrompts(): Promise<AgentPrompts | { error: string }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !anonKey) return { error: "Supabase is not configured." };
  try {
    // supabase-js's `functions.invoke` always issues a POST, so hit the GET
    // ?mode=instructions route directly with fetch instead.
    const res = await fetch(`${url}/functions/v1/ai-coach?mode=instructions`, {
      method: "GET",
      headers: { Authorization: `Bearer ${anonKey}`, apikey: anonKey },
    });
    const json = await res.json();
    if (!res.ok) return { error: json?.error ?? "Could not load agent prompts." };
    return {
      coach: (json.coach as string) ?? (json.instructions as string) ?? "",
      planner: (json.planner as string) ?? "",
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not load agent prompts." };
  }
}

/** Legacy alias — the Settings screen previously showed only the coach prompt. */
export async function getCoachInstructions(): Promise<{ instructions: string } | { error: string }> {
  const res = await getAgentPrompts();
  if ("error" in res) return res;
  return { instructions: res.coach };
}

export async function askCoach(input: AskCoachInput): Promise<AskCoachResult> {
  if (!supabase) return { error: "Supabase is not configured." };
  const token = await getAccessToken();
  if (!token) return { error: "Sign in to talk with the AI coach." };

  const { data, error } = await supabase.functions.invoke("ai-coach", {
    body: {
      message: input.message,
      mode: input.mode ?? "chat",
      sessionId: input.sessionId,
      conversationId: input.conversationId,
      pageContext: input.pageContext,
    },
    headers: { Authorization: `Bearer ${token}` },
  });

  if (error) {
    return { error: await extractFunctionError(error, data) };
  }
  if (data?.error) return { error: data.error as string };
  return {
    message: data.message as string,
    model: data.model as string,
    workout: (data.workout as CoachWorkout | null) ?? null,
  };
}

export async function generatePlan(input: GeneratePlanInput): Promise<GeneratePlanResult> {
  if (!supabase) return { error: "Supabase is not configured." };
  const token = await getAccessToken();
  if (!token) return { error: "Sign in to generate a plan." };

  const { data, error } = await supabase.functions.invoke("generate-plan", {
    body: {
      goal: input.goal,
      level: input.level,
      equipment: input.equipment,
      daysPerWeek: input.daysPerWeek,
      sessionMinutes: input.sessionMinutes,
      weeks: input.weeks,
      trackedOnly: input.trackedOnly ?? false,
      fallbackSlugs: input.fallbackSlugs,
    },
    headers: { Authorization: `Bearer ${token}` },
  });

  if (error) {
    return { error: await extractFunctionError(error, data) };
  }
  if (data?.error) return { error: data.error as string };
  return { planId: data.planId as string };
}

// supabase-js throws a generic FunctionsHttpError on non-2xx; the real
// message is in the response body, which the SDK doesn't surface directly.
async function extractFunctionError(error: unknown, data: unknown): Promise<string> {
  if (data && typeof data === "object" && "error" in data && typeof (data as { error: unknown }).error === "string") {
    return (data as { error: string }).error;
  }
  if (error && typeof error === "object" && "context" in error) {
    try {
      const ctx = (error as { context: Response }).context;
      const body = await ctx.json();
      if (body?.error) return body.error as string;
    } catch {
      // ignore parse failure, fall through to generic message
    }
  }
  return error instanceof Error ? error.message : "The AI coach is unavailable right now.";
}
