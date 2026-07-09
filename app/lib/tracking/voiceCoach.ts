// Voice coach — a small, polite Web Speech API wrapper for the live trainer.
//
// Why: during a set the user's eyes are on their form (or the floor), not the
// screen, so rep counts and the single most important form cue are spoken.
// This wrapper exists to keep speech CALM: short utterances, strict priority
// rules (a rep count never talks over a form cue, a form cue never talks over
// a milestone), and a throttle so cues can't nag. It feature-detects
// `speechSynthesis` and degrades to a silent no-op everywhere else (SSR,
// older browsers, users who denied audio) — callers never need to branch.
//
// Priorities: 0 = rep counts, 1 = coaching cues, 2 = milestones/set events.

/** Speech priority: 0 = rep count, 1 = coaching cue, 2 = milestone. */
export type SpeechPriority = 0 | 1 | 2;

const CUE_THROTTLE_MS = 4000;
const SPEECH_RATE = 1.05;

type QueueItem = { text: string; priority: SpeechPriority };

/**
 * Priority-aware text-to-speech for the live training HUD.
 *
 * Rules enforced:
 * - Never interrupts an utterance of the same or higher priority.
 * - A higher-priority utterance cancels current speech and any queued
 *   lower-priority items.
 * - Coaching cues are throttled to at least 4 seconds apart.
 * - Prefers an on-device (localService) English voice; rate 1.05.
 * - Silent no-op when `speechSynthesis` is unavailable or `enabled` is false.
 */
export class VoiceCoach {
  /** Master switch. Set false to mute without tearing the instance down. */
  enabled = true;

  private supported: boolean;
  private voice: SpeechSynthesisVoice | null = null;
  private speaking = false;
  private currentPriority: SpeechPriority = 0;
  private queue: QueueItem[] = [];
  private lastCueAt = 0;

  constructor() {
    this.supported =
      typeof window !== "undefined" &&
      "speechSynthesis" in window &&
      typeof window.SpeechSynthesisUtterance !== "undefined";
    if (this.supported) {
      this.pickVoice();
      // Voice list often loads async; re-pick when it arrives.
      window.speechSynthesis.addEventListener?.("voiceschanged", () => this.pickVoice());
    }
  }

  /**
   * Speak `text` at the given priority, respecting interruption rules:
   * - If nothing is speaking, speak immediately.
   * - If something of LOWER priority is speaking, cancel it and speak now.
   * - If something of same/higher priority is speaking: rep counts (0) are
   *   dropped (a stale count is worse than silence); cues/milestones are
   *   queued after lower-priority queued items are discarded.
   */
  speak(text: string, priority: SpeechPriority): void {
    if (!this.enabled || !this.supported || !text) return;

    if (this.speaking) {
      if (priority > this.currentPriority) {
        // Higher priority wins: drop everything below it and take the mic.
        this.queue = this.queue.filter((q) => q.priority >= priority);
        window.speechSynthesis.cancel();
        this.speaking = false;
        this.speakNow(text, priority);
      } else if (priority > 0) {
        // Same/higher priority is talking — wait our turn, but evict any
        // queued items this one outranks.
        this.queue = this.queue.filter((q) => q.priority >= priority);
        this.queue.push({ text, priority });
      }
      // priority 0 while busy: drop silently — rep counts go stale instantly.
      return;
    }
    this.speakNow(text, priority);
  }

  /**
   * Announce a completed rep by number ("one", "two", …). Lowest priority —
   * never talks over a cue or milestone.
   */
  announceRep(n: number): void {
    this.speak(String(n), 0);
  }

  /**
   * Speak a coaching cue (priority 1). Throttled: cues fire at most once
   * every 4 seconds so the coach corrects, not nags. New cues discard queued
   * lower-priority speech.
   */
  cue(text: string): void {
    const now = Date.now();
    if (now - this.lastCueAt < CUE_THROTTLE_MS) return;
    this.lastCueAt = now;
    this.speak(text, 1);
  }

  /**
   * Speak a milestone (priority 2) — set complete, halfway, personal best.
   * Interrupts rep counts and cues.
   */
  milestone(text: string): void {
    this.speak(text, 2);
  }

  /** Cancel current speech and clear the queue. Safe to call any time. */
  stop(): void {
    if (!this.supported) return;
    this.queue = [];
    this.speaking = false;
    window.speechSynthesis.cancel();
  }

  // ---- internals ----------------------------------------------------------

  private current: SpeechSynthesisUtterance | null = null;

  private speakNow(text: string, priority: SpeechPriority) {
    const u = new SpeechSynthesisUtterance(text);
    u.rate = SPEECH_RATE;
    if (this.voice) u.voice = this.voice;
    const done = () => {
      // A cancelled utterance's onend fires asynchronously — possibly after a
      // higher-priority utterance has taken over. Only the CURRENT utterance
      // may flip the speaking flag and drain the queue.
      if (this.current !== u) return;
      this.current = null;
      this.speaking = false;
      this.drainQueue();
    };
    u.onend = done;
    u.onerror = done;
    this.speaking = true;
    this.currentPriority = priority;
    this.current = u;
    window.speechSynthesis.speak(u);
  }

  private drainQueue() {
    const next = this.queue.shift();
    if (next && this.enabled) this.speakNow(next.text, next.priority);
  }

  // Prefer an on-device English voice: no network round-trip mid-set, and
  // consistent latency between the rep and the count.
  private pickVoice() {
    try {
      const voices = window.speechSynthesis.getVoices();
      if (!voices.length) return;
      const en = voices.filter((v) => v.lang.toLowerCase().startsWith("en"));
      this.voice = en.find((v) => v.localService) ?? en[0] ?? voices.find((v) => v.localService) ?? voices[0] ?? null;
    } catch {
      this.voice = null;
    }
  }
}
