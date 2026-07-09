"use client";

// Social data-access: athlete search, friend requests, and friend profiles.
// Built on the friendships table (0001) — a directional request that becomes
// a mutual friendship on accept. RLS scopes everything: you can read only
// friendships you're party to, and only public / friend / requester profiles.

import { supabase } from "./supabaseClient";
import type { DbProfile, DbTemplateExercise, DbWorkoutTemplate } from "./types";

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

export type FriendshipStatus = "pending" | "accepted";

export type DbFriendship = {
  id: string;
  user_id: string;
  friend_id: string;
  status: FriendshipStatus;
  created_at: string;
};

/** A friendship row joined with the OTHER party's profile (null if their
 * profile isn't visible to us — e.g. they went private mid-request). */
export type FriendEntry = {
  friendship: DbFriendship;
  profile: DbProfile | null;
  /** True when the signed-in user sent the request. */
  outgoing: boolean;
};

export type SocialGraph = {
  friends: FriendEntry[];
  incoming: FriendEntry[];
  outgoing: FriendEntry[];
};

/** Everyone I have any friendship row with, split by state, profiles attached. */
export async function loadSocialGraph(): Promise<SocialGraph> {
  const client = requireSupabase();
  const me = await requireUserId();

  const { data: rows, error } = await client
    .from("friendships")
    .select("id, user_id, friend_id, status, created_at")
    .or(`user_id.eq.${me},friend_id.eq.${me}`)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const friendships = (rows ?? []) as DbFriendship[];
  const otherIds = [...new Set(friendships.map((f) => (f.user_id === me ? f.friend_id : f.user_id)))];

  const profiles = new Map<string, DbProfile>();
  if (otherIds.length > 0) {
    const { data: profRows } = await client
      .from("profiles")
      .select("id, username, display_name, avatar_url, goal, experience_level, equipment, is_public, units, created_at")
      .in("id", otherIds);
    for (const p of (profRows ?? []) as DbProfile[]) profiles.set(p.id, p);
  }

  const toEntry = (f: DbFriendship): FriendEntry => {
    const otherId = f.user_id === me ? f.friend_id : f.user_id;
    return { friendship: f, profile: profiles.get(otherId) ?? null, outgoing: f.user_id === me };
  };

  return {
    friends: friendships.filter((f) => f.status === "accepted").map(toEntry),
    incoming: friendships.filter((f) => f.status === "pending" && f.friend_id === me).map(toEntry),
    outgoing: friendships.filter((f) => f.status === "pending" && f.user_id === me).map(toEntry),
  };
}

/** Search discoverable athletes by username or display name (excludes me). */
export async function searchAthletes(query: string): Promise<DbProfile[]> {
  const client = requireSupabase();
  const me = await requireUserId();
  const q = query.trim();
  if (!q) return [];
  // Escape LIKE wildcards typed by the user, then wrap in %.
  const safe = q.replace(/[%_\\]/g, (m) => `\\${m}`);
  const { data, error } = await client
    .from("profiles")
    .select("id, username, display_name, avatar_url, goal, experience_level, equipment, is_public, units, created_at")
    .eq("is_public", true)
    .neq("id", me)
    .or(`username.ilike.%${safe}%,display_name.ilike.%${safe}%`)
    .limit(20);
  if (error) throw error;
  return (data ?? []) as DbProfile[];
}

export async function sendFriendRequest(friendId: string): Promise<void> {
  const client = requireSupabase();
  const me = await requireUserId();
  const { error } = await client.from("friendships").insert({ user_id: me, friend_id: friendId, status: "pending" });
  if (error) {
    // Unique pair constraint → request already exists in one direction.
    if (error.code === "23505") throw new Error("There's already a request between you two.");
    throw error;
  }
}

export async function acceptFriendRequest(friendshipId: string): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.from("friendships").update({ status: "accepted" }).eq("id", friendshipId);
  if (error) throw error;
}

