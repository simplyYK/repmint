"use client";

// /settings — profile, coaching preferences, AI model + instructions, sign out,
// and a best-effort "delete my data" danger zone. Reads/writes the signed-in
// user's own rows (RLS-scoped). Never crashes: load/save failures surface as
// inline notices. Copy is supportive and claim-safe.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  PageHeader,
  Card,
  Button,
  Spinner,
  InlineNotice,
  SectionTitle,
} from "../../components/ui/primitives";
import { useSession, signOut } from "../../lib/session";
import {
  getSettings,
  upsertSettings,
  getProfile,
  upsertProfile,
} from "../../lib/db";
import { getCoachInstructions } from "../../lib/ai";
import { supabase } from "../../lib/supabaseClient";
import type { DbUserSettings } from "../../lib/types";
import "./settings.css";

const EXPERIENCE = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
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
];

const MODEL_PRESETS = [
  { value: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash (default)" },
  { value: "anthropic/claude-sonnet-4.5", label: "Claude Sonnet 4.5" },
  { value: "openai/gpt-4o-mini", label: "GPT-4o mini" },
  { value: "meta-llama/llama-3.3-70b-instruct", label: "Llama 3.3 70B" },
];

const DELETE_TABLES = ["sessions", "workout_templates", "plans", "coach_messages"];

type ProfileForm = {
  display_name: string;
  username: string;
  goal: string;
  experience_level: "beginner" | "intermediate" | "advanced";
  equipment: string[];
  units: "kg" | "lb";
};

const EMPTY_PROFILE: ProfileForm = {
  display_name: "",
  username: "",
  goal: "",
  experience_level: "beginner",
  equipment: ["bodyweight"],
  units: "kg",
};

function labelFor(v: string) {
  return v
    .split("_")
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

type Notice = { tone: "info" | "warn" | "danger"; text: string } | null;

export default function SettingsPage() {
  const { user } = useSession();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [profile, setProfile] = useState<ProfileForm>(EMPTY_PROFILE);
  const [settings, setSettings] = useState<DbUserSettings | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [prof, sett] = await Promise.all([
          getProfile().catch(() => null),
          getSettings(),
        ]);
        if (!active) return;
        if (prof) {
          const p = prof as Partial<ProfileForm> & { equipment?: string[] };
          setProfile({
            display_name: p.display_name ?? "",
            username: p.username ?? "",
            goal: p.goal ?? "",
            experience_level:
              (p.experience_level as ProfileForm["experience_level"]) ?? "beginner",
            equipment:
              Array.isArray(p.equipment) && p.equipment.length > 0
                ? p.equipment
                : ["bodyweight"],
            units: p.units === "lb" ? "lb" : "kg",
          });
        }
        setSettings(sett);
      } catch (err) {
        if (active) {
          setLoadError(
            err instanceof Error ? err.message : "Could not load your settings.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  if (loading) return <Spinner label="Loading your settings…" />;

  return (
    <div className="settings-page">
      <PageHeader
        eyebrow="Your account"
        title="Settings"
        subtitle="Tune your profile, how the coach behaves, and how RepMint feels."
      />

      {loadError && <InlineNotice tone="danger">{loadError}</InlineNotice>}

      <ProfileSection
        value={profile}
        email={user?.email ?? null}
        onChange={setProfile}
      />

      {settings && (
        <>
          <CoachingSection settings={settings} onChange={setSettings} />
          <AiSection settings={settings} onChange={setSettings} />
        </>
      )}

      <Card className="settings-card">
        <div className="set-card-head">
          <h2>Account</h2>
          <p>Sign out of this device.</p>
        </div>
        <div className="settings-actions">
          <Button
            variant="secondary"
            onClick={async () => {
              await signOut();
              router.push("/");
            }}
          >
            Sign out
          </Button>
        </div>
      </Card>

      <DangerZone onWiped={() => router.push("/")} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

function ProfileSection({
  value,
  email,
  onChange,
}: {
  value: ProfileForm;
  email: string | null;
  onChange: (v: ProfileForm) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  function set<K extends keyof ProfileForm>(key: K, v: ProfileForm[K]) {
    onChange({ ...value, [key]: v });
  }

  function toggleEquipment(eq: string) {
    const has = value.equipment.includes(eq);
    const next = has
      ? value.equipment.filter((e) => e !== eq)
      : [...value.equipment, eq];
    set("equipment", next.length ? next : ["bodyweight"]);
  }

  async function save() {
    setSaving(true);
    setNotice(null);
    try {
      await upsertProfile({
        display_name: value.display_name.trim() || null,
        username: value.username.trim() || null,
        goal: value.goal.trim() || null,
        experience_level: value.experience_level,
        equipment: value.equipment,
        units: value.units,
      });
      setNotice({ tone: "info", text: "Profile saved." });
    } catch (err) {
      setNotice({
        tone: "danger",
        text: err instanceof Error ? err.message : "Could not save your profile.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="settings-card">
      <div className="set-card-head">
        <h2>Profile</h2>
        <p>How you show up in RepMint.</p>
      </div>

      <div className="field-grid">
        <label className="field">
          <span>Display name</span>
          <input
            type="text"
            value={value.display_name}
            onChange={(e) => set("display_name", e.target.value)}
            placeholder="Your name"
          />
        </label>
        <label className="field">
          <span>Username</span>
          <input
            type="text"
            value={value.username}
            onChange={(e) => set("username", e.target.value)}
            placeholder="athlete"
            autoCapitalize="none"
            autoCorrect="off"
          />
        </label>
      </div>

      <label className="field" style={{ marginBottom: 14 }}>
        <span>Goal</span>
        <input
          type="text"
          value={value.goal}
          onChange={(e) => set("goal", e.target.value)}
          placeholder="e.g. Build a strength foundation"
        />
      </label>

      <div className="field" style={{ marginBottom: 14 }}>
        <span>Experience</span>
        <div className="seg" role="group" aria-label="Experience level">
          {EXPERIENCE.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={value.experience_level === opt.value ? "active" : ""}
              aria-pressed={value.experience_level === opt.value}
              onClick={() => set("experience_level", opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="field" style={{ marginBottom: 14 }}>
        <span>Equipment</span>
        <div className="set-chips">
          {EQUIPMENT.map((eq) => {
            const on = value.equipment.includes(eq);
            return (
              <button
                key={eq}
                type="button"
                className={`set-chip${on ? " on" : ""}`}
                aria-pressed={on}
                onClick={() => toggleEquipment(eq)}
              >
                {labelFor(eq)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="field" style={{ marginBottom: 14 }}>
        <span>Units</span>
        <div className="seg" role="group" aria-label="Units">
          <button
            type="button"
            className={value.units === "kg" ? "active" : ""}
            aria-pressed={value.units === "kg"}
            onClick={() => set("units", "kg")}
          >
            kg
          </button>
          <button
            type="button"
            className={value.units === "lb" ? "active" : ""}
            aria-pressed={value.units === "lb"}
            onClick={() => set("units", "lb")}
          >
            lb
          </button>
        </div>
      </div>

      <label className="field" style={{ marginBottom: 16 }}>
        <span>Email</span>
        <div className="set-readonly">{email ?? "Not signed in"}</div>
      </label>

      {notice && <InlineNotice tone={notice.tone}>{notice.text}</InlineNotice>}

      <div className="settings-actions" style={{ marginTop: 14 }}>
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save profile"}
        </Button>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Coaching preferences
// ---------------------------------------------------------------------------

function CoachingSection({
  settings,
  onChange,
}: {
  settings: DbUserSettings;
  onChange: (s: DbUserSettings) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  // Local draft so the slider feels responsive; persisted on Save.
  const [audioCues, setAudioCues] = useState(settings.audio_cues);
  const [haptics, setHaptics] = useState(settings.haptics);
  const [restTimer, setRestTimer] = useState(settings.rest_timer_default);

  async function save() {
    setSaving(true);
    setNotice(null);
    try {
      const updated = await upsertSettings({
        audio_cues: audioCues,
        haptics,
        rest_timer_default: restTimer,
      });
      onChange(updated);
      setNotice({ tone: "info", text: "Preferences saved." });
    } catch (err) {
      setNotice({
        tone: "danger",
        text: err instanceof Error ? err.message : "Could not save preferences.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="settings-card">
      <div className="set-card-head">
        <h2>Coaching</h2>
        <p>How sessions feel while you train.</p>
      </div>

      <div className="setting-row" style={{ borderTop: 0, paddingTop: 0 }}>
        <div className="setting-label">
          <strong>Audio cues</strong>
          <small>Spoken form and pacing prompts during a set.</small>
        </div>
        <Toggle
          on={audioCues}
          onToggle={() => setAudioCues((v) => !v)}
          label="Audio cues"
        />
      </div>

      <div className="setting-row">
        <div className="setting-label">
          <strong>Haptics</strong>
          <small>A gentle buzz on rep and rest milestones.</small>
        </div>
        <Toggle on={haptics} onToggle={() => setHaptics((v) => !v)} label="Haptics" />
      </div>

      <div className="setting-row">
        <div className="setting-label">
          <strong>Default rest timer</strong>
          <small>The rest length pre-filled between sets.</small>
        </div>
        <div className="slider-wrap">
          <input
            type="range"
            min={15}
            max={240}
            step={5}
            value={restTimer}
            onChange={(e) => setRestTimer(Number(e.target.value))}
            aria-label="Default rest timer seconds"
          />
          <span className="slider-value">{restTimer}s</span>
        </div>
      </div>

      {notice && (
        <InlineNotice tone={notice.tone}>{notice.text}</InlineNotice>
      )}

      <div className="settings-actions" style={{ marginTop: 14 }}>
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save preferences"}
        </Button>
      </div>
    </Card>
  );
}

function Toggle({
  on,
  onToggle,
  label,
}: {
  on: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      className={`toggle${on ? " on" : ""}`}
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onToggle}
    >
      <span />
    </button>
  );
}

// ---------------------------------------------------------------------------
// AI section
// ---------------------------------------------------------------------------

function AiSection({
  settings,
  onChange,
}: {
  settings: DbUserSettings;
  onChange: (s: DbUserSettings) => void;
}) {
  const isPreset = MODEL_PRESETS.some((m) => m.value === settings.ai_model);

  const [selection, setSelection] = useState<string>(
    isPreset ? settings.ai_model : "custom",
  );
  const [customModel, setCustomModel] = useState<string>(
    isPreset ? "" : settings.ai_model,
  );
  const [override, setOverride] = useState<string>(settings.ai_instructions_override ?? "");

  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  const [showInstructions, setShowInstructions] = useState(false);
  const [defaultInstructions, setDefaultInstructions] = useState<string | null>(null);
  const [instructionsError, setInstructionsError] = useState<string | null>(null);
  const [loadingInstructions, setLoadingInstructions] = useState(false);

  async function toggleInstructions() {
    const next = !showInstructions;
    setShowInstructions(next);
    if (next && defaultInstructions === null && !loadingInstructions) {
      setLoadingInstructions(true);
      setInstructionsError(null);
      const res = await getCoachInstructions();
      setLoadingInstructions(false);
      if ("error" in res) {
        setInstructionsError(res.error);
      } else {
        setDefaultInstructions(res.instructions);
      }
    }
  }

  async function save() {
    setSaving(true);
    setNotice(null);
    const model = selection === "custom" ? customModel.trim() : selection;
    if (!model) {
      setSaving(false);
      setNotice({ tone: "warn", text: "Enter a model id, or pick one from the list." });
      return;
    }
    try {
      const updated = await upsertSettings({
        ai_model: model,
        ai_instructions_override: override.trim() ? override.trim() : null,
      });
      onChange(updated);
      setNotice({ tone: "info", text: "AI settings saved." });
    } catch (err) {
      setNotice({
        tone: "danger",
        text: err instanceof Error ? err.message : "Could not save AI settings.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="settings-card">
      <div className="set-card-head">
        <h2>AI coach</h2>
        <p>Choose the model and shape how the coach talks to you.</p>
      </div>

      <label className="field" style={{ marginBottom: 14 }}>
        <span>Model</span>
        <select value={selection} onChange={(e) => setSelection(e.target.value)}>
          {MODEL_PRESETS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
          <option value="custom">Custom…</option>
        </select>
      </label>

      {selection === "custom" && (
        <label className="field" style={{ marginBottom: 14 }}>
          <span>Custom model id</span>
          <input
            type="text"
            value={customModel}
            onChange={(e) => setCustomModel(e.target.value)}
            placeholder="provider/model-name"
            autoCapitalize="none"
            autoCorrect="off"
          />
        </label>
      )}

      <SectionTitle
        action={
          <Button size="sm" variant="ghost" onClick={toggleInstructions}>
            {showInstructions ? "Hide" : "View coach instructions"}
          </Button>
        }
      >
        Coach instructions
      </SectionTitle>

      {showInstructions && (
        <div className="set-instructions">
          {loadingInstructions ? (
            <Spinner label="Loading instructions…" />
          ) : instructionsError ? (
            <InlineNotice tone="warn">
              Couldn&apos;t load the default instructions right now. You can still write your
              own guidance below.
            </InlineNotice>
          ) : (
            defaultInstructions && (
              <pre className="set-instructions-default">{defaultInstructions}</pre>
            )
          )}

          <label className="field">
            <span>Your instructions (optional)</span>
            <textarea
              className="set-textarea"
              value={override}
              onChange={(e) => setOverride(e.target.value)}
              placeholder="Add your own guidance — tone, focus areas, anything you'd like the coach to keep in mind."
            />
          </label>
          <p className="set-hint">Leave this empty to use the default coaching style.</p>
        </div>
      )}

      {notice && <InlineNotice tone={notice.tone}>{notice.text}</InlineNotice>}

      <div className="settings-actions" style={{ marginTop: 14 }}>
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save AI settings"}
        </Button>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Danger zone
// ---------------------------------------------------------------------------

function DangerZone({ onWiped }: { onWiped: () => void }) {
  const [confirm, setConfirm] = useState("");
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  const armed = confirm.trim().toUpperCase() === "DELETE";

  async function wipe() {
    if (!armed || working) return;
    setWorking(true);
    setNotice(null);

    if (!supabase) {
      setWorking(false);
      setNotice({ tone: "danger", text: "Not connected — nothing to delete." });
      return;
    }

    try {
      const { data: userData } = await supabase.auth.getUser();
      const ownerId = userData.user?.id;
      if (!ownerId) throw new Error("Sign in again to continue.");

      // Best-effort wipe of the user's own rows. RLS scopes each delete to the
      // owner, but we also filter by owner_id defensively.
      for (const table of DELETE_TABLES) {
        const { error } = await supabase.from(table).delete().eq("owner_id", ownerId);
        if (error) throw error;
      }

      await signOut();
      onWiped();
    } catch (err) {
      setWorking(false);
      setNotice({
        tone: "danger",
        text:
          err instanceof Error
            ? err.message
            : "Something went wrong — your data was not fully cleared.",
      });
    }
  }

  return (
    <Card className="settings-card set-danger">
      <div className="set-card-head">
        <h2>Delete my data</h2>
        <p>
          This clears your saved sessions, workouts, plans, and coach messages, then signs you
          out. It can&apos;t be undone, so we ask you to confirm first.
        </p>
      </div>

      {notice && <InlineNotice tone={notice.tone}>{notice.text}</InlineNotice>}

      <div className="set-danger-confirm">
        <label className="field">
          <span>Type DELETE to confirm</span>
          <input
            type="text"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="DELETE"
            autoCapitalize="characters"
            autoCorrect="off"
            aria-label="Type DELETE to confirm"
          />
        </label>
        <Button variant="danger" onClick={wipe} disabled={!armed || working}>
          {working ? "Clearing…" : "Delete my data"}
        </Button>
      </div>
    </Card>
  );
}
