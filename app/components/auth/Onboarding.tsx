"use client";

// First sign-in onboarding. Collects the profile fields the DB trigger leaves
// blank (username, display name, goal, experience, equipment, units) across a
// few friendly steps and returns them as a profiles patch. Claim-safe copy.

import { useState } from "react";
import { motion } from "framer-motion";
import { upsertSettings } from "../../lib/db";

const GOALS = [
  { value: "strength", label: "Build strength" },
  { value: "muscle", label: "Build muscle" },
  { value: "mobility", label: "Move better" },
  { value: "consistency", label: "Train consistently" },
  { value: "conditioning", label: "Get fitter" },
];

const LEVELS = [
  { value: "beginner", label: "New to this" },
  { value: "intermediate", label: "Some experience" },
  { value: "advanced", label: "Experienced" },
] as const;

const EQUIPMENT = [
  "bodyweight",
  "dumbbell",
  "barbell",
  "kettlebell",
  "cable",
  "machine",
  "band",
  "bench",
  "pull_up_bar",
] as const;

export type ProfilePatch = {
  username: string;
  display_name: string;
  goal: string;
  experience_level: "beginner" | "intermediate" | "advanced";
  equipment: string[];
  units: "kg" | "lb";
};

export function Onboarding({
  userId,
  defaultName,
  onDone,
}: {
  userId: string;
  defaultName?: string;
  onDone: (patch: ProfilePatch) => Promise<void>;
}) {
  const [step, setStep] = useState(0);
  const [displayName, setDisplayName] = useState(defaultName ?? "");
  const [username, setUsername] = useState(
    (defaultName ?? "athlete").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 16) || "athlete",
  );
  const [goal, setGoal] = useState("strength");
  const [level, setLevel] = useState<ProfilePatch["experience_level"]>("beginner");
  const [equipment, setEquipment] = useState<string[]>(["bodyweight"]);
  const [units, setUnits] = useState<"kg" | "lb">("kg");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const toggleEquip = (e: string) =>
    setEquipment((cur) => (cur.includes(e) ? cur.filter((x) => x !== e) : [...cur, e]));

  const finish = async () => {
    setError("");
    if (!username.trim()) {
      setStep(0);
      setError("Pick a username to continue.");
      return;
    }
    setSaving(true);
    try {
      await onDone({
        username: username.trim().toLowerCase(),
        display_name: displayName.trim() || "RepMint athlete",
        goal,
        experience_level: level,
        equipment,
        units,
      });
      // Persist the unit preference into settings too (best-effort).
      await upsertSettings({ rest_timer_default: 60 }).catch(() => {});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save. That username may be taken — try another.");
      setSaving(false);
    }
  };

  const steps = ["You", "Goal", "Level", "Equipment"];

  return (
    <motion.div
      className="onboarding"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="onboarding-head">
        <div className="brand-lockup landing-brand">
          <img src="/brand/logomark.svg" alt="" className="brand-lockup-mark" />
          <strong>RepMint</strong>
        </div>
        <div className="onboarding-progress" aria-hidden>
          {steps.map((s, i) => (
            <span key={s} className={i <= step ? "on" : ""} />
          ))}
        </div>
      </div>

      {step === 0 && (
        <div className="onboarding-step">
          <h1>Let&apos;s set you up.</h1>
          <p className="auth-sub">How should your coach address you?</p>
          <label className="field">
            <span>Display name</span>
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your name" />
          </label>
          <label className="field">
            <span>Username</span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
              placeholder="username"
              maxLength={20}
            />
          </label>
          <p className="field-hint">Lowercase letters, numbers and underscores. This is how friends will find you later.</p>
        </div>
      )}

      {step === 1 && (
        <div className="onboarding-step">
          <h1>What are you training for?</h1>
          <p className="auth-sub">We&apos;ll shape your recommendations around it.</p>
          <div className="choice-grid">
            {GOALS.map((g) => (
              <button
                key={g.value}
                type="button"
                className={`choice ${goal === g.value ? "active" : ""}`}
                onClick={() => setGoal(g.value)}
                aria-pressed={goal === g.value}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="onboarding-step">
          <h1>How much lifting have you done?</h1>
          <p className="auth-sub">This tunes the starting difficulty.</p>
          <div className="choice-grid">
            {LEVELS.map((l) => (
              <button
                key={l.value}
                type="button"
                className={`choice ${level === l.value ? "active" : ""}`}
                onClick={() => setLevel(l.value)}
                aria-pressed={level === l.value}
              >
                {l.label}
              </button>
            ))}
          </div>
          <div className="onboarding-units">
            <span>Weight units</span>
            <div className="seg">
              {(["kg", "lb"] as const).map((u) => (
                <button key={u} type="button" className={units === u ? "active" : ""} onClick={() => setUnits(u)}>
                  {u}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="onboarding-step">
          <h1>What can you train with?</h1>
          <p className="auth-sub">Pick everything you have access to.</p>
          <div className="choice-grid wrap">
            {EQUIPMENT.map((e) => (
              <button
                key={e}
                type="button"
                className={`choice ${equipment.includes(e) ? "active" : ""}`}
                onClick={() => toggleEquip(e)}
                aria-pressed={equipment.includes(e)}
              >
                {e.split("_").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ")}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && <div className="notice notice-danger">{error}</div>}

      <div className="onboarding-actions">
        {step > 0 && (
          <button type="button" className="btn btn-ghost btn-md" onClick={() => setStep((s) => s - 1)}>
            Back
          </button>
        )}
        {step < steps.length - 1 ? (
          <button type="button" className="btn btn-primary btn-md" onClick={() => setStep((s) => s + 1)}>
            Continue
          </button>
        ) : (
          <button type="button" className="btn btn-primary btn-md" onClick={finish} disabled={saving}>
            {saving ? "Saving…" : "Start training"}
          </button>
        )}
      </div>
      <input type="hidden" value={userId} readOnly />
    </motion.div>
  );
}
