"use client";

// /auth — sign in / create account (email+password + magic link) and, on first
// sign-in, a short onboarding that fills the user's profile (username, display
// name, goal, experience, equipment, units). The DB trigger creates the profiles
// row on signup; here we complete it. Static export → all client-side.

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase, isSupabaseConfigured } from "../lib/supabaseClient";
import { useSession } from "../lib/session";
import { getProfile, upsertProfile } from "../lib/db";
import { Onboarding } from "../components/auth/Onboarding";

type Mode = "sign-in" | "sign-up" | "magic";

function AuthInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { user, loading } = useSession();
  const [mode, setMode] = useState<Mode>(params.get("mode") === "sign-up" ? "sign-up" : "sign-in");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<{ tone: "info" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean | null>(null);

  // Once signed in, decide: onboard (no username yet) or go to the hub.
  useEffect(() => {
    if (loading || !user) return;
    let active = true;
    getProfile()
      .then((profile) => {
        if (!active) return;
        const done = profile && (profile as { username?: string | null }).username;
        setNeedsOnboarding(!done);
      })
      .catch(() => active && setNeedsOnboarding(true));
    return () => {
      active = false;
    };
  }, [loading, user]);

  useEffect(() => {
    if (needsOnboarding === false) router.replace("/hub");
  }, [needsOnboarding, router]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);
    if (!supabase) {
      setMessage({ tone: "error", text: "Accounts aren't configured on this build yet." });
      return;
    }
    setBusy(true);
    try {
      if (mode === "magic") {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: typeof window !== "undefined" ? `${window.location.origin}/hub` : undefined },
        });
        if (error) throw error;
        setMessage({ tone: "info", text: "Check your email for a sign-in link." });
      } else if (mode === "sign-up") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: displayName || "RepMint athlete" } },
        });
        if (error) throw error;
        // If email confirmation is on, there won't be a session yet.
        const { data: sess } = await supabase.auth.getSession();
        if (!sess.session) {
          setMessage({ tone: "info", text: "Account created. Check your email to confirm, then sign in." });
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      setMessage({ tone: "error", text: err instanceof Error ? err.message : "Something went wrong. Try again." });
    } finally {
      setBusy(false);
    }
  };

  // Signed in and needs onboarding → show it.
  if (user && needsOnboarding === true) {
    return (
      <main className="auth-screen onboarding-screen">
        <Onboarding
          userId={user.id}
          defaultName={
            (user.user_metadata?.display_name as string | undefined) || displayName || email.split("@")[0]
          }
          onDone={async (profilePatch) => {
            await upsertProfile(profilePatch);
            router.replace("/hub");
          }}
        />
      </main>
    );
  }

  if (user && needsOnboarding === null) {
    return (
      <div className="shell-boot">
        <img className="shell-boot-mark" src="/brand/logomark.svg" alt="" />
        <span>Setting up your profile…</span>
      </div>
    );
  }

  return (
    <main className="auth-screen">
      <div className="auth-aside" aria-hidden>
        <Link href="/" className="brand-lockup landing-brand">
          <img src="/brand/logomark.svg" alt="" className="brand-lockup-mark" />
          <strong>RepMint</strong>
        </Link>
        <h2>Your AI camera coach, ready when you are.</h2>
        <ul className="auth-points">
          <li>Rep counting, time under tension and tempo</li>
          <li>One clear form cue at a time</li>
          <li>115-exercise library with plans and progress</li>
          <li>Training saved to your profile, on any device</li>
        </ul>
      </div>

      <div className="auth-panel">
        <Link href="/" className="auth-back">
          ← Back
        </Link>
        <div className="brand-lockup landing-brand auth-panel-brand">
          <img src="/brand/logomark.svg" alt="" className="brand-lockup-mark" />
          <strong>RepMint</strong>
        </div>
        <h1>
          {mode === "sign-up" ? "Create your account" : mode === "magic" ? "Get a magic link" : "Welcome back"}
        </h1>
        <p className="auth-sub">
          {mode === "sign-up"
            ? "Save your training and pick up on any device."
            : mode === "magic"
              ? "We'll email you a one-tap sign-in link."
              : "Sign in to sync your training and history."}
        </p>

        <div className="auth-tabs" role="tablist">
          <button className={mode === "sign-in" ? "active" : ""} onClick={() => setMode("sign-in")} type="button" role="tab" aria-selected={mode === "sign-in"}>
            Sign in
          </button>
          <button className={mode === "sign-up" ? "active" : ""} onClick={() => setMode("sign-up")} type="button" role="tab" aria-selected={mode === "sign-up"}>
            Create account
          </button>
        </div>

        <form className="auth-form" onSubmit={submit}>
          {mode === "sign-up" && (
            <label>
              <span>Display name</span>
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your name" autoComplete="name" />
            </label>
          )}
          <label>
            <span>Email</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" autoComplete="email" required />
          </label>
          {mode !== "magic" && (
            <label>
              <span>Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
                minLength={6}
                required
              />
            </label>
          )}
          <button className="btn btn-primary btn-full auth-submit" type="submit" disabled={busy}>
            {busy ? "Please wait…" : mode === "sign-up" ? "Create account" : mode === "magic" ? "Send magic link" : "Sign in"}
          </button>
        </form>

        <button className="auth-link" type="button" onClick={() => setMode(mode === "magic" ? "sign-in" : "magic")}>
          {mode === "magic" ? "Use email and password instead" : "Email me a magic link instead"}
        </button>

        {message && <div className={`notice notice-${message.tone === "error" ? "danger" : "info"} auth-message`}>{message.text}</div>}
        {!isSupabaseConfigured && <p className="auth-hint">Accounts aren&apos;t configured on this build yet.</p>}
      </div>
    </main>
  );
}

export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <div className="shell-boot">
          <img className="shell-boot-mark" src="/brand/logomark.svg" alt="" />
          <span>Loading…</span>
        </div>
      }
    >
      <AuthInner />
    </Suspense>
  );
}
