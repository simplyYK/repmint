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
  /** Resolves when the final line finished GENERATING (response.done). */
  private onFinalGenDone: (() => void) | null = null;
  /** Resolves when the final line finished PLAYING (output_audio_buffer.stopped). */
  private onFinalAudioStopped: (() => void) | null = null;
  /** True from the moment the final cue is sent until its response.created. */
  private awaitingFinalCreated = false;
  /** The final cue's response id — the ONLY response that may close us. */
  private finalResponseId: string | null = null;
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
        // The first response CREATED after the final cue was sent is the final
        // cue itself (a cancel never emits response.created). Pin its id: an
        // earlier, interrupted cue's response.done can arrive AFTER this and
        // must not be mistaken for the final line finishing — that race is
        // what used to cut the closing line off after one word.
        if (this.awaitingFinalCreated) {
          this.awaitingFinalCreated = false;
          this.finalResponseId = (evt.response?.id as string | undefined) ?? "final";
        }
      }
      if (evt.type === "response.done" || evt.type === "response.output_audio.done") {
        const doneId =
          (evt.response?.id as string | undefined) ?? (evt.response_id as string | undefined) ?? null;
        const isFinal =
          this.finalResponseId !== null && (doneId === null || doneId === this.finalResponseId);
        // A done for some other (cancelled/older) response: ignore for closing.
        if (this.finalResponseId === null || isFinal) {
          this.speaking = false;
          this.currentPriority = 0;
        }
        // NOTE: response.done means the audio finished GENERATING, which runs
        // far ahead of playback — closing here would cut the line off after a
        // word. It only arms the fallback below; playout completion is the
        // real close signal.
        if (isFinal) {
          this.onFinalGenDone?.();
          this.onFinalGenDone = null;
        }
      }
      // WebRTC-only event: the output audio buffer fully DRAINED — the line
      // has actually left the speaker. This is the true "speech complete".
      if (evt.type === "output_audio_buffer.stopped") {
        const rid = (evt.response_id as string | undefined) ?? null;
        if (this.finalResponseId !== null && (rid === null || rid === this.finalResponseId)) {
          this.onFinalAudioStopped?.();
          this.onFinalAudioStopped = null;
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
        const genDone = new Promise<void>((resolve) => {
          this.onFinalGenDone = resolve;
        });
        const audioStopped = new Promise<void>((resolve) => {
          this.onFinalAudioStopped = resolve;
        });
        this.awaitingFinalCreated = true;
        // Interrupt whatever is mid-sentence — the closing line takes the floor.
        const spoke = await this.send(text, 2, true);
        if (!spoke) {
          // Couldn't deliver the line; mark failed so CoachVoice falls back.
          this.failed = true;
          return;
        }
        // The model GENERATES audio much faster than it PLAYS — response.done
        // can arrive with seconds of speech still queued in the WebRTC playout
        // buffer, so it must never close the session by itself. Close on
        // output_audio_buffer.stopped (playback truly finished, +300ms pad);
        // if that event never arrives, fall back to generation-done plus a
        // drain window long enough for the whole line; 15s hard cap.
        await Promise.race([
          audioStopped.then(() => new Promise<void>((r) => setTimeout(r, 300))),
          genDone.then(() => new Promise<void>((r) => setTimeout(r, 6_000))),
          new Promise<void>((r) => setTimeout(r, 15_000)),
        ]);
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
    // Unblock any pending finishAndClose waits so they can't outlive the session.
    this.onFinalGenDone?.();
    this.onFinalGenDone = null;
    this.onFinalAudioStopped?.();
    this.onFinalAudioStopped = null;
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
