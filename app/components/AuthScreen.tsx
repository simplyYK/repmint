"use client";

// Sign in / create account gate shown between the landing page and the app.
// Local-first: users can also continue as a guest (data stays on-device until
// they create an account). Uses the same Supabase client as the rest of the app.

import { useState } from "react";
import { isSupabaseConfigured, supabase } from "../lib/supabaseClient";

type Mode = "sign-in" | "sign-up";

export default function AuthScreen({
  onAuthed,
  onGuest,
  onBack,
}: {
  onAuthed: () => void;
  onGuest: () => void;
  onBack: () => void;
}) {
  const [mode, setMode] = useState<Mode>("sign-up");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage("");
    if (!supabase) {
      setMessage("Accounts aren't configured on this build yet — continue as a guest to start training.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "sign-up") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: name || "RepMint athlete" } },
        });
        if (error) throw error;
        if (data.session) {
          onAuthed();
        } else {
          setMessage("Account created. Check your email to confirm, then sign in — or continue as a guest now.");
          setMode("sign-in");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onAuthed();
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth-screen">
      <div className="auth-aside" aria-hidden="true">
        <div className="brand-lockup landing-brand">
          <span>R</span>
          <strong>RepMint</strong>
        </div>
        <h2>Your AI camera coach, ready when you are.</h2>
        <ul className="auth-points">
          <li>Rep counting, time under tension and tempo</li>
          <li>One clear form cue at a time</li>
          <li>Push · Pull · Legs · Core</li>
          <li>Progress saved to your profile</li>
        </ul>
      </div>

      <div className="auth-panel">
        <button className="auth-back" onClick={onBack} type="button">
          ← Back
        </button>
        <div className="brand-lockup landing-brand auth-panel-brand">
          <span>R</span>
          <strong>RepMint</strong>
        </div>
        <h1>{mode === "sign-up" ? "Create your account" : "Welcome back"}</h1>
        <p className="auth-sub">
          {mode === "sign-up"
            ? "Save your training and pick up on any device."
            : "Sign in to sync your training and history."}
        </p>

        <div className="auth-tabs" role="tablist">
          <button
            className={mode === "sign-up" ? "active" : ""}
            onClick={() => setMode("sign-up")}
            type="button"
            role="tab"
            aria-selected={mode === "sign-up"}
          >
            Create account
          </button>
          <button
            className={mode === "sign-in" ? "active" : ""}
            onClick={() => setMode("sign-in")}
            type="button"
            role="tab"
            aria-selected={mode === "sign-in"}
          >
            Sign in
          </button>
        </div>

        <form className="auth-form" onSubmit={submit}>
          {mode === "sign-up" && (
            <label>
              <span>Name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" autoComplete="name" />
            </label>
          )}
          <label>
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              autoComplete="email"
              required
            />
          </label>
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
          <button className="button button-primary auth-submit" type="submit" disabled={busy}>
            {busy ? "Please wait…" : mode === "sign-up" ? "Create account" : "Sign in"}
          </button>
        </form>

        {message && <p className="coach-note auth-message">{message}</p>}
        {!isSupabaseConfigured && (
          <p className="auth-hint">Accounts aren&apos;t configured on this build — you can still train as a guest.</p>
        )}

        <button className="auth-guest" onClick={onGuest} type="button">
          Continue as guest →
        </button>
      </div>
    </main>
  );
}
