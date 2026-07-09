"use client";

// /coach — chat with the AI coach over askCoach(). Seeds the conversation from
// the last 100 coach_messages, supports a post-session context mode when opened
// as /coach?session=<id>, renders light markdown in assistant bubbles, and
// degrades gracefully: provider/config errors surface as assistant-styled
// notices rather than crashing. Coaching guidance, not medical advice.

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader, Card, Button, Spinner } from "../../components/ui/primitives";
import { EmptyState } from "../../components/visuals";
import { askCoach } from "../../lib/ai";
import {
  getSessionDetail,
  listConversations,
  createConversation,
  deleteConversation,
  renameConversation,
  listConversationMessages,
} from "../../lib/db";
import { supabase } from "../../lib/supabaseClient";
import { shortDate } from "../../lib/format";
import type { DbCoachMessage, DbCoachConversation } from "../../lib/types";
import { relativeDate } from "../../lib/format";
import "./coach.css";

type ChatRole = "user" | "assistant";

type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  model?: string | null;
  /** When the coach just created a workout, link straight to it. */
  workout?: { id: string; title: string; exerciseCount: number } | null;
  /** When true, render the content as a plain notice (error / config nudge). */
  notice?: boolean;
  noticeTone?: "warn" | "danger";
};

const SUGGESTIONS = [
  "Create a workout for me",
  "Plan my next session",
  "Review yesterday's workout",
  "What should I focus on next?",
];

function makeId() {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Turn a provider error into supportive, claim-safe copy. Config/no-key errors
// get the "add a key" nudge; everything else surfaces the raw message.
function friendlyError(raw: string): { text: string; tone: "warn" | "danger" } {
  const lower = raw.toLowerCase();
  if (
    lower.includes("key") ||
    lower.includes("set up") ||
    lower.includes("configured") ||
    lower.includes("503")
  ) {
    return {
      text: "AI needs an API key — add OPENROUTER_API_KEY in Supabase secrets.",
      tone: "warn",
    };
  }
  return { text: raw, tone: "danger" };
}

// ---------------------------------------------------------------------------
// Tiny, safe markdown-ish renderer. No dependency: splits into blocks, turns
// runs of "- " lines into <ul>, everything else into <p>, and applies **bold**
// via a text-node split so we never inject raw HTML.
// ---------------------------------------------------------------------------

function renderInline(text: string, keyBase: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return <strong key={`${keyBase}-b-${i}`}>{part.slice(2, -2)}</strong>;
    }
    return <span key={`${keyBase}-t-${i}`}>{part}</span>;
  });
}

