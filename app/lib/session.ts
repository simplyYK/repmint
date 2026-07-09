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
 * getUser() resolves, so guards can avoid flashing the wrong screen.
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
    supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      setUser(data.user ?? null);
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