/** Decline an incoming request, cancel an outgoing one, or unfriend. */
export async function removeFriendship(friendshipId: string): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.from("friendships").delete().eq("id", friendshipId);
  if (error) throw error;
}

/** Flip my own discoverability (profiles.is_public). */
export async function setDiscoverable(on: boolean): Promise<void> {
  const client = requireSupabase();
  const me = await requireUserId();
  const { error } = await client.from("profiles").update({ is_public: on }).eq("id", me);
  if (error) throw error;
}

/** Share/unshare one of MY templates (RLS blocks updating anyone else's). */
export async function setTemplatePublic(templateId: string, on: boolean): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.from("workout_templates").update({ is_public: on }).eq("id", templateId);
  if (error) throw error;
}

/** A friend's public workout templates (is_public=true), for their profile page. */
export async function listPublicTemplatesOf(ownerId: string): Promise<{ id: string; title: string; description: string | null }[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from("workout_templates")
    .select("id, title, description")
    .eq("owner_id", ownerId)
    .eq("is_public", true)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  return (data ?? []) as { id: string; title: string; description: string | null }[];
}

/**
 * Copy a friend's shared template into MY library: duplicates the template row
 * (owned by me, private, source "user") and all its exercises. The title gets
 * a short attribution suffix so the origin stays visible. Returns the new id.
 */
export async function saveSharedTemplate(templateId: string): Promise<string> {
  const client = requireSupabase();
  const me = await requireUserId();

  const { data: tplRow, error: tplError } = await client
    .from("workout_templates")
    .select("id, owner_id, title, description, goal, est_duration_min")
    .eq("id", templateId)
    .maybeSingle();
  if (tplError) throw tplError;
  if (!tplRow) throw new Error("That workout isn't shared anymore.");
  const tpl = tplRow as Pick<DbWorkoutTemplate, "id" | "owner_id" | "title" | "description" | "goal" | "est_duration_min">;

  const { data: exRows, error: exError } = await client
    .from("template_exercises")
    .select("position, exercise_slug, sets, target_reps, target_seconds, target_weight, rest_seconds, superset_group, notes")
    .eq("template_id", templateId)
    .order("position", { ascending: true });
  if (exError) throw exError;

  // Attribution suffix (best effort — skip if the owner's profile isn't visible).
  let suffix = "";
  if (tpl.owner_id && tpl.owner_id !== me) {
    const { data: owner } = await client
      .from("profiles")
      .select("username, display_name")
      .eq("id", tpl.owner_id)
      .maybeSingle();
    const o = owner as { username: string | null; display_name: string | null } | null;
    const who = o?.username ? `@${o.username}` : o?.display_name?.trim() || null;
    if (who) suffix = ` — from ${who}`;
  }

  const { data: created, error: insertError } = await client
    .from("workout_templates")
    .insert({
      owner_id: me,
      title: `${tpl.title}${suffix}`,
      description: tpl.description,
      source: "user",
      goal: tpl.goal,
      est_duration_min: tpl.est_duration_min,
      is_public: false,
    })
    .select("id")
    .single();
  if (insertError) throw insertError;
  const newId = (created as { id: string }).id;

  const exercises = (exRows ?? []) as Omit<DbTemplateExercise, "id" | "template_id" | "created_at">[];
  if (exercises.length > 0) {
    const { error: copyError } = await client
      .from("template_exercises")
      .insert(exercises.map((e) => ({ ...e, template_id: newId })));
    if (copyError) {
      // Don't leave an empty shell behind.
      await client.from("workout_templates").delete().eq("id", newId);
      throw copyError;
    }
  }

  return newId;
}

// ---------------------------------------------------------------------------
// Competitions (challenges) — week-long friendly contests between friends.
// RLS: a challenge is visible to its creator, its participants, and accepted
// friends of the creator. The leaderboard RPC only answers participants.
// ---------------------------------------------------------------------------

