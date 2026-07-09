"use client";

// Typed Supabase data-access helpers for the RepMint frontend. All functions
// are best-effort against the signed-in user's own rows (RLS-enforced) and
// throw on genuine failures so callers can show an error state — there is no
// local-storage fallback here (that lived in the old persistence.ts, which
// this supersedes for the rebuilt schema).

import { supabase } from "./supabaseClient";
import type {
  DbExercise,
  DbPlan,
  DbPlanDay,
  DbSession,
  DbSessionSet,
  DbUserSettings,
  DbWorkoutTemplate,
  DbTemplateExercise,
} from "./types";

function requireSupabase() {
  if (!supabase) throw new Error("Supabase is not configured.");
  return supabase;
}

async function requireUserId(): Promise<string> {
  const client = requireSupabase();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new Error("Sign in to continue.");
  return data.user.id;
}

// ---------------------------------------------------------------------------
// Sessions (the calendar) + session_sets
// ---------------------------------------------------------------------------

export type SaveSessionInput = {
  id?: string;
  templateId?: string | null;
  planDayId?: string | null;
  title?: string;
  startedAt: string;
  endedAt?: string | null;
  status?: DbSession["status"];
  notes?: string | null;
};

export type SaveSessionSetInput = {
  exerciseSlug: string;
  setIndex: number;
  reps?: number | null;
  seconds?: number | null;
  weight?: number | null;
  weightUnit?: DbSessionSet["weight_unit"];
  isBodyweight?: boolean;
  avgFormScore?: number | null;
  romScore?: number | null;
  tutSeconds?: number | null;
  topCues?: string[];
  repMetrics?: Record<string, unknown>[];
};

/**
 * Upserts a session and inserts its sets, then rolls up total_reps /
 * total_sets / active_seconds / avg_form_score onto the session row.
 * Returns the session id.
 */
export async function saveSession(session: SaveSessionInput, sets: SaveSessionSetInput[]): Promise<string> {
  const client = requireSupabase();
  const ownerId = await requireUserId();

  const { data: sessionRow, error: sessionError } = await client
    .from("sessions")
    .upsert(
      {
        id: session.id,
        owner_id: ownerId,
        template_id: session.templateId ?? null,
        plan_day_id: session.planDayId ?? null,
        title: session.title ?? null,
        started_at: session.startedAt,
        ended_at: session.endedAt ?? null,
        status: session.status ?? "completed",
        notes: session.notes ?? null,
      },
      { onConflict: "id" },
    )
    .select("id")
    .single();
  if (sessionError || !sessionRow) throw sessionError ?? new Error("Could not save session");
  const sessionId = sessionRow.id as string;

  if (sets.length > 0) {
    const rows = sets.map((s) => ({
      session_id: sessionId,
      owner_id: ownerId,
      exercise_slug: s.exerciseSlug,
      set_index: s.setIndex,
      reps: s.reps ?? null,
      seconds: s.seconds ?? null,
      weight: s.weight ?? null,
      weight_unit: s.weightUnit ?? "kg",
      is_bodyweight: s.isBodyweight ?? true,
      avg_form_score: s.avgFormScore ?? null,
      rom_score: s.romScore ?? null,
      tut_seconds: s.tutSeconds ?? null,
      top_cues: s.topCues ?? [],
      rep_metrics: s.repMetrics ?? [],
    }));
    const { error: setsError } = await client.from("session_sets").insert(rows);
    if (setsError) throw setsError;
  }

  const totalReps = sets.reduce((sum, s) => sum + (s.reps ?? 0), 0);
  const totalSets = sets.length;
  const activeSeconds = sets.reduce((sum, s) => sum + (s.tutSeconds ?? s.seconds ?? 0), 0);
  const formScores = sets.map((s) => s.avgFormScore).filter((n): n is number => typeof n === "number");
  const avgFormScore = formScores.length ? formScores.reduce((a, b) => a + b, 0) / formScores.length : null;

  const { error: updateError } = await client
    .from("sessions")
    .update({
      total_reps: totalReps,
      total_sets: totalSets,
      active_seconds: Math.round(activeSeconds),
      avg_form_score: avgFormScore,
    })
    .eq("id", sessionId);
  if (updateError) throw updateError;

  return sessionId;
}

