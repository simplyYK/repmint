"use client";

// CoachDock — the always-available AI coach. A floating logomark button on
// every app screen (except /coach itself and /train, which have their own
// coaching surfaces) that opens a glass slide-over chat. Each message carries
// pageContext (route + a human-readable summary of what's on screen) so the
// server-side coach can ground answers in what the user is looking at, on top
// of its existing retrieval context (profile, sessions, plan, exercise bank,
// conversation history).

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { askCoach } from "../../lib/ai";
import { Markdown } from "./Markdown";

type DockMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  workout?: { id: string; title: string } | null;
  error?: boolean;
  /** User message whose reply was cancelled mid-flight. */
  stopped?: boolean;
};

const HIDDEN_ROUTES = ["/coach", "/train"];

// Route-aware conversation starters — the dock should feel like it knows
// where you are.
function suggestionsFor(pathname: string): string[] {
  if (pathname.startsWith("/history") || pathname.startsWith("/insights")) {
    return ["What stands out in my progress?", "Where am I most consistent?"];
  }
  if (pathname.startsWith("/workouts") || pathname.startsWith("/plan")) {
    return ["Create a workout for me", "Is my plan balanced?"];
  }
  if (pathname.startsWith("/exercises")) {
    return ["Which of these fit my equipment?", "Build a workout from this category"];
  }
  if (pathname.startsWith("/settings")) {
    return ["What do these AI settings do?"];
  }
  return ["What should I train today?", "Create a workout for me"];
}

function pageLabel(pathname: string): string {
  if (pathname.startsWith("/hub")) return "the daily hub (today's recommendation, streak, recent sessions)";
  if (pathname.startsWith("/workouts")) return "their saved workouts list";
  if (pathname.startsWith("/plan")) return "their AI training plan";
  if (pathname.startsWith("/history")) return "their training history calendar";
  if (pathname.startsWith("/insights")) return "their progress insights charts";
  if (pathname.startsWith("/exercises")) return "the exercise library";
  if (pathname.startsWith("/settings")) return "their settings";
  return pathname;
}

function makeId() {
  return `dock-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function CoachDock() {
  const pathname = usePathname();
  const reduced = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<DockMessage[]>([]);
  const [input, setInput] = useState("");
  const [awaiting, setAwaiting] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, awaiting, open]);

  // Close the panel when navigating.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || awaiting) return;
      const userId = makeId();
      setMessages((cur) => [...cur, { id: userId, role: "user", content: trimmed }]);
      setInput("");
      setAwaiting(true);

      const controller = new AbortController();
      abortRef.current = controller;
      const result = await askCoach(
        {
          message: trimmed,
          mode: "chat",
          pageContext: `The user is currently looking at ${pageLabel(pathname)} (route ${pathname}).`,
        },
        controller.signal,
      );
      abortRef.current = null;

      setAwaiting(false);
      if ("error" in result) {
        if (result.aborted) {
          setMessages((cur) =>
            cur.map((m) => (m.id === userId ? { ...m, stopped: true } : m)),
          );
          return;
        }
        setMessages((cur) => [
          ...cur,
          { id: makeId(), role: "assistant", content: result.error, error: true },
        ]);
        return;
      }
      setMessages((cur) => [
        ...cur,
        { id: makeId(), role: "assistant", content: result.message, workout: result.workout ?? null },
      ]);
    },
    [awaiting, pathname],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  if (HIDDEN_ROUTES.some((r) => pathname.startsWith(r))) return null;

  return (
    <>
      <button
        type="button"
        className={`coach-dock-fab${open ? " open" : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close coach" : "Ask your coach"}
        aria-expanded={open}
      >
        {open ? (
          <span className="coach-dock-fab-x" aria-hidden>
            ×
          </span>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src="/brand/logomark.svg" alt="" />
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.aside
            className="coach-dock-panel"
            role="dialog"
            aria-label="AI coach"
            initial={reduced ? false : { opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduced ? undefined : { opacity: 0, y: 24, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            <header className="coach-dock-head">
              <div>
                <strong>Coach</strong>
                <small>Knows your training — and this page</small>
              </div>
              <a href="/coach" className="chip">
                Full chat
              </a>
            </header>

            <div className="coach-dock-scroll" ref={scrollRef}>
              {messages.length === 0 && (
                <p className="coach-dock-hint">
                  Ask about what you&apos;re looking at, your training, or tell me to build you a
                  workout.
                </p>
              )}
              {messages.map((m) => (
                <div key={m.id} className={`coach-dock-msg ${m.role}${m.error ? " error" : ""}`}>
                  {m.role === "assistant" && !m.error ? (
                    <Markdown content={m.content} />
                  ) : (
                    <p>{m.content}</p>
                  )}
                  {m.stopped && <small className="chat-stopped">stopped</small>}
                  {m.workout && (
                    <a className="coach-dock-workout" href="/workouts">
                      ▶ {m.workout.title} — saved to Workouts
                    </a>
                  )}
                </div>
              ))}
              {awaiting && (
                <div className="coach-dock-msg assistant">
                  <span className="ai-typing" aria-label="Coach is typing">
                    <i />
                    <i />
                    <i />
                  </span>
                </div>
              )}
            </div>

            {messages.length === 0 && (
              <div className="coach-dock-suggestions">
                {suggestionsFor(pathname).map((s) => (
                  <button key={s} type="button" onClick={() => void send(s)}>
                    {s}
                  </button>
                ))}
              </div>
            )}

            <form
              className="coach-dock-inputrow"
              onSubmit={(e) => {
                e.preventDefault();
                void send(input);
              }}
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask your coach…"
                aria-label="Ask your coach"
              />
              {awaiting ? (
                <button type="button" className="btn btn-secondary btn-sm" onClick={stop}>
                  Stop
                </button>
              ) : (
                <button type="submit" className="btn btn-primary btn-sm" disabled={!input.trim()}>
                  Send
                </button>
              )}
            </form>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}
