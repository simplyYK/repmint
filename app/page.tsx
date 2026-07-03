"use client";

import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "./lib/supabaseClient";
import { getMovement, movementsByCategory, CATEGORY_LABEL } from "./lib/movements/registry";
import type { MovementDef } from "./lib/movements/types";
import { usePoseTracker, type SetOutcome } from "./hooks/usePoseTracker";
import { persistProfile, persistSetResult } from "./lib/persistence";
import type { RepEvent } from "./lib/tracking/repEngine";
import {
  DEFAULT_PROFILE,
  configFromProfile,
  type CoachConfig,
  type FaultTally,
  type Phase,
  type Profile,
  type SetResult,
  type View,
} from "./lib/types";
import Landing from "./components/Landing";
import AuthScreen from "./components/AuthScreen";
import AiCoach from "./components/AiCoach";
import { AVATARS, AvatarIcon } from "./lib/avatars";

const STORAGE_ENTERED = "repmint-entered";
type Stage = "landing" | "auth" | "app";

const STORAGE_PROFILE = "repmint-working-profile";
const STORAGE_HISTORY = "repmint-working-history";

const defaultProfile: Profile = DEFAULT_PROFILE;

const sampleHistory: SetResult[] = [
  {
    id: "sample-1",
    date: new Date(Date.now() - 86400000).toISOString(),
    movement: "squat",
    movementName: "Squat",
    category: "legs",
    reps: 8,
    targetReps: 8,
    seconds: 44,
    tut: 37,
    tempo: "3-1-1-0",
    avgRepSeconds: 4.4,
    cue: "Keep the descent controlled and hit the same depth each rep.",
    faults: [],
    source: "pose",
  },
];

