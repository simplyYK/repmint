"use client";

// AI coach chat. Talks to the Supabase `gemini-coach` edge function (server-side
// Gemini — the key never touches the browser). Scope is enforced on the server:
// the coach only answers training, technique, programming, and pre/post-workout
// nutrition questions and politely declines anything else.

import { useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabaseClient";
import type { Profile } from "../lib/types";

type Rec = { title: string; recommendation: string; reason: string; action_label?: string };
type Msg = { role: "user" | "assistant"; content: string; recommendations?: Rec[] };

const SUGGESTIONS = [
  "What should I eat before and after a workout?",
  "How do I get better depth on my squat?",
  "Build me a quick full-body session for today.",
  "Why do my push-ups feel harder near the end?",
];

const WELCOME: Msg = {
  role: "assistant",
  content:
    "Hey — I'm your RepMint coach. Ask me about training, technique, programming, or pre and post-workout nutrition and I'll keep it practical. What are we working on?",
};

export default function AiCoach({
  authUser,
  profile,
  onRequireAuth,
}: {
  authUser: User | null;
  profile: Profile;
  onRequireAuth: () => void;
}) {
  const [messages, setMessages] = useState<Msg[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const conversationRef = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  const gated = !supabase || !authUser;

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || busy) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: message }]);
    setBusy(true);
    try {
      const { data, error } = await supabase!.functions.invoke("gemini-coach", {
        body: {
          mode: "chat",
          message,
          conversationId: conversationRef.current ?? undefined,
          tone: profile.tone,
          goal: profile.goal,
        },
      });
      if (error) {
        // Edge function returns a JSON error body (e.g. key not configured).
        const ctx = (error as { context?: { body?: string } }).context;
        let msg = "The AI coach isn't available right now.";
        try {
          if (ctx?.body) msg = JSON.parse(ctx.body).error ?? msg;
        } catch {
          /* keep default */
        }
        setMessages((m) => [...m, { role: "assistant", content: msg }]);
      } else {
        conversationRef.current = data?.conversationId ?? conversationRef.current;
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            content: data?.message ?? "I didn't catch that — try rephrasing?",
            recommendations: Array.isArray(data?.recommendations) ? data.recommendations : undefined,
          },
        ]);
      }
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "Something went wrong reaching the coach. Try again in a moment." }]);
    } finally {
      setBusy(false);
    }
  };

  if (gated) {
    return (
      <div className="screen-stack">
        <header className="section-header">
          <div>
            <p className="micro-label">AI coach</p>
            <h1>Your always-on training and nutrition coach.</h1>
          </div>
        </header>
        <section className="panel ai-gate">
          <h2>Sign in to chat with your coach.</h2>
          <p>
            The AI coach uses your saved training to give personalized answers on technique, programming, and pre and
            post-workout nutrition. Create a free account to start the conversation.
          </p>
          <button className="button button-primary" onClick={onRequireAuth}>
            Create account or sign in
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="screen-stack ai-screen">
      <header className="section-header">
        <div>
          <p className="micro-label">AI coach</p>
          <h1>Ask your coach.</h1>
        </div>
        <span className="ai-scope">Training · technique · pre/post-workout nutrition</span>
      </header>

      <section className="ai-chat">
        <div className="ai-messages" ref={scrollRef}>
          {messages.map((m, i) => (
            <div key={i} className={`ai-msg ${m.role}`}>
              {m.role === "assistant" && <span className="ai-avatar">R</span>}
              <div className="ai-bubble">
                <p>{m.content}</p>
                {m.recommendations && m.recommendations.length > 0 && (
                  <div className="ai-recs">
                    {m.recommendations.map((r, ri) => (
                      <div className="ai-rec" key={ri}>
                        <strong>{r.title}</strong>
                        <span>{r.recommendation}</span>
                        {r.reason && <em>{r.reason}</em>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          {busy && (
            <div className="ai-msg assistant">
              <span className="ai-avatar">R</span>
              <div className="ai-bubble">
                <span className="ai-typing">
                  <i />
                  <i />
                  <i />
                </span>
              </div>
            </div>
          )}
        </div>

        {messages.length <= 1 && (
          <div className="ai-suggestions">
            {SUGGESTIONS.map((s) => (
              <button key={s} onClick={() => send(s)} disabled={busy}>
                {s}
              </button>
            ))}
          </div>
        )}

        <form
          className="ai-input"
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about training, technique, or nutrition…"
            aria-label="Message the AI coach"
          />
          <button className="button button-primary" type="submit" disabled={busy || !input.trim()}>
            Send
          </button>
        </form>
        <p className="ai-disclaimer">
          Coaching guidance only — not medical advice. The coach sticks to training, technique, and pre/post-workout
          nutrition.
        </p>
      </section>
    </div>
  );
}
