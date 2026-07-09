"use client";

// Social data-access: athlete search, friend requests, and friend profiles.
// Built on the friendships table (0001) — a directional request that becomes
// a mutual friendship on accept. RLS scopes everything: you can read only
// friendships you're party to, and only public / friend / requester profiles.

import { supabase } from "./supabaseClient";
import type { DbProfile } from "./types";

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