function formatTime(total: number) {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function loadJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  const value = window.localStorage.getItem(key);
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export default function Home() {
  const [stage, setStage] = useState<Stage>("landing");
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [booted, setBooted] = useState(false);

  useEffect(() => {
    const entered = typeof window !== "undefined" && window.localStorage.getItem(STORAGE_ENTERED) === "1";
    if (!supabase) {
      setStage(entered ? "app" : "landing");
      setBooted(true);
      return;
    }
    supabase.auth.getUser().then(({ data }) => {
      setAuthUser(data.user ?? null);
      setStage(data.user || entered ? "app" : "landing");
      setBooted(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_e, session) => setAuthUser(session?.user ?? null));
    return () => data.subscription.unsubscribe();
  }, []);

  const enterApp = () => {
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_ENTERED, "1");
    setStage("app");
  };

  const exitToLanding = async () => {
    if (supabase) await supabase.auth.signOut();
    if (typeof window !== "undefined") window.localStorage.removeItem(STORAGE_ENTERED);
    setAuthUser(null);
    setStage("landing");
  };

  if (!booted) {
    return (
      <main className="app-app">
        <div className="loading-state">Loading RepMint…</div>
      </main>
    );
  }

  if (stage === "landing") {
    return <Landing onGetStarted={() => setStage("auth")} onSignIn={() => setStage("auth")} onGuest={enterApp} />;
  }
  if (stage === "auth") {
    return <AuthScreen onAuthed={enterApp} onGuest={enterApp} onBack={() => setStage("landing")} />;
  }
  return <TrainerApp authUser={authUser} onSignOut={exitToLanding} onRequireAuth={() => setStage("auth")} />;
}

function TrainerApp({
  authUser,
  onSignOut,
  onRequireAuth,
}: {
  authUser: User | null;
  onSignOut: () => void;
  onRequireAuth: () => void;
}) {
  const [profile, setProfile] = useState<Profile>(defaultProfile);
  const [history, setHistory] = useState<SetResult[]>([]);
  const [coachAdvice, setCoachAdvice] = useState<{ setId: string; message: string } | null>(null);
  const [coachLoadingSetId, setCoachLoadingSetId] = useState<string | null>(null);
  const [view, setView] = useState<View>("hub");
  const [selectedMovement, setSelectedMovement] = useState<string>("squat");
  const [phase, setPhase] = useState<Phase>("setup");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Merge with defaults so profiles saved before new settings existed backfill.
    setProfile({ ...defaultProfile, ...loadJson(STORAGE_PROFILE, defaultProfile) });
    setHistory(loadJson(STORAGE_HISTORY, sampleHistory));
    setReady(true);
  }, []);

  const movement = useMemo(() => getMovement(selectedMovement), [selectedMovement]);
  const config = useMemo(() => configFromProfile(profile), [profile]);

  const saveProfile = (next: Profile) => {
    setProfile(next);
    window.localStorage.setItem(STORAGE_PROFILE, JSON.stringify(next));
    if (authUser) void persistProfile(authUser.id, next);
  };

  const saveResult = (result: SetResult, repEvents: RepEvent[]) => {
    const next = [result, ...history.filter((item) => !item.id.startsWith("sample-"))].slice(0, 40);
    setHistory(next);
    window.localStorage.setItem(STORAGE_HISTORY, JSON.stringify(next));
    if (authUser) {
      void persistSetResult(authUser.id, result, repEvents).catch(() => {
        /* local history already saved; ignore network errors */
      });
    }
    setPhase("review");
    setView("progress");
  };

  const askGeminiCoach = async (result: SetResult) => {
    if (!supabase || !authUser) {
      setCoachAdvice({
        setId: result.id,
        message: "Sign in from Settings to use the AI set review. Your set history is still saved on this device.",
      });
      return;
    }
    setCoachLoadingSetId(result.id);
    try {
      const { data, error } = await supabase.functions.invoke("gemini-coach", {
        body: {
          mode: "set_review",
          message: `Review my ${result.movementName} set and give me one practical focus for the next set.`,
        },
      });
      if (error) throw error;
      setCoachAdvice({ setId: result.id, message: data?.message ?? "Reviewed, but no coach message returned." });
    } catch (error) {
      setCoachAdvice({
        setId: result.id,
        message: error instanceof Error ? error.message : "AI coach is not available yet.",
      });
    } finally {
      setCoachLoadingSetId(null);
    }
  };

  const clearHistory = () => {
    setHistory([]);
    window.localStorage.removeItem(STORAGE_HISTORY);
  };

  const realHistory = history.filter((item) => !item.id.startsWith("sample-"));
  const completedThisWeek = realHistory.filter(
    (item) => Date.now() - new Date(item.date).getTime() < 7 * 86400000,
  ).length;
  const totalReps = history.reduce((sum, item) => sum + item.reps, 0);
  const totalTut = history.reduce((sum, item) => sum + item.tut, 0);

  if (!ready) {
    return (
      <main className="app-app">
        <div className="loading-state">Loading RepMint...</div>
      </main>
    );
  }

  return (
    <main className="app-app">
      <aside className="app-nav" aria-label="RepMint navigation">
        <button className="brand-lockup" onClick={() => setView("hub")} aria-label="Open training hub">
          <span>R</span>
          <strong>RepMint</strong>
        </button>
        <button className="nav-profile" onClick={() => setView("settings")} aria-label="Open settings">
          <AvatarIcon id={profile.avatar} size={36} />
          <span className="nav-profile-text">
            <strong>{profile.name}</strong>
            <small>{profile.goal}</small>
          </span>
        </button>
        <nav>
          {(
            [
              ["hub", "Hub"],
              ["coach", "Coach"],
              ["ai", "AI Coach"],
              ["progress", "Progress"],
              ["settings", "Settings"],
            ] as const
          ).map(([id, label]) => (
            <button className={view === id ? "nav-item active" : "nav-item"} key={id} onClick={() => setView(id)}>
              {label}
            </button>
          ))}
        </nav>
      </aside>

      <section className="app-main">
        {view === "hub" && (
          <TrainingHub
            profile={profile}
            movement={movement}
            history={realHistory}
            completedThisWeek={completedThisWeek}
            totalTut={totalTut}
            authUser={authUser}
            onSelectMovement={setSelectedMovement}
            onStart={() => {
              setPhase("setup");
              setView("coach");
            }}
          />
        )}

        {view === "coach" && (
          <CameraCoach
            movement={movement}
            phase={phase}
            setPhase={setPhase}
            config={config}
            onSelectMovement={setSelectedMovement}
            onSave={saveResult}
          />
        )}

        {view === "ai" && <AiCoach authUser={authUser} profile={profile} onRequireAuth={onRequireAuth} />}

        {view === "progress" && (
          <ProgressView
            history={history}
            totalReps={totalReps}
            totalTut={totalTut}
            completedThisWeek={completedThisWeek}
            schedule={profile.schedule}
            coachAdvice={coachAdvice}
            coachLoadingSetId={coachLoadingSetId}
            onClearHistory={clearHistory}
            onAskCoach={askGeminiCoach}
            onTrainAgain={(id) => {
              setSelectedMovement(id);
              setPhase("setup");
              setView("coach");
            }}
          />
        )}

        {view === "settings" && (
          <SettingsView authUser={authUser} profile={profile} onSave={saveProfile} onSignOut={onSignOut} />
        )}
      </section>
    </main>
  );
}