function CoachMarkdown({ content }: { content: string }) {
  const blocks = useMemo(() => {
    const lines = content.replace(/\r\n/g, "\n").split("\n");
    type Block =
      | { kind: "p"; text: string }
      | { kind: "ul"; items: string[] };
    const out: Block[] = [];
    let paragraph: string[] = [];
    let bullets: string[] = [];

    const flushParagraph = () => {
      if (paragraph.length) {
        out.push({ kind: "p", text: paragraph.join("\n") });
        paragraph = [];
      }
    };
    const flushBullets = () => {
      if (bullets.length) {
        out.push({ kind: "ul", items: bullets });
        bullets = [];
      }
    };

    for (const line of lines) {
      const bullet = line.match(/^\s*[-*]\s+(.*)$/);
      if (bullet) {
        flushParagraph();
        bullets.push(bullet[1]);
        continue;
      }
      if (line.trim() === "") {
        flushBullets();
        flushParagraph();
        continue;
      }
      flushBullets();
      paragraph.push(line);
    }
    flushBullets();
    flushParagraph();
    return out;
  }, [content]);

  return (
    <div className="coach-md">
      {blocks.map((block, i) =>
        block.kind === "ul" ? (
          <ul key={`ul-${i}`}>
            {block.items.map((item, j) => (
              <li key={`li-${i}-${j}`}>{renderInline(item, `li-${i}-${j}`)}</li>
            ))}
          </ul>
        ) : (
          <p key={`p-${i}`}>{renderInline(block.text, `p-${i}`)}</p>
        ),
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function CoachInner() {
  const params = useSearchParams();
  const sessionId = params.get("session");

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [awaiting, setAwaiting] = useState(false);
  const [input, setInput] = useState("");
  const [sessionLabel, setSessionLabel] = useState<string | null>(null);
  const [contextActive, setContextActive] = useState(Boolean(sessionId));
  const [conversations, setConversations] = useState<DbCoachConversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [showChats, setShowChats] = useState(false);

  const scrollRef = useRef<HTMLDivElement | null>(null);

  const scrollToEnd = useCallback(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  // Bootstrap conversations: pick the most recent (or create the first), then
  // load that conversation's messages. Opening with ?session= starts a fresh
  // chat about that workout.
  useEffect(() => {
    let active = true;
    (async () => {
      if (!supabase) {
        if (active) setLoading(false);
        return;
      }
      try {
        let convs = await listConversations();
        let target: DbCoachConversation;
        if (sessionId) {
          target = await createConversation("About a workout");
          convs = [target, ...convs];
        } else if (convs.length === 0) {
          target = await createConversation();
          convs = [target];
        } else {
          target = convs[0];
        }
        if (!active) return;
        setConversations(convs);
        setActiveConvId(target.id);
        const rows = (await listConversationMessages(target.id)) as DbCoachMessage[];
        if (!active) return;
        setMessages(
          rows.map((r) => ({ id: r.id, role: r.role, content: r.content, model: r.model })),
        );
      } catch {
        // Non-fatal — just start from an empty (welcome) state.
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const switchConversation = useCallback(async (id: string) => {
    setActiveConvId(id);
    setShowChats(false);
    setLoading(true);
    try {
      const rows = (await listConversationMessages(id)) as DbCoachMessage[];
      setMessages(rows.map((r) => ({ id: r.id, role: r.role, content: r.content, model: r.model })));
    } finally {
      setLoading(false);
    }
  }, []);

  const startNewChat = useCallback(async () => {
    const conv = await createConversation();
    setConversations((cur) => [conv, ...cur]);
    setActiveConvId(conv.id);
    setMessages([]);
    setShowChats(false);
  }, []);

  const removeConversation = useCallback(
    async (id: string) => {
      await deleteConversation(id);
      setConversations((cur) => {
        const next = cur.filter((c) => c.id !== id);
        if (id === activeConvId) {
          if (next[0]) void switchConversation(next[0].id);
          else void startNewChat();
        }
        return next;
      });
    },
    [activeConvId, switchConversation, startNewChat],
  );

  // If opened with ?session=, fetch a friendly label for the context chip.
  useEffect(() => {
    if (!sessionId) return;
    let active = true;
    (async () => {
      try {
        const { session } = await getSessionDetail(sessionId);
        if (!active) return;
        const title = session.title?.trim();
        const when = session.started_at ? shortDate(session.started_at) : null;
        setSessionLabel(title || when || "your last session");
      } catch {
        if (active) setSessionLabel("your last session");
      }
    })();
    return () => {
      active = false;
    };
  }, [sessionId]);

  useEffect(() => {
    scrollToEnd();
  }, [messages, awaiting, scrollToEnd]);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || awaiting) return;

      const userMsg: ChatMessage = { id: makeId(), role: "user", content: trimmed };
      setMessages((cur) => [...cur, userMsg]);
      setInput("");
      setAwaiting(true);

      const useContext = Boolean(sessionId) && contextActive;
      // First message names an untitled chat so the list stays scannable.
      const conv = conversations.find((c) => c.id === activeConvId);
      if (conv && !conv.title && activeConvId) {
        const title = trimmed.slice(0, 48);
        void renameConversation(activeConvId, title).catch(() => {});
        setConversations((cur) => cur.map((c) => (c.id === activeConvId ? { ...c, title } : c)));
      }
      const result = await askCoach({
        message: trimmed,
        mode: useContext ? "post_session" : "chat",
        sessionId: useContext ? sessionId ?? undefined : undefined,
        conversationId: activeConvId ?? undefined,
      });

      setAwaiting(false);

      if ("error" in result) {
        const { text: msg, tone } = friendlyError(result.error);
        setMessages((cur) => [
          ...cur,
          { id: makeId(), role: "assistant", content: msg, notice: true, noticeTone: tone },
        ]);
        return;
      }

      setMessages((cur) => [
        ...cur,
        {
          id: makeId(),
          role: "assistant",
          content: result.message,
          model: result.model,
          workout: result.workout ?? null,
        },
      ]);
    },
    [awaiting, sessionId, contextActive, activeConvId, conversations],
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    void send(input);
  }

  const showSuggestions = messages.length < 3 && !awaiting;
  const isEmpty = messages.length === 0;

  return (
    <div className="coach-page">
      <PageHeader
        eyebrow="AI coach"
        title={conversations.find((c) => c.id === activeConvId)?.title || "Coach"}
        subtitle="Ask about your training, plan your next session, or talk through where to focus."
        actions={
          <div className="coach-header-actions">
            <Button size="sm" variant="secondary" onClick={() => void startNewChat()}>
              + New chat
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowChats((v) => !v)}>
              Chats ({conversations.length})
            </Button>
          </div>
        }
      />

      {showChats && (
        <Card className="coach-chats">
          {conversations.length === 0 && <p className="coach-chats-empty">No chats yet.</p>}
          {conversations.map((c) => (
            <div key={c.id} className={`coach-chats-row${c.id === activeConvId ? " active" : ""}`}>
              <button type="button" className="coach-chats-open" onClick={() => void switchConversation(c.id)}>
                <strong>{c.title || "New conversation"}</strong>
                <small>{relativeDate(c.updated_at)}</small>
              </button>
              <button
                type="button"
                className="coach-chats-delete"
                aria-label={`Delete chat ${c.title || "New conversation"}`}
                onClick={() => {
                  if (window.confirm("Delete this chat? Its messages are removed; what the coach learned about you is kept.")) {
                    void removeConversation(c.id);
                  }
                }}
              >
                ✕
              </button>
            </div>
          ))}
        </Card>
      )}

      <Card className="coach-card ai-chat">
        <div className="coach-scroll" ref={scrollRef} aria-live="polite">
          {loading ? (
            <Spinner label="Loading your conversation…" />
          ) : isEmpty ? (
            <div className="ai-msg assistant">
              <img className="ai-avatar" src="/brand/logomark.svg" alt="" aria-hidden />
              <div className="ai-bubble">
                <EmptyState name="coach" className="coach-welcome-art" />
                <div className="coach-md">
                  <p>
                    Hey — I&apos;m your RepMint coach. Ask me to plan a session, review a recent
                    workout, or figure out what to work on next.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            messages.map((m) =>
              m.role === "user" ? (
                <div key={m.id} className="ai-msg user">
                  <div className="ai-bubble">
                    <p>{m.content}</p>
                  </div>
                </div>
              ) : (
                <div key={m.id}>
                  <div className="ai-msg assistant">
                    <img className="ai-avatar" src="/brand/logomark.svg" alt="" aria-hidden />
                    <div className="ai-bubble">
                      {m.notice ? (
                        <div
                          className={`notice notice-${m.noticeTone ?? "danger"} coach-msg-notice`}
                        >
                          {m.content}
                        </div>
                      ) : (
                        <CoachMarkdown content={m.content} />
                      )}
                      {m.workout && (
                        <a className="coach-workout-card" href="/workouts">
                          <span className="coach-workout-icon" aria-hidden>
                            ▶
                          </span>
                          <span>
                            <strong>{m.workout.title}</strong>
                            <small>
                              {m.workout.exerciseCount} exercise
                              {m.workout.exerciseCount === 1 ? "" : "s"} · saved to your Workouts
                            </small>
                          </span>
                        </a>
                      )}
                    </div>
                  </div>
                  {m.model && !m.notice && <p className="coach-model">{m.model}</p>}
                </div>
              ),
            )
          )}

          {awaiting && (
            <div className="ai-msg assistant">
              <img className="ai-avatar" src="/brand/logomark.svg" alt="" aria-hidden />
              <div className="ai-bubble">
                <span className="ai-typing" aria-label="Coach is typing">
                  <i />
                  <i />
                  <i />
                </span>
              </div>
            </div>
          )}
        </div>

        {showSuggestions && (
          <div className="ai-suggestions">
            {SUGGESTIONS.map((s) => (
              <button key={s} type="button" onClick={() => void send(s)} disabled={awaiting}>
                {s}
              </button>
            ))}
          </div>
        )}

        {sessionId && contextActive && (
          <div className="coach-context">
            <span className="coach-context-chip">
              <span>About {sessionLabel ?? "your last session"}</span>
              <button
                type="button"
                onClick={() => setContextActive(false)}
                aria-label="Clear session context"
                title="Chat without session context"
              >
                ×
              </button>
            </span>
          </div>
        )}

        <form className="ai-input" onSubmit={handleSubmit}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask your coach…"
            aria-label="Message the coach"
            enterKeyHint="send"
          />
          <Button type="submit" disabled={awaiting || input.trim().length === 0}>
            Send
          </Button>
        </form>

        <p className="ai-disclaimer">Coaching guidance, not medical advice.</p>
      </Card>
    </div>
  );
}

export default function CoachPage() {
  return (
    <Suspense fallback={<Spinner label="Loading coach…" />}>
      <CoachInner />
    </Suspense>
  );
}
