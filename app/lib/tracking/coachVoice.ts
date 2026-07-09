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

export type VoiceEngine = "browser" | "openai";

async function fetchTtsBlob(text: string): Promise<Blob | null> {
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
    body: JSON.stringify({ text }),
  });
  if (!res.ok || !res.headers.get("content-type")?.includes("audio")) return null;
  return await res.blob();
}

export class CoachVoice {
  /** Master switch (mirrors the HUD mute toggle). */
  enabled = true;

  private browser = new VoiceCoach();
  private engine: VoiceEngine;
  private failed = false;
  private audio: HTMLAudioElement | null = null;
  private audioUrl: string | null = null;
  private currentPriority = 0;

  constructor(engine: VoiceEngine = "browser") {
    this.engine = engine;
  }

  /** Rep counts: always on-device — latency beats fidelity mid-set. */
  announceRep(n: number): void {
    if (!this.enabled) return;
    this.browser.enabled = true;
    this.browser.announceRep(n);
  }

  /** Time-critical lines (countdowns): always on-device. */
  immediate(text: string): void {
    if (!this.enabled) return;
    this.browser.enabled = true;
    this.browser.milestone(text);
  }

  cue(text: string): void {
    void this.say(text, 1);
  }

  milestone(text: string): void {
    void this.say(text, 2);
  }

  stop(): void {
    this.browser.stop();
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

    if (this.engine !== "openai" || this.failed) {
      this.speakBrowser(text, priority);
      return;
    }

    // Same/higher-priority natural audio still playing → let it finish.
    if (this.audio && !this.audio.ended && !this.audio.paused && priority <= this.currentPriority) {
      return;
    }

    try {
      const blob = await fetchTtsBlob(text);
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
