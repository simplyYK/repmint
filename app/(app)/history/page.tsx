"use client";

// /history — the training calendar. A real month grid with prev/next nav marks
// days that have logged sessions, a reverse-chronological list of the visible
// month's sessions, and a detail drawer for any session: per-set breakdown
// grouped by exercise, after-the-fact weight editing (optimistic supabase
// update), delete-with-confirm, and an "ask coach" handoff. Copy stays
// supportive and practical — form % is framed as a coaching signal.

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { PageHeader, Card, Button, LinkButton, Spinner, InlineNotice, SectionTabs } from "../../components/ui/primitives";
import { EmptyState, MovementGlyph } from "../../components/visuals";
import { listSessions, getSessionDetail, getProfile } from "../../lib/db";
import { getMeta, glyphCategory } from "../../lib/library";
import { relativeDate, shortDate, formatClock, formatDuration } from "../../lib/format";
import { supabase } from "../../lib/supabaseClient";
import type { DbSession, DbSessionSet } from "../../lib/types";
import "./history.css";

const PROGRESS_TABS = [
  { href: "/history", label: "History" },
  { href: "/insights", label: "Insights" },
];

type Units = "kg" | "lb";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Local YYYY-M-D key for a date (matches how sessions are bucketed by day). */
function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/** Build a 6-row weeks × 7 grid (Mon-first) covering the given month. */
function monthGrid(month: Date): (Date | null)[][] {
  const year = month.getFullYear();
  const m = month.getMonth();
  const first = new Date(year, m, 1);
  // JS getDay(): 0=Sun..6=Sat. Shift so Monday is column 0.
  const lead = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, m + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < lead; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(new Date(year, m, d));
  while (cells.length % 7 !== 0) cells.push(null);
  const rows: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

function HistoryInner() {
  const params = useSearchParams();
  const initialSession = params.get("session");

  const [month, setMonth] = useState<Date>(() => new Date());
  const [sessions, setSessions] = useState<DbSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [units, setUnits] = useState<Units>("kg");
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(initialSession);

  const loadMonth = useCallback(async (target: Date) => {
    setLoading(true);
    setError(null);
    try {
      const rows = await listSessions(target);
      setSessions(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load your history.");
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMonth(month);
  }, [month, loadMonth]);

  useEffect(() => {
    getProfile()
      .then((p) => {
        const u = (p as { units?: Units } | null)?.units;
        if (u) setUnits(u);
      })
      .catch(() => {});
  }, []);

  // If we were opened with ?session=<id> for a session in another month, fetch
  // that session's month so the calendar + list line up with the open drawer.
  useEffect(() => {
    if (!initialSession) return;
    let active = true;
    getSessionDetail(initialSession)
      .then(({ session }) => {
        if (!active) return;
        const d = new Date(session.started_at);
        if (d.getMonth() !== month.getMonth() || d.getFullYear() !== month.getFullYear()) {
          setMonth(new Date(d.getFullYear(), d.getMonth(), 1));
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
    // Only on first mount for the initial deep link.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSession]);

  const grid = useMemo(() => monthGrid(month), [month]);

  // Session counts per day-key for calendar dots.
  const byDay = useMemo(() => {
    const map = new Map<string, DbSession[]>();
    for (const s of sessions) {
      const key = dayKey(new Date(s.started_at));
      const list = map.get(key) ?? [];
      list.push(s);
      map.set(key, list);
    }
    return map;
  }, [sessions]);

  // The list respects a day filter when one is picked, otherwise the whole month.
  const listed = useMemo(() => {
    const base = selectedDay ? byDay.get(selectedDay) ?? [] : sessions;
    return [...base].sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());
  }, [selectedDay, byDay, sessions]);

  const shiftMonth = (delta: number) => {
    setSelectedDay(null);
    setMonth((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1));
  };

  const todayKey = dayKey(new Date());
  const monthEmpty = !loading && sessions.length === 0;

  const removeFromList = (id: string) => setSessions((prev) => prev.filter((s) => s.id !== id));

  return (
    <div className="stack">
      <SectionTabs tabs={PROGRESS_TABS} label="Progress section" />
      <PageHeader
        eyebrow="Training history"
        title="Your training calendar"
        subtitle="Every logged session, mapped to the day you trained. Tap a day to focus it, or open a session for the full set-by-set breakdown."
      />

      {error && <InlineNotice tone="danger">{error}</InlineNotice>}

      <div className="history-layout">
        <Card className="history-calendar">
          <div className="cal-head">
            <button className="cal-nav" onClick={() => shiftMonth(-1)} aria-label="Previous month">
              ‹
            </button>
            <div className="cal-title">
              <strong>{MONTHS[month.getMonth()]}</strong>
              <span>{month.getFullYear()}</span>
            </div>
            <button className="cal-nav" onClick={() => shiftMonth(1)} aria-label="Next month">
              ›
            </button>
          </div>

          <div className="cal-weekdays">
            {WEEKDAYS.map((w) => (
              <span key={w}>{w}</span>
            ))}
          </div>

          <div className="cal-grid">
            {grid.flat().map((d, i) => {
              if (!d) return <span key={`pad-${i}`} className="cal-cell cal-pad" aria-hidden />;
              const key = dayKey(d);
              const count = byDay.get(key)?.length ?? 0;
              const isSelected = selectedDay === key;
              const isToday = key === todayKey;
              return (
                <button
                  key={key}
                  className={`cal-cell${count ? " has-sessions" : ""}${isSelected ? " selected" : ""}${isToday ? " today" : ""}`}
                  onClick={() => setSelectedDay(isSelected ? null : count ? key : null)}
                  aria-pressed={isSelected}
                  aria-label={`${shortDate(d.toISOString())}${count ? `, ${count} session${count === 1 ? "" : "s"}` : ", no sessions"}`}
                  disabled={!count}
                >
                  <span className="cal-num">{d.getDate()}</span>
                  {count > 0 && (
                    <span className="cal-dot" aria-hidden>
                      {count > 1 ? count : ""}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {selectedDay && (
            <button className="cal-clear" onClick={() => setSelectedDay(null)}>
              Show the whole month
            </button>
          )}
        </Card>

        <div className="history-main">
          <div className="section-title">
            <h2>
              {selectedDay
                ? `${listed.length} session${listed.length === 1 ? "" : "s"} on this day`
                : `${sessions.length} session${sessions.length === 1 ? "" : "s"} this month`}
            </h2>
          </div>

          {loading ? (
            <Spinner label="Loading your sessions…" />
          ) : monthEmpty ? (
            <Card className="history-empty">
              <EmptyState name="history" />
              <div className="history-empty-text">
                <strong>Nothing on the board for {MONTHS[month.getMonth()]} yet</strong>
                <p>Every session you finish lands here, mapped to the day you trained. One workout is all it takes to get this month moving.</p>
                <LinkButton href="/train">Start a session</LinkButton>
              </div>
            </Card>
          ) : listed.length === 0 ? (
            <Card>
              <p className="history-hint">No sessions on this day. Pick another, or show the whole month.</p>
            </Card>
          ) : (
            <div className="history-list-v">
              {listed.map((s) => (
                <SessionRow key={s.id} session={s} onOpen={() => setOpenId(s.id)} />
              ))}
            </div>
          )}
        </div>
      </div>

      {openId && (
        <SessionDrawer
          sessionId={openId}
          units={units}
          onClose={() => setOpenId(null)}
          onDeleted={(id) => {
            removeFromList(id);
            setOpenId(null);
          }}
        />
      )}
    </div>
  );
}

function SessionRow({ session, onOpen }: { session: DbSession; onOpen: () => void }) {
  return (
    <button className="history-row" onClick={onOpen}>
      <div className="history-row-main">
        <strong>{session.title || "Training session"}</strong>
        <small>{relativeDate(session.started_at)}</small>
      </div>
      <div className="history-row-stats">
        <span>{session.total_sets} sets</span>
        <span>{session.total_reps} reps</span>
        <span>{formatDuration(session.active_seconds)}</span>
        {session.avg_form_score != null && <span className="stat-form">{Math.round(session.avg_form_score)}% form</span>}
      </div>
      <span className="history-row-chevron" aria-hidden>
        ›
      </span>
    </button>
  );
}

type ExGroup = { slug: string; name: string; sets: DbSessionSet[] };

/** Best-effort movement glyph category for an exercise slug ("conditioning" fallback). */
function groupGlyph(slug: string): string {
  const meta = getMeta(slug);
  return meta ? glyphCategory(meta) : "conditioning";
}

function SessionDrawer({
  sessionId,
  units,
  onClose,
  onDeleted,
}: {
  sessionId: string;
  units: Units;
  onClose: () => void;
  onDeleted: (id: string) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<DbSession | null>(null);
  const [sets, setSets] = useState<DbSessionSet[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getSessionDetail(sessionId)
      .then(({ session: s, sets: st }) => {
        if (!active) return;
        setSession(s);
        setSets(st);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Could not load this session.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [sessionId]);

  const groups = useMemo<ExGroup[]>(() => {
    const map = new Map<string, ExGroup>();
    for (const st of sets) {
      const g = map.get(st.exercise_slug);
      if (g) g.sets.push(st);
      else map.set(st.exercise_slug, { slug: st.exercise_slug, name: getMeta(st.exercise_slug)?.name ?? st.exercise_slug, sets: [st] });
    }
    for (const g of map.values()) g.sets.sort((a, b) => a.set_index - b.set_index);
    return [...map.values()];
  }, [sets]);

  // Optimistic weight edit → supabase update. Reverts on failure.
  const saveWeight = useCallback(
    async (setId: string, weight: number | null, isBodyweight: boolean) => {
      setSaveError(null);
      const prev = sets;
      setSets((cur) => cur.map((s) => (s.id === setId ? { ...s, weight, is_bodyweight: isBodyweight } : s)));
      if (!supabase) {
        setSaveError("Editing needs a connection — changes weren't saved.");
        setSets(prev);
        return;
      }
      const { error: upErr } = await supabase
        .from("session_sets")
        .update({ weight, is_bodyweight: isBodyweight })
        .eq("id", setId);
      if (upErr) {
        setSaveError("That weight couldn't be saved. Please try again.");
        setSets(prev);
      }
    },
    [sets],
  );

  const doDelete = useCallback(async () => {
    if (!supabase) {
      setSaveError("Deleting needs a connection.");
      return;
    }
    setDeleting(true);
    const { error: delErr } = await supabase.from("sessions").delete().eq("id", sessionId);
    if (delErr) {
      setSaveError("This session couldn't be deleted. Please try again.");
      setDeleting(false);
      return;
    }
    onDeleted(sessionId);
  }, [sessionId, onDeleted]);

  return (
    <div className="drawer-overlay" role="dialog" aria-modal="true" aria-label="Session detail" onClick={onClose}>
      <motion.div
        className="drawer"
        initial={{ x: 40, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="drawer-head">
          <div className="drawer-head-main">
            <h2>{session?.title || "Training session"}</h2>
            {session && (
              <p className="drawer-meta">
                <span>{shortDate(session.started_at)}</span>
                <span className="drawer-meta-sep" aria-hidden>
                  ·
                </span>
                <span>{formatDuration(session.active_seconds)}</span>
                <span className="drawer-meta-sep" aria-hidden>
                  ·
                </span>
                <span>{session.total_sets} sets</span>
                <span className="drawer-meta-sep" aria-hidden>
                  ·
                </span>
                <span>{session.total_reps} reps</span>
                {session.avg_form_score != null && (
                  <>
                    <span className="drawer-meta-sep" aria-hidden>
                      ·
                    </span>
                    <span className="drawer-meta-form">{Math.round(session.avg_form_score)}% form</span>
                  </>
                )}
              </p>
            )}
          </div>
          <button className="drawer-close btn btn-ghost btn-sm" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {loading ? (
          <Spinner label="Loading session…" />
        ) : error ? (
          <InlineNotice tone="danger">{error}</InlineNotice>
        ) : (
          <>
            {saveError && <InlineNotice tone="warn">{saveError}</InlineNotice>}

            <div className="drawer-groups">
              {groups.map((g) => (
                <div key={g.slug} className="drawer-group">
                  <div className="drawer-group-head">
                    <MovementGlyph category={groupGlyph(g.slug)} />
                    <strong>{g.name}</strong>
                    <small>{g.sets.length} set{g.sets.length === 1 ? "" : "s"}</small>
                  </div>
                  <div className="drawer-table" role="table">
                    <div className="drawer-trow drawer-thead" role="row">
                      <span>Set</span>
                      <span>Work</span>
                      <span>Weight</span>
                      <span>TUT</span>
                      <span>Form</span>
                    </div>
                    {g.sets.map((st, i) => (
                      <SetRow key={st.id} set={st} index={i} units={units} onSave={saveWeight} />
                    ))}
                  </div>
                </div>
              ))}
              {groups.length === 0 && <p className="history-hint">No sets were recorded for this session.</p>}
            </div>

            {session?.notes && (
              <div className="drawer-notes">
                <small>Notes</small>
                <p>{session.notes}</p>
              </div>
            )}

            <div className="drawer-actions">
              <LinkButton href={`/coach?session=${sessionId}`} variant="secondary" size="sm">
                Ask coach about this session
              </LinkButton>
              {confirmDelete ? (
                <div className="drawer-confirm">
                  <span>Delete this session for good?</span>
                  <Button variant="danger" size="sm" onClick={doDelete} disabled={deleting}>
                    {deleting ? "Deleting…" : "Yes, delete"}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)} disabled={deleting}>
                    Keep it
                  </Button>
                </div>
              ) : (
                <Button variant="ghost" size="sm" className="drawer-delete" onClick={() => setConfirmDelete(true)}>
                  Delete session
                </Button>
              )}
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}

function SetRow({
  set,
  index,
  units,
  onSave,
}: {
  set: DbSessionSet;
  index: number;
  units: Units;
  onSave: (setId: string, weight: number | null, isBodyweight: boolean) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>(set.weight != null ? String(set.weight) : "");
  const [bw, setBw] = useState(set.is_bodyweight);

  const work =
    set.reps != null ? `${set.reps} reps` : set.seconds != null ? formatClock(set.seconds) : "—";
  const unitLabel = set.weight_unit || units;

  const commit = () => {
    const parsed = draft.trim() === "" ? null : Number(draft);
    const weight = parsed != null && Number.isFinite(parsed) ? parsed : null;
    const isBodyweight = bw || weight == null;
    onSave(set.id, isBodyweight ? null : weight, isBodyweight);
    setEditing(false);
  };

  return (
    <div className="drawer-trow" role="row">
      <span className="set-idx">{index + 1}</span>
      <span>{work}</span>
      <span className="set-weight">
        {editing ? (
          <span className="set-weight-edit">
            <input
              type="number"
              inputMode="decimal"
              className="set-weight-input"
              value={bw ? "" : draft}
              placeholder={bw ? "BW" : "0"}
              disabled={bw}
              onChange={(e) => setDraft(e.target.value)}
              aria-label={`Weight for set ${index + 1}`}
            />
            <label className="set-bw-toggle">
              <input type="checkbox" checked={bw} onChange={(e) => setBw(e.target.checked)} />
              BW
            </label>
            <button className="set-save" onClick={commit} aria-label="Save weight">
              ✓
            </button>
          </span>
        ) : (
          <button
            className="set-weight-btn"
            onClick={() => {
              setDraft(set.weight != null ? String(set.weight) : "");
              setBw(set.is_bodyweight);
              setEditing(true);
            }}
            aria-label={`Edit weight for set ${index + 1}`}
          >
            {set.is_bodyweight || set.weight == null ? "BW" : `${set.weight} ${unitLabel}`}
            <em aria-hidden>✎</em>
          </button>
        )}
      </span>
      <span>{set.tut_seconds != null ? `${Math.round(set.tut_seconds)}s` : "—"}</span>
      <span>{set.avg_form_score != null ? `${Math.round(set.avg_form_score)}%` : "—"}</span>
    </div>
  );
}

export default function HistoryPage() {
  return (
    <Suspense fallback={<Spinner label="Loading history…" />}>
      <HistoryInner />
    </Suspense>
  );
}
