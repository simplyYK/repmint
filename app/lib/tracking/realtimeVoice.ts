"use client";

// RealtimeVoice — cue-driven speech over a persistent OpenAI Realtime WebRTC
// session. One connection per workout instead of one HTTP round-trip per cue,
// so lines land in ~300ms instead of 1-2s.
//
// Speech discipline (the "doesn't just keep talking" contract):
// - No microphone track is ever attached and the server session disables turn
//   detection, so the model physically cannot self-trigger.
// - Every utterance is an explicit response.create carrying one cue; the
//   session instructions cap it at 1-2 short sentences per cue.
// - A new higher/equal-priority cue cancels the in-flight response first.
//
// Failure contract mirrors the tts engine: any error marks the engine failed
// and the caller (CoachVoice) falls back to on-device speech mid-set.

export class RealtimeVoice {
  private pc: RTCPeerConnection | null = null;
  private dc: RTCDataChannel | null = null;
  private audio: HTMLAudioElement | null = null;
  private connecting: Promise<boolean> | null = null;
  private speaking = false;
  private currentPriority = 0;
  private lastConnectAttempt = 0;
  /** Set by finishAndClose; seals the engine so no cue can ever follow it. */
  private closing: Promise<void> | null = null;
  /** Resolves the finishAndClose wait when the final line's audio is done. */
  private onFinalDone: (() => void) | null = null;
  private finalCueCreated = false;
  /** Sticky after a hard failure; CoachVoice checks this to fall back. */
  failed = false;

  constructor(private voice?: string) {}

