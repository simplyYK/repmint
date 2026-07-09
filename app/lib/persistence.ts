"use client";

// Supabase persistence for signed-in users. All writes are best-effort: the app
// is local-first, so a signed-out user (or a failed write) never blocks
// training — history still lives in localStorage. When signed in, this is the
// "memory of past workouts" that powers progress and the AI coach.

import { supabase } from "./supabaseClient";
import { getMovement } from "./movements/registry";
import type { RepEvent } from "./tracking/repEngine";
import type { Profile, SetResult } from "./types";

export function goalToDb(goal: string) {
  const n = goal.toLowerCase();
  if (n.includes("muscle")) return "muscle_building";
  if (n.includes("mobility")) return "mobility_flow";
  if (n.includes("consistency")) return "consistency";
  if (n.includes("return")) return "return_to_gym_confidence";
  if (n.includes("technique")) return "technique_practice";
  return "strength_foundation";
}

export function levelToDb(level: string) {
  if (level === "Intermediate") return "intermediate";
  if (level === "Advanced") return "advanced";
  return "beginner";
}

export function equipmentToDb(equipment: string): string {
  if (equipment === "Dumbbells") return "dumbbells";
  if (equipment === "Full gym") return "full_gym";
  return "bodyweight";
}

export async function persistProfile(userId: string, profile: Profile) {
  if (!supabase) return;
  await supabase
    .from("profiles")
    .update({
      display_name: profile.name,
      primary_goal: goalToDb(profile.goal),
      experience_level: levelToDb(profile.level),
      available_equipment: [equipmentToDb(profile.equipment)],
      workouts_per_week: profile.schedule,
      coaching_intensity:
        profile.coaching === "Quiet" ? "minimal" : profile.coaching === "Detailed" ? "active" : "standard",
      onboarding_completed_at: new Date().toISOString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    })
    .eq("id", userId);
}

export async function persistSetResult(userId: string, result: SetResult, repEvents: RepEvent[]) {
  if (!supabase) return;
  const movement = getMovement(result.movement);

  const { data: session, error: sessionError } = await supabase
    .from("workout_sessions")
    .insert({
      user_id: userId,
      name: `${result.movementName} camera set`,
      status: "completed",
      started_at: result.date,
      completed_at: result.date,
      duration_seconds: result.seconds,
      active_seconds: result.tut,
      sample_output: false,
    })
    .select("id")
    .single();
  if (sessionError || !session) throw sessionError ?? new Error("Could not save session");

  // Link a movement profile when this exercise maps to a seeded one.
  let movementProfileId: string | null = null;
  if (movement.dbSlug) {
    const { data: profile } = await supabase
      .from("movement_profiles")
      .select("id")
      .eq("slug", movement.dbSlug)
      .maybeSingle();
    movementProfileId = profile?.id ?? null;
  }

  const cues = result.faults.map((f) => f.cue);
  // Let Postgres generate the UUID; capture it for child rows.
  const { data: setRow, error: setError } = await supabase
    .from("set_results")
    .insert({
      user_id: userId,
      session_id: session.id,
      movement_profile_id: movementProfileId,
      exercise_name: result.movementName,
      set_number: 1,
      target_reps: result.targetReps ?? null,
      reps_count: result.reps,
      target_seconds: result.targetSeconds ?? null,
      duration_seconds: result.seconds,
      tut_seconds: result.tut,
      avg_rep_seconds: result.avgRepSeconds ?? null,
      tempo: result.tempo,
      tempo_data: { avg_rep_seconds: result.avgRepSeconds ?? null, rep_count: repEvents.length },
      range_signal: result.faults.some((f) => f.signal === "short_range") ? "shortened" : "consistent",
      control_signal: result.faults.length > 2 ? "variable" : "steady",
      cues_triggered: cues,
      next_focus: result.cue,
      tracker_version: "repmint-camera-v2",
      tracker_payload: { source: result.source, category: result.category, movement: result.movement },
      completed_at: result.date,
    })
    .select("id")
    .single();
  if (setError || !setRow) throw setError ?? new Error("Could not save set");

  if (repEvents.length) {
    await supabase.from("rep_events").insert(
      repEvents.slice(0, 60).map((e) => ({
        user_id: userId,
        set_result_id: setRow.id,
        rep_number: e.repNumber,
        duration_seconds: e.durationSeconds,
        tut_seconds: e.tutSeconds,
        eccentric_seconds: e.eccentricSeconds,
        pause_seconds: e.pauseSeconds,
        concentric_seconds: e.concentricSeconds,
        metrics: { peak_depth: e.peakDepth },
      })),
    );
  }

  if (result.faults.length) {
    await supabase.from("form_signal_summaries").insert(
      result.faults.map((f) => ({
        user_id: userId,
        set_result_id: setRow.id,
        movement_profile_id: movementProfileId,
        signal_name: f.signal,
        signal_value: `${f.count}x`,
        severity: Math.min(3, f.count),
        observed_count: f.count,
        metadata: { cue: f.cue },
      })),
    );
  }
}
