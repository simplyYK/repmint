"use client";

// Client-side auth/session helpers + a React hook. Because the app is a static
// export (`output: "export"`), the auth guard has to be client-side — this hook
// is the single source of truth for "is someone signed in" across the app shell
// and every route.

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "./supabaseClient";

export type SessionState = {
  user: User | null;
  loading: boolean;
  configured: boolean;
};

/**
 * Subscribes to Supabase auth state. `loading` is true until the first
 * session read resolves, so guards can avoid flashing the wrong screen.
 *
 * Uses getSession() (local storage, no network) for the initial answer —
 * getUser() validates over the network and can transiently report "no user"
 * while the access token is being refreshed after a hard reload, which used
 * to bounce signed-in users through /auth on every refresh. RLS still
 * enforces real authorization server-side on every query.
 */
export function useSession(): SessionState {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setUser(data.session?.user ?? null);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, sess) => {
      setUser(sess?.user ?? null);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return { user, loading, configured: Boolean(supabase) };
}

export async function signOut() {
  if (supabase) await supabase.auth.signOut();
}
