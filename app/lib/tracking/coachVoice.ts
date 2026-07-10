"use client";

// CoachVoice — the voice engine facade for the live trainer.
//
// Two engines:
// - "browser": on-device Web Speech (VoiceCoach). Instant, offline, robotic.
// - "openai": natural TTS via the `tts` edge function (gpt-4o-mini-tts).
//   Used for coaching cues and milestones; rep counts ALWAYS stay on-device
//   because a ~700ms network round-trip on "six!" lands mid-rep-seven.
//
// Fallback contract: any OpenAI failure (no key, offline, rate limit) flips
// this session permanently back to the browser engine — the athlete never
// loses voice coaching mid-set.

import { VoiceCoach } from "./voiceCoach";
import { RealtimeVoice } from "./realtimeVoice";

export type VoiceEngine = "browser" | "openai" | "realtime";

/** Exported for the Settings voice-preview button; returns null on any failure. */
export async function fetchTtsBlob(text: string, voice?: string): Promise<Blob | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !anonKey) return null;

  // Session token, read lazily to avoid a hard dependency cycle.
  const { supabase } = await import("../supabaseClient");
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return null;

  const res = await fetch(`${url}/functions/v1/tts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: anonKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(voice ? { text, voice } : { text }),
  });
  if (!res.ok || !res.headers.get("content-type")?.includes("audio")) return null;
  return await res.blob();
}

export class CoachVoice {
  private _enabled = true;
  private browser = new VoiceCoach();
  private realtime: RealtimeVoice | null = null;
  private engine: VoiceEngine;
  private failed = false;
  /** Set once the workout's closing line has been handed off; coach goes silent. */
  private ended = false;
  private audio: HTMLAudioElement | null = null;
  private audioUrl: string | null = null;
  private currentPriority = 0;

  /** Preferred OpenAI TTS voice (settings.tts_voice); server default when unset. */
  voice: string | undefined;

  constructor(engine: VoiceEngine = "browser", voice?: string) {
    this.engine = engine;
    this.voice = voice;
    // Realtime connects lazily: warm() fires at set start, and the first
    // speak() connects on its own as a fallback — no idle session while the
    // athlete is still browsing the launcher or framing the camera.
    if (engine === "realtime") this.realtime = new RealtimeVoice(voice);
  }

  /** Master switch (mirrors the HUD mute toggle). */
  get enabled(): boolean {
    return this._enabled;
  }

  /** Muting silences the coach NOW — mid-line speech stops immediately. */
  set enabled(on: boolean) {
    this._enabled = on;
    if (!on) {
      this.browser.stop();
      this.realtime?.stop();
      this.stopAudioOnly();
    }
  }

  /** Pre-open the realtime session so the first cue is instant. No-op for other engines. */
  warm(): void {
    if (this.engine === "realtime" && this.realtime && !this.failed && !this.ended) {
      void this.realtime.connect();
    }
  }

  /** Rep counts: always on-device — latency beats fidelity mid-set. */
  announceRep(n: number): void {
    if (!this.enabled || this.ended) return;
    this.browser.enabled = true;
    this.browser.announceRep(n);
  }

  /** Time-critical lines (countdowns): always on-device. */
  immediate(text: string): void {
    if (!this.enabled || this.ended) return;
    this.browser.enabled = true;
    this.browser.milestone(text);
  }

  cue(text: string): void {
    if (this.ended) return;
    void this.say(text, 1);
  }

  milestone(text: string): void {
    if (this.ended) return;
    void this.say(text, 2);
  }

  /**
   * End-of-set/workout closure: the closing line is ALWAYS spoken on-device
   * (Web Speech), word-exact and guaranteed to play out in full — a realtime
   * model paraphrases the line and its session teardown can race playback.
   * The realtime/tts engines are shut down quietly first so nothing talks
   * over it and no session lingers. Idempotent.
   */
  async endWorkout(finalLine?: string): Promise<void> {
    if (this.ended) return;
    this.ended = true;
    this.realtime?.dispose();
    this.stopAudioOnly();
    if (this._enabled && finalLine) this.speakBrowser(finalLine, 2);
  }

  stop(): void {
    this.browser.stop();
    this.realtime?.dispose();
    if (this.audio) {
      this.audio.pause();
      this.audio = null;
    }
    if (this.audioUrl) {
      URL.revokeObjectURL(this.audioUrl);
      this.audioUrl = null;
    }
  }

  private async say(text: string, priority: 1 | 2): Promise<void> {
    if (!this.enabled || !text) return;

    if (this.engine === "realtime" && this.realtime && !this.failed) {
      const spoke = await this.realtime.speak(text, priority);
      if (spoke) return;
      // Realtime session unavailable → permanent fallback for this workout.
      this.failed = true;
      this.speakBrowser(text, priority);
      return;
    }

    if (this.engine !== "openai" || this.failed) {
      this.speakBrowser(text, priority);
      return;
    }

    // Same/higher-priority natural audio still playing → let it finish.
    if (this.audio && !this.audio.ended && !this.audio.paused && priority <= this.currentPriority) {
      return;
    }

    try {
      const blob = await fetchTtsBlob(text, this.voice);
      if (!blob) throw new Error("tts unavailable");
      if (!this.enabled) return; // muted while fetching
      this.stopAudioOnly();
      this.audioUrl = URL.createObjectURL(blob);
      this.audio = new Audio(this.audioUrl);
      this.currentPriority = priority;
      await this.audio.play();
    } catch {
      // One strike: don't hammer a dead endpoint mid-workout.
      this.failed = true;
      this.speakBrowser(text, priority);
    }
  }

  private speakBrowser(text: string, priority: 1 | 2): void {
    this.browser.enabled = true;
    if (priority === 1) this.browser.cue(text);
    else this.browser.milestone(text);
  }

  private stopAudioOnly(): void {
    if (this.audio) this.audio.pause();
    if (this.audioUrl) URL.revokeObjectURL(this.audioUrl);
    this.audio = null;
    this.audioUrl = null;
  }
}