/** Sessions within a given month (for the /history calendar view). `month` is a Date anywhere in the target month. */
export async function listSessions(month: Date): Promise<DbSession[]> {
  const client = requireSupabase();
  const ownerId = await requireUserId();

  const start = new Date(month.getFullYear(), month.getMonth(), 1).toISOString();
  const end = new Date(month.getFullYear(), month.getMonth() + 1, 1).toISOString();

  const { data, error } = await client
    .from("sessions")
    .select("*")
    .eq("owner_id", ownerId)
    .gte("started_at", start)
    .lt("started_at", end)
    .order("started_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as DbSession[];
}

/** Full detail for one session: the session row + its sets, owner-scoped by RLS. */
export async function getSessionDetail(sessionId: string): Promise<{ session: DbSession; sets: DbSessionSet[] }> {
  const client = requireSupabase();
  const [{ data: session, error: sessionError }, { data: sets, error: setsError }] = await Promise.all([
    client.from("sessions").select("*").eq("id", sessionId).single(),
    client.from("session_sets").select("*").eq("session_id", sessionId).order("set_index", { ascending: true }),
  ]);
  if (sessionError || !session) throw sessionError ?? new Error("Session not found");
  if (setsError) throw setsError;
  return { session: session as DbSession, sets: (sets ?? []) as DbSessionSet[] };
}

// ---------------------------------------------------------------------------
// Progress
// ---------------------------------------------------------------------------

export type ExerciseProgressPoint = {
  owner_id: string;
  exercise_slug: string;
  day: string;
  max_weight: number | null;
  total_reps: number | null;
  avg_form_score: number | null;
  avg_rom_score: number | null;
  total_tut_seconds: number | null;
};

/** Per-day progress for one exercise slug, from the v_exercise_progress view. */
export async function getExerciseProgress(slug: string): Promise<ExerciseProgressPoint[]> {
  const client = requireSupabase();
  const ownerId = await requireUserId();
  const { data, error } = await client
    .from("v_exercise_progress")
    .select("*")
    .eq("owner_id", ownerId)
    .eq("exercise_slug", slug)
    .order("day", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ExerciseProgressPoint[];
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export async function getSettings(): Promise<DbUserSettings> {
  const client = requireSupabase();
  const ownerId = await requireUserId();
  const { data, error } = await client.from("user_settings").select("*").eq("owner_id", ownerId).maybeSingle();
  if (error) throw error;
  if (data) return data as DbUserSettings;

  // The bootstrap trigger normally creates this row on signup; if it's
  // somehow missing, create it now so the Settings screen has something to
  // read/write.
  const { data: created, error: createError } = await client
    .from("user_settings")
    .insert({ owner_id: ownerId })
    .select("*")
    .single();
  if (createError || !created) throw createError ?? new Error("Could not load settings");
  return created as DbUserSettings;
}

export async function upsertSettings(patch: Partial<Omit<DbUserSettings, "owner_id">>): Promise<DbUserSettings> {
  const client = requireSupabase();
  const ownerId = await requireUserId();
  const { data, error } = await client
    .from("user_settings")
    .upsert({ owner_id: ownerId, ...patch }, { onConflict: "owner_id" })
    .select("*")
    .single();
  if (error || !data) throw error ?? new Error("Could not save settings");
  return data as DbUserSettings;
}

// ---------------------------------------------------------------------------
// Templates (my workouts)
// ---------------------------------------------------------------------------

export type TemplateWithExercises = DbWorkoutTemplate & { exercises: DbTemplateExercise[] };

/** My templates + public/system templates readable per RLS. */
export async function listTemplates(): Promise<TemplateWithExercises[]> {
  const client = requireSupabase();
  const { data: templates, error } = await client
    .from("workout_templates")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rows = (templates ?? []) as DbWorkoutTemplate[];
  if (rows.length === 0) return [];

  const { data: exercises, error: exercisesError } = await client
    .from("template_exercises")
    .select("*")
    .in(
      "template_id",
      rows.map((t) => t.id),
    )
    .order("position", { ascending: true });
  if (exercisesError) throw exercisesError;

  const byTemplate = new Map<string, DbTemplateExercise[]>();
  for (const ex of (exercises ?? []) as DbTemplateExercise[]) {
    const list = byTemplate.get(ex.template_id) ?? [];
    list.push(ex);
    byTemplate.set(ex.template_id, list);
  }

  return rows.map((t) => ({ ...t, exercises: byTemplate.get(t.id) ?? [] }));
}

/** One template + its ordered exercises (readable if owned, public, or system). */
export async function getTemplate(templateId: string): Promise<TemplateWithExercises | null> {
  const client = requireSupabase();
  const { data: template, error } = await client
    .from("workout_templates")
    .select("*")
    .eq("id", templateId)
    .maybeSingle();
  if (error) throw error;
  if (!template) return null;
  const { data: exercises, error: exErr } = await client
    .from("template_exercises")
    .select("*")
    .eq("template_id", templateId)
    .order("position", { ascending: true });
  if (exErr) throw exErr;
  return { ...(template as DbWorkoutTemplate), exercises: (exercises ?? []) as DbTemplateExercise[] };
}

export type SaveTemplateInput = {
  id?: string;
  title: string;
  description?: string | null;
  goal?: string | null;
  estDurationMin?: number | null;
  isPublic?: boolean;
  exercises: Array<{
    exerciseSlug: string;
    position: number;
    sets: number;
    targetReps?: number | null;
    targetSeconds?: number | null;
    targetWeight?: number | null;
    restSeconds?: number;
    supersetGroup?: number | null;
    notes?: string | null;
  }>;
};

/** Creates or fully replaces a user-owned template's exercise list. Returns the template id. */
export async function saveTemplate(input: SaveTemplateInput): Promise<string> {
  const client = requireSupabase();
  const ownerId = await requireUserId();

  const { data: templateRow, error: templateError } = await client
    .from("workout_templates")
    .upsert(
      {
        id: input.id,
        owner_id: ownerId,
        title: input.title,
        description: input.description ?? null,
        source: "user",
        goal: input.goal ?? null,
        est_duration_min: input.estDurationMin ?? null,
        is_public: input.isPublic ?? false,
      },
      { onConflict: "id" },
    )
    .select("id")
    .single();
  if (templateError || !templateRow) throw templateError ?? new Error("Could not save template");
  const templateId = templateRow.id as string;

  // Replace the exercise list wholesale — simplest correct semantics for a builder UI.
  const { error: deleteError } = await client.from("template_exercises").delete().eq("template_id", templateId);
  if (deleteError) throw deleteError;

  if (input.exercises.length > 0) {
    const rows = input.exercises.map((ex) => ({
      template_id: templateId,
      position: ex.position,
      exercise_slug: ex.exerciseSlug,
      sets: ex.sets,
      target_reps: ex.targetReps ?? null,
      target_seconds: ex.targetSeconds ?? null,
      target_weight: ex.targetWeight ?? null,
      rest_seconds: ex.restSeconds ?? 60,
      superset_group: ex.supersetGroup ?? null,
      notes: ex.notes ?? null,
    }));
    const { error: insertError } = await client.from("template_exercises").insert(rows);
    if (insertError) throw insertError;
  }

  return templateId;
}

export async function deleteTemplate(templateId: string): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.from("workout_templates").delete().eq("id", templateId);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Plans
// ---------------------------------------------------------------------------

export type ActivePlan = DbPlan & { days: DbPlanDay[] };

/** The signed-in user's current active plan (most recent), with its days, or null. */
export async function getActivePlan(): Promise<ActivePlan | null> {
  const client = requireSupabase();
  const ownerId = await requireUserId();

  const { data: plan, error: planError } = await client
    .from("plans")
    .select("*")
    .eq("owner_id", ownerId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (planError) throw planError;
  if (!plan) return null;

  const { data: days, error: daysError } = await client
    .from("plan_days")
    .select("*")
    .eq("plan_id", plan.id)
    .order("day_index", { ascending: true });
  if (daysError) throw daysError;

  return { ...(plan as DbPlan), days: (days ?? []) as DbPlanDay[] };
}

// ---------------------------------------------------------------------------
// Exercises (read-only global bank)
// ---------------------------------------------------------------------------

export async function listExercises(): Promise<DbExercise[]> {
  const client = requireSupabase();
  const { data, error } = await client.from("exercises").select("*").order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as DbExercise[];
}

export async function getExercise(slug: string): Promise<DbExercise | null> {
  const client = requireSupabase();
  const { data, error } = await client.from("exercises").select("*").eq("slug", slug).maybeSingle();
  if (error) throw error;
  return (data as DbExercise | null) ?? null;
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export async function getProfile() {
  const client = requireSupabase();
  const ownerId = await requireUserId();
  const { data, error } = await client.from("profiles").select("*").eq("id", ownerId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function upsertProfile(patch: Record<string, unknown>) {
  const client = requireSupabase();
  const ownerId = await requireUserId();
  const { data, error } = await client
    .from("profiles")
    .update(patch)
    .eq("id", ownerId)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// Coach conversations (multiple chats; long-term memories are server-managed)
// ---------------------------------------------------------------------------

import type { DbCoachConversation } from "./types";

export async function listConversations(): Promise<DbCoachConversation[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from("coach_conversations")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as DbCoachConversation[];
}

export async function createConversation(title?: string): Promise<DbCoachConversation> {
  const client = requireSupabase();
  const ownerId = await requireUserId();
  const { data, error } = await client
    .from("coach_conversations")
    .insert({ owner_id: ownerId, title: title ?? null })
    .select("*")
    .single();
  if (error || !data) throw error ?? new Error("Could not create the conversation");
  return data as DbCoachConversation;
}

export async function renameConversation(id: string, title: string): Promise<void> {
  const client = requireSupabase();
  const { error } = await client
    .from("coach_conversations")
    .update({ title, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function touchConversation(id: string): Promise<void> {
  const client = requireSupabase();
  await client
    .from("coach_conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", id);
}

export async function deleteConversation(id: string): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.from("coach_conversations").delete().eq("id", id);
  if (error) throw error;
}

export async function listConversationMessages(conversationId: string) {
  const client = requireSupabase();
  const { data, error } = await client
    .from("coach_messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(200);
  if (error) throw error;
  return data ?? [];
}