export type ChallengeMetric = "sessions" | "total_reps" | "total_sets" | "active_minutes";

export type DbChallenge = {
  id: string;
  creator_id: string;
  name: string;
  metric: ChallengeMetric;
  starts_at: string;
  ends_at: string;
  created_at: string;
};

/** A challenge plus everything the card needs about MY relationship to it. */
export type ChallengeEntry = {
  challenge: DbChallenge;
  participantCount: number;
  /** True when the signed-in user is a participant. */
  joined: boolean;
  /** True when the signed-in user created it. */
  mine: boolean;
};

export type LeaderboardRow = {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  value: number;
};

/** Every challenge visible to me, with participant state attached. */
export async function listChallenges(): Promise<{ me: string; challenges: ChallengeEntry[] }> {
  const client = requireSupabase();
  const me = await requireUserId();

  const { data: rows, error } = await client
    .from("challenges")
    .select("id, creator_id, name, metric, starts_at, ends_at, created_at")
    .order("ends_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  const challenges = (rows ?? []) as DbChallenge[];

  const counts = new Map<string, { count: number; joined: boolean }>();
  if (challenges.length > 0) {
    const { data: pRows, error: pError } = await client
      .from("challenge_participants")
      .select("challenge_id, user_id")
      .in("challenge_id", challenges.map((c) => c.id));
    if (pError) throw pError;
    for (const p of (pRows ?? []) as { challenge_id: string; user_id: string }[]) {
      const cur = counts.get(p.challenge_id) ?? { count: 0, joined: false };
      cur.count += 1;
      if (p.user_id === me) cur.joined = true;
      counts.set(p.challenge_id, cur);
    }
  }

  return {
    me,
    challenges: challenges.map((c) => {
      const cur = counts.get(c.id) ?? { count: 0, joined: false };
      return { challenge: c, participantCount: cur.count, joined: cur.joined, mine: c.creator_id === me };
    }),
  };
}

/** Start a competition now: insert the challenge, then join it myself. */
export async function createChallenge(input: { name: string; metric: ChallengeMetric; days: 3 | 5 | 7 }): Promise<string> {
  const client = requireSupabase();
  const me = await requireUserId();
  const starts = new Date();
  const ends = new Date(starts.getTime() + input.days * 24 * 60 * 60 * 1000);

  const { data, error } = await client
    .from("challenges")
    .insert({
      creator_id: me,
      name: input.name.trim() || "Push Week",
      metric: input.metric,
      starts_at: starts.toISOString(),
      ends_at: ends.toISOString(),
    })
    .select("id")
    .single();
  if (error) throw error;
  const id = (data as { id: string }).id;

  const { error: joinError } = await client.from("challenge_participants").insert({ challenge_id: id, user_id: me });
  if (joinError) throw joinError;
  return id;
}

export async function joinChallenge(challengeId: string): Promise<void> {
  const client = requireSupabase();
  const me = await requireUserId();
  const { error } = await client.from("challenge_participants").insert({ challenge_id: challengeId, user_id: me });
  if (error) {
    if (error.code === "23505") return; // already in — nothing to do
    throw error;
  }
}

export async function leaveChallenge(challengeId: string): Promise<void> {
  const client = requireSupabase();
  const me = await requireUserId();
  const { error } = await client.from("challenge_participants").delete().eq("challenge_id", challengeId).eq("user_id", me);
  if (error) throw error;
}

/** Creator only (RLS blocks everyone else). */
export async function deleteChallenge(challengeId: string): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.from("challenges").delete().eq("id", challengeId);
  if (error) throw error;
}

/** Ranked standings, best first. Only participants/creator may ask. */
export async function getLeaderboard(challengeId: string): Promise<LeaderboardRow[]> {
  const client = requireSupabase();
  const { data, error } = await client.rpc("challenge_leaderboard", { cid: challengeId });
  if (error) throw error;
  return (data ?? []) as LeaderboardRow[];
}