function TrainingHub({
  profile,
  movement,
  history,
  completedThisWeek,
  totalTut,
  authUser,
  onSelectMovement,
  onStart,
}: {
  profile: Profile;
  movement: MovementDef;
  history: SetResult[];
  completedThisWeek: number;
  totalTut: number;
  authUser: User | null;
  onSelectMovement: (id: string) => void;
  onStart: () => void;
}) {
  const latest = history[0];
  const groups = movementsByCategory();
  return (
    <div className="screen-stack">
      <header className="hub-hero">
        <div>
          <p className="micro-label">Daily training hub</p>
          <h1>{profile.goal} plan for today.</h1>
          <p>
            Start a camera-guided {movement.name.toLowerCase()} set. RepMint counts your reps, tracks time under
            tension and tempo, and gives one live cue at a time so you can train with more awareness.
          </p>
          <div className="hero-actions">
            <button className="button button-primary" onClick={onStart}>
              Start camera set
            </button>
            <button className="button button-secondary" onClick={() => onSelectMovement("front-plank")}>
              Try a timed hold
            </button>
          </div>
        </div>
        <div className="today-card">
          <span className="live-dot">Ready</span>
          <h2>{movement.name}</h2>
          <p>
            {CATEGORY_LABEL[movement.category]} ·{" "}
            {movement.mode === "hold" ? `${movement.target.seconds}s hold` : `${movement.target.sets}×${movement.target.reps}`}
          </p>
          <dl>
            <div>
              <dt>Tempo</dt>
              <dd>{movement.tempo}</dd>
            </div>
            <div>
              <dt>Camera</dt>
              <dd>{movement.camera}</dd>
            </div>
          </dl>
        </div>
      </header>

      <section className="metric-strip" aria-label="Training progress">
        <Metric label="This week" value={`${completedThisWeek}/${profile.schedule}`} note="sessions saved" />
        <Metric label="Training time" value={`${Math.round(totalTut / 60)}m`} note="time under tension" />
        <Metric
          label="Last set"
          value={latest ? latest.movementName : "None"}
          note={latest ? `${latest.reps} reps saved` : "start today"}
        />
      </section>

      <section className="panel-grid">
        <div className="panel wide-panel">
          <div className="panel-heading">
            <div>
              <p className="micro-label">Movement library</p>
              <h2>Pick the set RepMint should coach.</h2>
            </div>
          </div>
          {groups.map((group) => (
            <div className="movement-group" key={group.category}>
              <p className="group-label">{group.label}</p>
              <div className="movement-list">
                {group.items.map((item) => (
                  <button
                    className={item.id === movement.id ? "movement-row selected" : "movement-row"}
                    key={item.id}
                    onClick={() => onSelectMovement(item.id)}
                  >
                    <span>
                      <strong>{item.name}</strong>
                      <small>
                        {item.equipment.join(" · ")}
                      </small>
                    </span>
                    <em>{item.mode === "hold" ? `${item.target.seconds}s` : item.tempo}</em>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="panel">
          <p className="micro-label">Smart recommendation</p>
          <h2>{authUser ? "AI set review is ready after your next saved set." : "Sign in to sync and unlock AI review."}</h2>
          <p>
            Set a clear camera angle, run one controlled set, then review reps, time under tension, tempo and the one
            thing to focus on next. RepMint keeps this practical and coaching-led.
          </p>
          <p className="micro-note">Framing tip for {movement.name}: {movement.camera}.</p>
        </div>
      </section>
    </div>
  );
}

function CameraCoach({
  movement,
  phase,
  setPhase,
  config,
  onSelectMovement,
  onSave,
}: {
  movement: MovementDef;
  phase: Phase;
  setPhase: (phase: Phase) => void;
  config: CoachConfig;
  onSelectMovement: (id: string) => void;
  onSave: (result: SetResult, repEvents: RepEvent[]) => void;
}) {
  const { videoRef, canvasRef, snapshot, startCamera, startSet, endSet, resetSet, manualRep } =
    usePoseTracker(movement, config);
  const mirrorClass = config.mirror ? "" : " no-mirror";
  const groups = movementsByCategory();
  const isHold = movement.mode === "hold";
  const targetReps = movement.target.reps ?? 0;
  const targetPct = Math.round(movement.minRepFraction * 100);

  const handleStart = () => {
    setPhase("active");
    startSet();
  };

  const handleEnd = () => {
    const outcome: SetOutcome = endSet();
    setPhase("review");
    const result: SetResult = {
      id: `set-${Date.now()}`,
      date: new Date().toISOString(),
      movement: movement.id,
      movementName: movement.name,
      category: movement.category,
      reps: outcome.reps,
      targetReps: movement.target.reps,
      targetSeconds: movement.target.seconds,
      seconds: outcome.seconds,
      tut: Math.max(outcome.tut, isHold ? outcome.seconds : 0),
      tempo: movement.tempo,
      avgRepSeconds: outcome.avgRepSeconds,
      cue: outcome.faults[0]?.cue ?? movement.reviewCue,
      faults: outcome.faults,
      source: outcome.source,
    };
    onSave(result, outcome.repEvents);
  };

  const toneClass = snapshot.tone === "adjust" ? "adjust" : snapshot.tone === "good" ? "good" : "idle";
  const depthPct = Math.round(snapshot.depth * 100);

  return (
    <div className="screen-stack">
      <header className="coach-header">
        <div>
          <p className="micro-label">Active camera coach · {CATEGORY_LABEL[movement.category]}</p>
          <h1>{movement.name}</h1>
          <p>{movement.camera}</p>
        </div>
        <select
          value={movement.id}
          onChange={(event) => onSelectMovement(event.target.value)}
          aria-label="Movement"
        >
          {groups.map((group) => (
            <optgroup label={group.label} key={group.category}>
              {group.items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </header>

      <section className="coach-layout">
        <div className="camera-stage">
          <video
            ref={videoRef}
            className={`${snapshot.hasCamera ? "camera-video active" : "camera-video"}${mirrorClass}`}
            playsInline
            muted
          />
          <canvas ref={canvasRef} className={`pose-canvas${mirrorClass}`} aria-hidden="true" />
          {!snapshot.hasCamera && (
            <div className="camera-empty">
              <strong>Camera preview</strong>
              <span>{snapshot.cameraStatus}</span>
            </div>
          )}
          <div className="stage-badges">
            <span>{snapshot.cameraStatus}</span>
            <span>{snapshot.poseStatus}</span>
            {snapshot.running && <span>Pose {snapshot.quality}%</span>}
          </div>

          {snapshot.running && !isHold && (
            <div className="depth-meter" aria-hidden="true">
              <div className="depth-fill" style={{ width: `${Math.min(100, depthPct)}%` }} />
              <div className="depth-target" style={{ left: `${targetPct}%` }} />
              <span className="depth-label">Depth {depthPct}%</span>
            </div>
          )}

          <div className={`live-cue ${toneClass}`} aria-live="polite">
            {snapshot.cue || movement.setupCue}
          </div>
        </div>

        <aside className="coach-side">
          <div className="metric-grid">
            <Metric
              label={isHold ? "Hold" : "Reps"}
              value={isHold ? formatTime(snapshot.seconds) : `${snapshot.reps}/${targetReps}`}
              note="current set"
            />
            <Metric label="TUT" value={`${snapshot.tut}s`} note={isHold ? "time under tension" : `target ${config.tutTargetPerRep}s/rep`} />
            <Metric label="Pose" value={`${snapshot.quality}%`} note={snapshot.angle ? `${snapshot.angle}°` : "align in frame"} />
            <Metric label="Phase" value={snapshot.motion} note={isHold ? (snapshot.holdValid ? "line held" : "adjust") : "live"} />
          </div>

          <div className="control-panel">
            {!snapshot.hasCamera && phase === "setup" && (
              <button className="button button-primary" onClick={startCamera}>
                Start camera
              </button>
            )}
            {snapshot.hasCamera && (
              <button className="button button-primary" onClick={handleStart} disabled={snapshot.running}>
                {isHold ? "Start hold" : "Start set"}
              </button>
            )}
            {!isHold && (
              <button className="button button-secondary" onClick={manualRep} disabled={!snapshot.running}>
                Manual +1
              </button>
            )}
            <button
              className="button button-secondary"
              onClick={handleEnd}
              disabled={!snapshot.running && snapshot.reps === 0 && snapshot.seconds === 0}
            >
              End set
            </button>
            <button className="button ghost-button" onClick={resetSet}>
              Reset
            </button>
          </div>

          <div className="panel compact-panel">
            <p className="micro-label">Setup checklist</p>
            <ul className="check-list">
              <li>{movement.camera}</li>
              <li>{movement.setupCue}</li>
              <li>Good light, one person in frame</li>
              <li>{isHold ? "Timer counts while your line holds" : `A rep counts past ${targetPct}% depth`}</li>
            </ul>
          </div>
        </aside>
      </section>
    </div>
  );
}

function ProgressView({
  history,
  totalReps,
  totalTut,
  completedThisWeek,
  schedule,
  coachAdvice,
  coachLoadingSetId,
  onClearHistory,
  onAskCoach,
  onTrainAgain,
}: {
  history: SetResult[];
  totalReps: number;
  totalTut: number;
  completedThisWeek: number;
  schedule: number;
  coachAdvice: { setId: string; message: string } | null;
  coachLoadingSetId: string | null;
  onClearHistory: () => void;
  onAskCoach: (result: SetResult) => void;
  onTrainAgain: (id: string) => void;
}) {
  return (
    <div className="screen-stack">
      <header className="section-header">
        <div>
          <p className="micro-label">Progress journey</p>
          <h1>Every saved set sharpens the next plan.</h1>
        </div>
        <button className="button button-secondary" onClick={onClearHistory}>
          Clear local history
        </button>
      </header>
      <section className="metric-strip">
        <Metric label="Weekly sessions" value={`${completedThisWeek}/${schedule}`} note="saved history" />
        <Metric label="Total reps" value={`${totalReps}`} note="counted" />
        <Metric label="Total TUT" value={`${Math.round(totalTut / 60)}m`} note={`${totalTut}s`} />
      </section>
      <section className="history-list">
        {history.length === 0 ? (
          <div className="empty-state">No saved sets yet. Start a camera set to create your first review.</div>
        ) : (
          history.map((item) => (
            <article className="history-card" key={item.id}>
              <div>
                <span>
                  {new Date(item.date).toLocaleDateString()} · {CATEGORY_LABEL[item.category as MovementDef["category"]] ?? ""}
                </span>
                <h2>{item.movementName}</h2>
                <p>{item.cue}</p>
                {item.faults.length > 0 && (
                  <div className="fault-chips">
                    {item.faults.slice(0, 3).map((f: FaultTally) => (
                      <span key={f.signal}>
                        {f.cue} ×{f.count}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <dl>
                <div>
                  <dt>Reps</dt>
                  <dd>{item.reps}</dd>
                </div>
                <div>
                  <dt>TUT</dt>
                  <dd>{item.tut}s</dd>
                </div>
                <div>
                  <dt>Avg rep</dt>
                  <dd>{item.avgRepSeconds ? `${item.avgRepSeconds}s` : "—"}</dd>
                </div>
              </dl>
              {coachAdvice?.setId === item.id && <p className="coach-note">{coachAdvice.message}</p>}
              <div className="history-actions">
                <button
                  className="button button-secondary"
                  onClick={() => onAskCoach(item)}
                  disabled={coachLoadingSetId === item.id}
                >
                  {coachLoadingSetId === item.id ? "Asking..." : "Ask AI coach"}
                </button>
                <button className="button button-secondary" onClick={() => onTrainAgain(item.movement)}>
                  Train again
                </button>
              </div>
            </article>
          ))
        )}
      </section>
    </div>
  );
}

function Seg<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="seg" role="group">
      {options.map((o) => (
        <button
          type="button"
          key={o.value}
          className={o.value === value ? "active" : ""}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={`toggle ${checked ? "on" : ""}`}
      onClick={() => onChange(!checked)}
    >
      <span />
    </button>
  );
}

function SettingsView({
  authUser,
  profile,
  onSave,
  onSignOut,
}: {
  authUser: User | null;
  profile: Profile;
  onSave: (profile: Profile) => void;
  onSignOut: () => void;
}) {
  const [draft, setDraft] = useState(profile);
  useEffect(() => setDraft(profile), [profile]);
  const set = (patch: Partial<Profile>) => setDraft((d) => ({ ...d, ...patch }));
  const dirty = JSON.stringify(draft) !== JSON.stringify(profile);
  const reset = () => {
    setDraft(defaultProfile);
    onSave(defaultProfile);
  };

  return (
    <div className="screen-stack">
      <header className="section-header">
        <div>
          <p className="micro-label">Settings</p>
          <h1>Personalize your coaching.</h1>
        </div>
        <div className="settings-headactions">
          <button className="button ghost-button" type="button" onClick={reset}>
            Reset to defaults
          </button>
          <button className="button button-primary" type="button" onClick={() => onSave(draft)} disabled={!dirty}>
            {dirty ? "Save changes" : "Saved"}
          </button>
        </div>
      </header>

      <section className="panel">
        <p className="micro-label">Account</p>
        <h2>{authUser ? "Signed in — history and AI coach sync to your profile." : "Training as a guest on this device."}</h2>
        <p>
          {isSupabaseConfigured
            ? authUser?.email ?? "You're training locally. Sign out to create an account and sync across devices."
            : "Accounts aren't configured on this build — training is saved on this device."}
        </p>
        <button className="button button-secondary" onClick={onSignOut} type="button">
          {authUser ? "Sign out" : "Back to landing page"}
        </button>
      </section>

      <section className="settings-card">
        <p className="micro-label">Profile</p>
        <h2>Pick your avatar.</h2>
        <div className="avatar-grid">
          {AVATARS.map((a) => (
            <button
              type="button"
              key={a.id}
              className={`avatar-option ${draft.avatar === a.id ? "selected" : ""}`}
              onClick={() => set({ avatar: a.id })}
              aria-pressed={draft.avatar === a.id}
            >
              <AvatarIcon id={a.id} size={58} />
              <small>{a.label}</small>
            </button>
          ))}
        </div>
        <label className="field">
          <span>Name</span>
          <input value={draft.name} onChange={(e) => set({ name: e.target.value })} />
        </label>
      </section>

      <section className="settings-card">
        <p className="micro-label">Training</p>
        <h2>Your plan basics.</h2>
        <div className="field-grid">
          <label className="field">
            <span>Goal</span>
            <select value={draft.goal} onChange={(e) => set({ goal: e.target.value })}>
              <option>Strength foundation</option>
              <option>Muscle building</option>
              <option>Mobility and control</option>
              <option>Consistency</option>
              <option>Return to gym confidence</option>
              <option>Technique practice</option>
            </select>
          </label>
          <label className="field">
            <span>Experience</span>
            <select value={draft.level} onChange={(e) => set({ level: e.target.value })}>
              <option>Beginner</option>
              <option>Intermediate</option>
              <option>Advanced</option>
            </select>
          </label>
          <label className="field">
            <span>Equipment</span>
            <select value={draft.equipment} onChange={(e) => set({ equipment: e.target.value })}>
              <option>Bodyweight</option>
              <option>Dumbbells</option>
              <option>Full gym</option>
            </select>
          </label>
          <label className="field">
            <span>Sessions / week</span>
            <input
              type="number"
              min="1"
              max="7"
              value={draft.schedule}
              onChange={(e) => set({ schedule: Number(e.target.value) })}
            />
          </label>
        </div>
        <div className="setting-row">
          <div className="setting-label">
            <strong>Weight units</strong>
            <small>How loads are shown across RepMint.</small>
          </div>
          <Seg
            options={[
              { label: "kg", value: "kg" },
              { label: "lb", value: "lb" },
            ]}
            value={draft.units}
            onChange={(v) => set({ units: v })}
          />
        </div>
      </section>

      <section className="settings-card">
        <p className="micro-label">Coaching</p>
        <h2>How your coach talks, times, and counts.</h2>
        <div className="setting-row">
          <div className="setting-label">
            <strong>Live cue frequency</strong>
            <small>How much the camera coach speaks up mid-set.</small>
          </div>
          <Seg
            options={[
              { label: "Quiet", value: "Quiet" },
              { label: "Standard", value: "Standard" },
              { label: "Detailed", value: "Detailed" },
            ]}
            value={draft.coaching}
            onChange={(v) => set({ coaching: v })}
          />
        </div>
        <div className="setting-row">
          <div className="setting-label">
            <strong>AI coach tone</strong>
            <small>Style of the AI coach&apos;s written answers.</small>
          </div>
          <Seg
            options={[
              { label: "Supportive", value: "Supportive" },
              { label: "Direct", value: "Direct" },
              { label: "Technical", value: "Technical" },
            ]}
            value={draft.tone}
            onChange={(v) => set({ tone: v })}
          />
        </div>
        <div className="setting-row">
          <div className="setting-label">
            <strong>Time under tension target</strong>
            <small>Seconds per rep the coach nudges you toward. Faster than this and it&apos;ll say &ldquo;slow the descent&rdquo;.</small>
          </div>
          <div className="slider-wrap">
            <input
              type="range"
              min="1.5"
              max="6"
              step="0.5"
              value={draft.tutTargetPerRep}
              onChange={(e) => set({ tutTargetPerRep: Number(e.target.value) })}
            />
            <span className="slider-value">{draft.tutTargetPerRep}s / rep</span>
          </div>
        </div>
        <div className="setting-row">
          <div className="setting-label">
            <strong>Rep counting strictness</strong>
            <small>How much range of motion a rep needs before it counts.</small>
          </div>
          <Seg
            options={[
              { label: "Lenient", value: "Lenient" },
              { label: "Standard", value: "Standard" },
              { label: "Strict", value: "Strict" },
            ]}
            value={draft.strictness}
            onChange={(v) => set({ strictness: v })}
          />
        </div>
      </section>

      <section className="settings-card">
        <p className="micro-label">Camera &amp; session</p>
        <h2>Camera and rest.</h2>
        <div className="setting-row">
          <div className="setting-label">
            <strong>Mirror camera</strong>
            <small>Flip the preview like a mirror (recommended for front-facing cameras).</small>
          </div>
          <Toggle checked={draft.mirrorCamera} onChange={(v) => set({ mirrorCamera: v })} />
        </div>
        <div className="setting-row">
          <div className="setting-label">
            <strong>Rest timer</strong>
            <small>Default rest between sets.</small>
          </div>
          <div className="slider-wrap">
            <input
              type="range"
              min="20"
              max="180"
              step="5"
              value={draft.restSeconds}
              onChange={(e) => set({ restSeconds: Number(e.target.value) })}
            />
            <span className="slider-value">{draft.restSeconds}s</span>
          </div>
        </div>
      </section>

      <div className="settings-actions">
        <button className="button ghost-button" type="button" onClick={reset}>
          Reset to defaults
        </button>
        <button className="button button-primary" type="button" onClick={() => onSave(draft)} disabled={!dirty}>
          {dirty ? "Save changes" : "Saved"}
        </button>
      </div>
    </div>
  );
}

function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </div>
  );
}