  /** Open (or reuse) the WebRTC session. Resolves false on any failure. */
  connect(): Promise<boolean> {
    if (this.dc?.readyState === "open") return Promise.resolve(true);
    if (this.connecting) return this.connecting;
    // One reconnect attempt per 30s so a dead network doesn't stall every cue.
    const now = Date.now();
    if (this.failed && now - this.lastConnectAttempt < 30_000) return Promise.resolve(false);
    this.lastConnectAttempt = now;

    this.connecting = (async () => {
      try {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const anonKey =
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
        if (!url || !anonKey) throw new Error("supabase not configured");
        const { supabase } = await import("../supabaseClient");
        if (!supabase) throw new Error("supabase not configured");
        const { data: sess } = await supabase.auth.getSession();
        const token = sess.session?.access_token;
        if (!token) throw new Error("not signed in");

        const tokenRes = await fetch(`${url}/functions/v1/realtime-token`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, apikey: anonKey, "Content-Type": "application/json" },
          body: JSON.stringify({ voice: this.voice }),
        });
        const tokenJson = await tokenRes.json();
        if (!tokenRes.ok || !tokenJson.value) throw new Error(tokenJson.error ?? "token mint failed");

        this.teardown();
        const pc = new RTCPeerConnection();
        this.pc = pc;
        // Receive-only: the coach talks, it never listens.
        pc.addTransceiver("audio", { direction: "recvonly" });
        pc.ontrack = (e) => {
          this.audio = this.audio ?? new Audio();
          this.audio.autoplay = true;
          this.audio.srcObject = e.streams[0];
        };
        pc.onconnectionstatechange = () => {
          if (pc.connectionState === "failed" || pc.connectionState === "closed") {
            this.dc = null;
          }
        };

        const dc = pc.createDataChannel("oai-events");
        dc.onmessage = (e) => this.onEvent(e.data);
        const opened = new Promise<void>((resolve, reject) => {
          dc.onopen = () => resolve();
          dc.onerror = () => reject(new Error("data channel error"));
          setTimeout(() => reject(new Error("data channel open timeout")), 10_000);
        });

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        const sdpRes = await fetch("https://api.openai.com/v1/realtime/calls", {
          method: "POST",
          headers: { Authorization: `Bearer ${tokenJson.value}`, "Content-Type": "application/sdp" },
          body: offer.sdp,
        });
        if (!sdpRes.ok) throw new Error(`sdp exchange failed (${sdpRes.status})`);
        await pc.setRemoteDescription({ type: "answer", sdp: await sdpRes.text() });
        await opened;

        this.dc = dc;
        this.failed = false;
        return true;
      } catch {
        this.failed = true;
        this.teardown();
        return false;
      } finally {
        this.connecting = null;
      }
    })();
    return this.connecting;
  }

  private onEvent(raw: string) {
    try {
      const evt = JSON.parse(raw);
      if (evt.type === "response.created") {
        this.speaking = true;
        // A cancel emits no response.created, so any created seen after the
        // final cue was sent belongs to the final cue itself.
        if (this.onFinalDone) this.finalCueCreated = true;
      }
      if (evt.type === "response.done" || evt.type === "response.output_audio.done") {
        this.speaking = false;
        this.currentPriority = 0;
        if (this.finalCueCreated) {
          this.onFinalDone?.();
          this.onFinalDone = null;
        }
      }
    } catch {
      // non-JSON frames are ignorable
    }
  }

  /** Speak one cue. Returns false if the engine can't (caller falls back). */
  speak(text: string, priority: 1 | 2): Promise<boolean> {
    // Sealed after finishAndClose: the coach never speaks again this session.
    if (this.closing) return Promise.resolve(true);
    return this.send(text, priority, false);
  }

  private async send(text: string, priority: 1 | 2, interrupt: boolean): Promise<boolean> {
    if (!text) return true;
    const ok = await this.connect();
    if (!ok || !this.dc || this.dc.readyState !== "open") return false;

    // Same/higher-priority line still playing → let it finish (mirrors tts engine).
    if (this.speaking && !interrupt && priority <= this.currentPriority) return true;
    // Higher-priority cue interrupts: cancel whatever is mid-sentence.
    if (this.speaking) this.dc.send(JSON.stringify({ type: "response.cancel" }));

    this.currentPriority = priority;
    this.dc.send(
      JSON.stringify({
        type: "response.create",
        response: {
          instructions: `Cue for the athlete right now: "${text.slice(0, 300)}"`,
        },
      }),
    );
    return true;
  }

  /**
   * End-of-workout closure: speak the final line, wait for its audio to
   * finish (response.done / output_audio.done, 15s safety net), then close
   * the WebRTC session for good. Seals the engine immediately — no cue can
   * land after the final line. Safe to call more than once.
   */
  finishAndClose(text: string): Promise<void> {
    if (this.closing) return this.closing;
    this.closing = (async () => {
      try {
        const done = new Promise<void>((resolve) => {
          this.onFinalDone = resolve;
        });
        // Interrupt whatever is mid-sentence — the closing line takes the floor.
        const spoke = await this.send(text, 2, true);
        if (!spoke) {
          // Couldn't deliver the line; mark failed so CoachVoice falls back.
          this.failed = true;
          return;
        }
        // Wait for the audio, but never let a dropped event wedge the session.
        await Promise.race([done, new Promise<void>((r) => setTimeout(r, 15_000))]);
      } finally {
        this.dispose();
      }
    })();
    return this.closing;
  }

  /** Stop current speech without closing the session (mute mid-line). */
  stop(): void {
    if (this.dc?.readyState === "open" && this.speaking) {
      this.dc.send(JSON.stringify({ type: "response.cancel" }));
    }
    this.speaking = false;
    this.currentPriority = 0;
  }

  /** Close the session entirely (end of workout). */
  dispose(): void {
    this.stop();
    this.teardown();
    // Unblock a pending finishAndClose wait so it can't outlive the session.
    this.onFinalDone?.();
    this.onFinalDone = null;
  }

  private teardown(): void {
    this.dc?.close();
    this.pc?.close();
    this.dc = null;
    this.pc = null;
    if (this.audio) {
      this.audio.srcObject = null;
      this.audio = null;
    }
  }
}
