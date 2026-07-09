"use client";

// /social — Community: find athletes, send/accept friend requests, and view
// friend profiles (Spotify-style). Friendships are mutual once accepted.
// Discoverability is opt-in (profiles.is_public); private profiles never
// appear in search. Everything is RLS-scoped client-side data access.

import { useEffect, useMemo, useState } from "react";
import {
  PageHeader,
  Card,
  Button,
  Spinner,
  InlineNotice,
  SectionTitle,
} from "../../components/ui/primitives";
import { getProfile } from "../../lib/db";
import { getMeta } from "../../lib/library";
import {
  loadSocialGraph,
  searchAthletes,
  sendFriendRequest,
  acceptFriendRequest,
  removeFriendship,
  setDiscoverable,
  listPublicTemplatesOf,
  saveSharedTemplate,
  getFriendStats,
  listChallenges,
  createChallenge,
  joinChallenge,
  leaveChallenge,
  deleteChallenge,
  getScoreboard,
  type SocialGraph,
  type FriendEntry,
  type ChallengeEntry,
  type ChallengeMetric,
  type DbChallenge,
  type ScoreRow,
  type FriendStats,
  type SharedTemplateSummary,
} from "../../lib/social";
import type { DbProfile } from "../../lib/types";
import "./social.css";

type Notice = { tone: "info" | "warn" | "danger"; text: string } | null;

/** Minimal shape Avatar needs — satisfied by both DbProfile and ScoreRow. */
type AvatarSource = {
  avatar_url?: string | null;
  display_name?: string | null;
  username?: string | null;
} | null;

function Avatar({ profile, size = 44 }: { profile: AvatarSource; size?: number }) {
  const url = profile?.avatar_url;
  if (url?.startsWith("preset:")) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img className="soc-avatar" style={{ width: size, height: size }} src={`/avatars/${url.slice(7)}.svg`} alt="" />
    );
  }
  const initial = profile?.display_name?.trim()?.[0] ?? profile?.username?.trim()?.[0] ?? "•";
  return (
    <span className="soc-avatar soc-avatar-fallback" style={{ width: size, height: size }} aria-hidden>
      {initial.toUpperCase()}
    </span>
  );
}

function nameOf(p: DbProfile | null): string {
  return p?.display_name?.trim() || (p?.username ? `@${p.username}` : "Private athlete");
}

function sinceLabel(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

/** Which entry of a friendship row is the OTHER athlete. */
function otherIdOf(e: FriendEntry): string {
  return e.outgoing ? e.friendship.friend_id : e.friendship.user_id;
}

type SocialView = "friends" | "competitions";

export default function SocialPage() {
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<Notice>(null);
  const [graph, setGraph] = useState<SocialGraph>({ friends: [], incoming: [], outgoing: [] });
  const [discoverable, setDiscoverableState] = useState<boolean | null>(null);
  const [hasUsername, setHasUsername] = useState(true);
  const [view, setView] = useState<SocialView>("friends");

  // Glanceable per-friend stats for the friends grid (privacy-safe RPC).
  const [cardStats, setCardStats] = useState<Map<string, FriendStats>>(new Map());

  // Search state
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DbProfile[] | null>(null);
  const [searching, setSearching] = useState(false);

  // Profile detail view
  const [viewing, setViewing] = useState<FriendEntry | null>(null);

  async function refresh() {
    try {
      const [g, prof] = await Promise.all([loadSocialGraph(), getProfile().catch(() => null)]);
      setGraph(g);
      const p = prof as { is_public?: boolean; username?: string | null } | null;
      setDiscoverableState(Boolean(p?.is_public));
      setHasUsername(Boolean(p?.username));
      // Core stats for every friend card, fetched in parallel; failures just
      // leave that card without the stat line.
      const ids = g.friends.map(otherIdOf);
      const stats = await Promise.all(ids.map((id) => getFriendStats(id).catch(() => null)));
      const map = new Map<string, FriendStats>();
      ids.forEach((id, i) => {
        if (stats[i]) map.set(id, stats[i] as FriendStats);
      });
      setCardStats(map);
    } catch (err) {
      setNotice({ tone: "danger", text: err instanceof Error ? err.message : "Could not load your community." });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  // Debounced search-as-you-type.
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults(null);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        setResults(await searchAthletes(q));
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [query]);

  /** Search result → relationship state, so the button reads right. */
  const relationOf = useMemo(() => {
    const map = new Map<string, "friends" | "incoming" | "outgoing">();
    for (const e of graph.friends) map.set(e.profile?.id ?? otherId(e), "friends");
    for (const e of graph.incoming) map.set(e.profile?.id ?? otherId(e), "incoming");
    for (const e of graph.outgoing) map.set(e.profile?.id ?? otherId(e), "outgoing");
    return map;
    function otherId(e: FriendEntry) {
      return e.outgoing ? e.friendship.friend_id : e.friendship.user_id;
    }
  }, [graph]);

  async function handleAdd(p: DbProfile) {
    setNotice(null);
    try {
      await sendFriendRequest(p.id);
      setNotice({ tone: "info", text: `Request sent to ${nameOf(p)}.` });
      await refresh();
    } catch (err) {
      setNotice({ tone: "danger", text: err instanceof Error ? err.message : "Could not send the request." });
    }
  }

  async function handleAccept(e: FriendEntry) {
    setNotice(null);
    try {
      await acceptFriendRequest(e.friendship.id);
      setNotice({ tone: "info", text: `You and ${nameOf(e.profile)} are now friends.` });
      await refresh();
    } catch (err) {
      setNotice({ tone: "danger", text: err instanceof Error ? err.message : "Could not accept the request." });
    }
  }

  async function handleRemove(e: FriendEntry, verb: string) {
    setNotice(null);
    try {
      await removeFriendship(e.friendship.id);
      setNotice({ tone: "info", text: `${verb}.` });
      setViewing(null);
      await refresh();
    } catch (err) {
      setNotice({ tone: "danger", text: err instanceof Error ? err.message : "Something went wrong." });
    }
  }

  async function toggleDiscoverable() {
    if (discoverable === null) return;
    const next = !discoverable;
    setDiscoverableState(next);
    try {
      await setDiscoverable(next);
    } catch {
      setDiscoverableState(!next);
      setNotice({ tone: "danger", text: "Could not update your visibility." });
    }
  }

  if (loading) return <Spinner label="Loading your community…" />;

  if (viewing) {
    return <FriendProfile entry={viewing} onBack={() => setViewing(null)} onUnfriend={() => handleRemove(viewing, "Removed from your friends")} />;
  }

  const pendingCount = graph.incoming.length;

  return (
    <div className="stack">
      <PageHeader
        eyebrow="Community"
        title="Train with your people."
        subtitle="Friends, shared workouts, and week-long competitions."
      />

      {/* Two clear spaces instead of one long scroll: your people, and the
          competitions between them. Works as wrapping pills on mobile. */}
      <div className="soc-tabs" role="tablist" aria-label="Community sections">
        <button
          type="button"
          role="tab"
          aria-selected={view === "friends"}
          className={`soc-tab${view === "friends" ? " active" : ""}`}
          onClick={() => setView("friends")}
        >
          Friends{graph.friends.length > 0 ? ` · ${graph.friends.length}` : ""}
          {pendingCount > 0 && <span className="soc-tab-badge">{pendingCount}</span>}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === "competitions"}
          className={`soc-tab${view === "competitions" ? " active" : ""}`}
          onClick={() => setView("competitions")}
        >
          Competitions
        </button>
      </div>

      {notice && <InlineNotice tone={notice.tone}>{notice.text}</InlineNotice>}

      {view === "competitions" ? (
        <Competitions hasFriends={graph.friends.length > 0} onNotice={setNotice} />
      ) : (
        <>
          {graph.incoming.length > 0 && (
            <section>
              <SectionTitle>Requests</SectionTitle>
              <div className="soc-list">
                {graph.incoming.map((e) => (
                  <Card key={e.friendship.id} className="soc-row">
                    <Avatar profile={e.profile} />
                    <div className="soc-row-text">
                      <strong>{nameOf(e.profile)}</strong>
                      <small>wants to be friends</small>
                    </div>
                    <div className="row-wrap">
                      <Button size="sm" onClick={() => handleAccept(e)}>
                        Accept
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleRemove(e, "Request declined")}>
                        Decline
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          )}

          <section>
            <SectionTitle>
              Friends{graph.friends.length > 0 ? ` · ${graph.friends.length}` : ""}
            </SectionTitle>
            {graph.friends.length === 0 ? (
              <Card className="soc-empty-card">
                <p>No friends yet. Search below — or share your username so people can find you.</p>
              </Card>
            ) : (
              <div className="soc-grid">
                {graph.friends.map((e) => {
                  const s = cardStats.get(otherIdOf(e));
                  return (
                    <button key={e.friendship.id} type="button" className="soc-friend-card" onClick={() => setViewing(e)}>
                      <Avatar profile={e.profile} size={56} />
                      <strong>{nameOf(e.profile)}</strong>
                      {e.profile?.username && <small>@{e.profile.username}</small>}
                      {s ? (
                        s.last_trained_at ? (
                          <span className="soc-friend-stats">
                            <em>{s.sessions_7d}</em> this week · <em>{s.reps_28d.toLocaleString()}</em> reps · trained{" "}
                            {agoLabel(s.last_trained_at)}
                          </span>
                        ) : (
                          <span className="soc-friend-stats">No workouts logged yet</span>
                        )
                      ) : (
                        <span className="soc-friend-since">Friends since {sinceLabel(e.friendship.created_at)}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <section>
            <SectionTitle>Find athletes</SectionTitle>
            <input
              className="soc-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by username or name…"
              aria-label="Search athletes"
            />
            {searching && <Spinner label="Searching…" />}
            {results !== null && !searching && (
              <div className="soc-list">
                {results.length === 0 ? (
                  <p className="soc-empty">No discoverable athletes match “{query.trim()}”.</p>
                ) : (
                  results.map((p) => {
                    const rel = relationOf.get(p.id);
                    return (
                      <Card key={p.id} className="soc-row">
                        <Avatar profile={p} />
                        <div className="soc-row-text">
                          <strong>{nameOf(p)}</strong>
                          {p.username && p.display_name && <small>@{p.username}</small>}
                        </div>
                        {rel === "friends" ? (
                          <span className="soc-tag">Friends</span>
                        ) : rel === "outgoing" ? (
                          <span className="soc-tag">Requested</span>
                        ) : rel === "incoming" ? (
                          <span className="soc-tag">Wants to connect</span>
                        ) : (
                          <Button size="sm" onClick={() => handleAdd(p)}>
                            Add friend
                          </Button>
                        )}
                      </Card>
                    );
                  })
                )}
              </div>
            )}
          </section>

          {graph.outgoing.length > 0 && (
            <section>
              <SectionTitle>Sent</SectionTitle>
              <div className="soc-list">
                {graph.outgoing.map((e) => (
                  <Card key={e.friendship.id} className="soc-row">
                    <Avatar profile={e.profile} />
                    <div className="soc-row-text">
                      <strong>{nameOf(e.profile)}</strong>
                      <small>request pending</small>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => handleRemove(e, "Request cancelled")}>
                      Cancel
                    </Button>
                  </Card>
                ))}
              </div>
            </section>
          )}

          <Card className="soc-visibility">
            <div className="setting-label">
              <strong>Discoverable</strong>
              <small>
                {discoverable
                  ? "Other athletes can find you by your username or name."
                  : "You're hidden from search. Turn this on so friends can find you."}
                {!hasUsername && " Tip: set a username in Settings so you're easy to find."}
              </small>
            </div>
            <button
              type="button"
              className={`toggle${discoverable ? " on" : ""}`}
              role="switch"
              aria-checked={Boolean(discoverable)}
              aria-label="Discoverable"
              onClick={toggleDiscoverable}
            >
              <span />
            </button>
          </Card>
        </>
      )}
    </div>
  );
}

/** "3 days ago" style label for the last-trained stamp. */
function agoLabel(iso: string | null): string {
  if (!iso) return "—";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 28) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** A friend's profile: identity, privacy-safe training stats, shared workouts. */
function FriendProfile({
  entry,
  onBack,
  onUnfriend,
}: {
  entry: FriendEntry;
  onBack: () => void;
  onUnfriend: () => void;
}) {
  const p = entry.profile;
  const [workouts, setWorkouts] = useState<SharedTemplateSummary[] | null>(null);
  const [stats, setStats] = useState<FriendStats | null | "loading">("loading");
  const [confirming, setConfirming] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState<Notice>(null);
  const otherId = entry.outgoing ? entry.friendship.friend_id : entry.friendship.user_id;

  async function handleSave(templateId: string) {
    setSavingId(templateId);
    setNotice(null);
    try {
      await saveSharedTemplate(templateId);
      setSavedIds((s) => new Set(s).add(templateId));
      setNotice({ tone: "info", text: "Saved — find it in Workouts under “Saved from friends”." });
    } catch (err) {
      setNotice({ tone: "danger", text: err instanceof Error ? err.message : "Could not save that workout." });
    } finally {
      setSavingId(null);
    }
  }

  useEffect(() => {
    let active = true;
    listPublicTemplatesOf(otherId)
      .then((w) => active && setWorkouts(w))
      .catch(() => active && setWorkouts([]));
    getFriendStats(otherId)
      .then((s) => active && setStats(s))
      .catch(() => active && setStats(null));
    return () => {
      active = false;
    };
  }, [otherId]);

  const topExercises =
    stats && stats !== "loading"
      ? stats.top_exercises.map((t) => getMeta(t.slug)?.name ?? t.slug.replace(/_/g, " "))
      : [];

  return (
    <div className="stack">
      <PageHeader
        eyebrow="Community"
        title={nameOf(p)}
        subtitle={p?.username ? `@${p.username}` : undefined}
        actions={
          <Button variant="ghost" onClick={onBack}>
            ← All friends
          </Button>
        }
      />

      <Card className="soc-profile-head">
        <Avatar profile={p} size={72} />
        <div className="soc-profile-facts">
          {p?.goal && (
            <div>
              <small>Goal</small>
              <strong>{p.goal}</strong>
            </div>
          )}
          {p?.experience_level && (
            <div>
              <small>Level</small>
              <strong>{p.experience_level[0].toUpperCase() + p.experience_level.slice(1)}</strong>
            </div>
          )}
          <div>
            <small>Friends since</small>
            <strong>{sinceLabel(entry.friendship.created_at)}</strong>
          </div>
        </div>
      </Card>

      {notice && <InlineNotice tone={notice.tone}>{notice.text}</InlineNotice>}

      <section>
        <SectionTitle>Training</SectionTitle>
        {stats === "loading" ? (
          <Spinner label="Loading stats…" />
        ) : stats === null ? (
          <Card className="soc-empty-card">
            <p>Training stats aren&apos;t available right now.</p>
          </Card>
        ) : (
          <>
            <div className="soc-stat-grid">
              <Card className="soc-stat">
                <small>This week</small>
                <strong>{stats.sessions_7d}</strong>
                <span>session{stats.sessions_7d === 1 ? "" : "s"}</span>
              </Card>
              <Card className="soc-stat">
                <small>Last 4 weeks</small>
                <strong>{stats.active_days_28d}</strong>
                <span>active days</span>
              </Card>
              <Card className="soc-stat">
                <small>Reps · 4 weeks</small>
                <strong>{stats.reps_28d.toLocaleString()}</strong>
                <span>counted</span>
              </Card>
              <Card className="soc-stat">
                <small>Time · 4 weeks</small>
                <strong>{stats.minutes_28d}</strong>
                <span>minutes</span>
              </Card>
              <Card className="soc-stat">
                <small>All time</small>
                <strong>{stats.total_sessions}</strong>
                <span>workouts</span>
              </Card>
              <Card className="soc-stat">
                <small>Last trained</small>
                <strong>{agoLabel(stats.last_trained_at)}</strong>
                <span>{stats.last_trained_at ? "keep them honest" : "no sessions yet"}</span>
              </Card>
            </div>
            {topExercises.length > 0 && (
              <p className="soc-top-moves">
                <span>Favorite moves lately:</span> {topExercises.join(" · ")}
              </p>
            )}
          </>
        )}
      </section>

      <section>
        <SectionTitle>Shared workouts</SectionTitle>
        {workouts === null ? (
          <Spinner label="Loading workouts…" />
        ) : workouts.length === 0 ? (
          <Card className="soc-empty-card">
            <p>{nameOf(p)} hasn&apos;t shared any workouts yet.</p>
          </Card>
        ) : (
          <div className="soc-list">
            {workouts.map((w) => (
              <Card key={w.id} className="soc-row">
                <div className="soc-row-text">
                  <strong>{w.title}</strong>
                  <small>
                    {w.exercise_count} exercise{w.exercise_count === 1 ? "" : "s"}
                    {w.est_duration_min ? ` · ~${w.est_duration_min} min` : ""}
                    {w.description ? ` · ${w.description}` : ""}
                  </small>
                </div>
                {savedIds.has(w.id) ? (
                  <span className="soc-tag">Saved ✓</span>
                ) : (
                  <Button size="sm" variant="secondary" disabled={savingId === w.id} onClick={() => handleSave(w.id)}>
                    {savingId === w.id ? "Saving…" : "Save to my workouts"}
                  </Button>
                )}
              </Card>
            ))}
          </div>
        )}
      </section>

      <Card className="soc-unfriend">
        {confirming ? (
          <div className="row-wrap" style={{ alignItems: "center", gap: 10 }}>
            <span>Remove {nameOf(p)} from your friends?</span>
            <Button size="sm" variant="danger" onClick={onUnfriend}>
              Remove
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
              Keep
            </Button>
          </div>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => setConfirming(true)}>
            Remove friend
          </Button>
        )}
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Competitions — week-long friendly contests between friends.
// ---------------------------------------------------------------------------

const METRIC_OPTIONS: { key: ChallengeMetric; label: string; hint: string }[] = [
  { key: "sessions", label: "Sessions", hint: "Most workouts finished." },
  { key: "total_reps", label: "Total reps", hint: "Every counted rep adds up." },
  { key: "total_sets", label: "Total sets", hint: "Sets completed, any workout." },
  { key: "active_minutes", label: "Active minutes", hint: "Time spent actually training." },
];

function metricLabel(metric: ChallengeMetric): string {
  return METRIC_OPTIONS.find((o) => o.key === metric)?.label ?? metric;
}

function metricValueOf(row: ScoreRow, metric: ChallengeMetric): number {
  return metric === "sessions"
    ? row.sessions
    : metric === "total_reps"
      ? row.total_reps
      : metric === "total_sets"
        ? row.total_sets
        : row.active_minutes;
}

function formatMetricValue(value: number, metric: ChallengeMetric): string {
  const n = Math.round(Number(value));
  return metric === "active_minutes" ? `${n} min` : String(n);
}

/**
 * Combined standing across the challenge's metrics: each metric contributes
 * your value as a fraction of the current leader's, so every metric carries
 * equal weight regardless of scale (10 sessions vs 2,000 reps).
 */
function rankScoreboard(rows: ScoreRow[], metrics: ChallengeMetric[]): { row: ScoreRow; score: number }[] {
  const maxima = metrics.map((m) => Math.max(...rows.map((r) => metricValueOf(r, m)), 0));
  return rows
    .map((row) => ({
      row,
      score: metrics.reduce((sum, m, i) => sum + (maxima[i] > 0 ? metricValueOf(row, m) / maxima[i] : 0), 0),
    }))
    .sort((a, b) => b.score - a.score);
}

type ChallengePhase = "live" | "upcoming" | "recent" | "old";

function phaseOf(c: DbChallenge, now: number): ChallengePhase {
  const starts = new Date(c.starts_at).getTime();
  const ends = new Date(c.ends_at).getTime();
  if (now < starts) return "upcoming";
  if (now < ends) return "live";
  if (now - ends <= 7 * 24 * 60 * 60 * 1000) return "recent";
  return "old";
}

/** "ends in 2d 4h" / "starts in 3h 12m" style countdown. */
function untilLabel(iso: string, prefix: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "ended";
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (d > 0) return `${prefix} ${d}d ${h}h`;
  if (h > 0) return `${prefix} ${h}h ${m}m`;
  return `${prefix} ${Math.max(1, m)}m`;
}

function endedAgoLabel(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return "finished today";
  return days === 1 ? "finished yesterday" : `finished ${days}d ago`;
}

function Crown() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" className="soc-crown" role="img" aria-label="Leader">
      <path fill="currentColor" d="M1 5l3.2 2.6L8 3l3.8 4.6L15 5l-1.6 7H2.6L1 5z" />
    </svg>
  );
}

function Leaderboard({ rows, me, metrics }: { rows: ScoreRow[]; me: string; metrics: ChallengeMetric[] }) {
  const ranked = rankScoreboard(rows, metrics);
  const top = ranked[0]?.score ?? 0;
  return (
    <ol className="soc-lb">
      {ranked.map(({ row: r, score }, i) => (
        <li key={r.user_id} className={`soc-lb-row${r.user_id === me ? " is-me" : ""}`}>
          <span className="soc-lb-rank">{i === 0 ? <Crown /> : i + 1}</span>
          <Avatar profile={r} size={32} />
          <div className="soc-lb-main">
            <span className="soc-lb-name">
              {r.display_name?.trim() || (r.username ? `@${r.username}` : "Athlete")}
              {r.user_id === me ? " (you)" : ""}
            </span>
            <span className="soc-lb-bar">
              <span style={{ width: `${top > 0 ? Math.max(4, (score / top) * 100) : 4}%` }} />
            </span>
            <span className="soc-lb-metrics">
              {metrics.map((m) => (
                <em key={m}>
                  {formatMetricValue(metricValueOf(r, m), m)}
                  <i> {metricLabel(m).toLowerCase()}</i>
                </em>
              ))}
            </span>
          </div>
        </li>
      ))}
    </ol>
  );
}

function Competitions({ hasFriends, onNotice }: { hasFriends: boolean; onNotice: (n: Notice) => void }) {
  const [data, setData] = useState<{ me: string; challenges: ChallengeEntry[] } | null>(null);
  const [boards, setBoards] = useState<Map<string, ScoreRow[]>>(new Map());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Create form
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("Push Week");
  const [metrics, setMetrics] = useState<ChallengeMetric[]>(["sessions"]);
  const [days, setDays] = useState<3 | 5 | 7>(7);
  const [submitting, setSubmitting] = useState(false);

  function toggleMetric(m: ChallengeMetric) {
    setMetrics((cur) => {
      if (cur.includes(m)) {
        // Never drop below one metric — a race has to count something.
        return cur.length > 1 ? cur.filter((x) => x !== m) : cur;
      }
      return [...cur, m];
    });
  }

  async function load() {
    try {
      const res = await listChallenges();
      const now = Date.now();
      // Leaderboards only answer participants — fetch just where we're in.
      const boardable = res.challenges.filter((e) => {
        const phase = phaseOf(e.challenge, now);
        return e.joined && (phase === "live" || phase === "recent");
      });
      const results = await Promise.all(
        boardable.map((e) => getScoreboard(e.challenge.id).catch(() => [] as ScoreRow[])),
      );
      const map = new Map<string, ScoreRow[]>();
      boardable.forEach((e, i) => map.set(e.challenge.id, results[i]));
      setBoards(map);
      setData(res);
    } catch (err) {
      onNotice({ tone: "danger", text: err instanceof Error ? err.message : "Could not load competitions." });
      setData({ me: "", challenges: [] });
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function act(id: string, fn: () => Promise<void>, failText: string) {
    setBusyId(id);
    onNotice(null);
    try {
      await fn();
      setConfirmDeleteId(null);
      await load();
    } catch (err) {
      onNotice({ tone: "danger", text: err instanceof Error ? err.message : failText });
    } finally {
      setBusyId(null);
    }
  }

  async function handleCreate() {
    setSubmitting(true);
    onNotice(null);
    try {
      await createChallenge({ name, metrics, days });
      setCreating(false);
      setName("Push Week");
      setMetrics(["sessions"]);
      setDays(7);
      onNotice({ tone: "info", text: "Competition started — it's live now." });
      await load();
    } catch (err) {
      onNotice({ tone: "danger", text: err instanceof Error ? err.message : "Could not start the competition." });
    } finally {
      setSubmitting(false);
    }
  }

  const now = Date.now();
  const entries = data?.challenges ?? [];
  const live = entries.filter((e) => phaseOf(e.challenge, now) === "live");
  const upcoming = entries.filter((e) => phaseOf(e.challenge, now) === "upcoming");
  const recent = entries.filter((e) => phaseOf(e.challenge, now) === "recent");
  const nothingToShow = live.length === 0 && upcoming.length === 0 && recent.length === 0;

  function renderCard(entry: ChallengeEntry, phase: ChallengePhase) {
    const c = entry.challenge;
    const board = boards.get(c.id);
    const showBoard = entry.joined && board !== undefined && board.length > 0;
    // Time progress through a live challenge window.
    const spanMs = new Date(c.ends_at).getTime() - new Date(c.starts_at).getTime();
    const elapsedPct =
      phase === "live" && spanMs > 0
        ? Math.min(100, Math.max(2, ((Date.now() - new Date(c.starts_at).getTime()) / spanMs) * 100))
        : null;
    return (
      <Card key={c.id} className="soc-comp-card">
        <div className="soc-comp-head">
          <div className="soc-comp-title">
            <strong>{c.name}</strong>
            <span className="soc-comp-metric-chips">
              {c.metrics.map((m) => (
                <span key={m} className="soc-comp-metric">
                  {metricLabel(m)}
                </span>
              ))}
            </span>
            <small>
              {phase === "live"
                ? untilLabel(c.ends_at, "ends in")
                : phase === "upcoming"
                  ? untilLabel(c.starts_at, "starts in")
                  : endedAgoLabel(c.ends_at)}
              {" · "}
              {entry.participantCount} {entry.participantCount === 1 ? "athlete" : "athletes"}
            </small>
          </div>
          <div className="soc-comp-actions">
            {phase !== "recent" && !entry.joined && (
              <Button size="sm" disabled={busyId === c.id} onClick={() => act(c.id, () => joinChallenge(c.id), "Could not join.")}>
                Join
              </Button>
            )}
            {phase !== "recent" && entry.joined && !entry.mine && (
              <Button
                size="sm"
                variant="ghost"
                disabled={busyId === c.id}
                onClick={() => act(c.id, () => leaveChallenge(c.id), "Could not leave.")}
              >
                Leave
              </Button>
            )}
            {entry.mine &&
              (confirmDeleteId === c.id ? (
                <>
                  <Button
                    size="sm"
                    variant="danger"
                    disabled={busyId === c.id}
                    onClick={() => act(c.id, () => deleteChallenge(c.id), "Could not delete.")}
                  >
                    Confirm
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirmDeleteId(null)}>
                    Keep
                  </Button>
                </>
              ) : (
                <Button size="sm" variant="ghost" onClick={() => setConfirmDeleteId(c.id)}>
                  Delete
                </Button>
              ))}
          </div>
        </div>
        {elapsedPct !== null && (
          <div className="soc-comp-progress" aria-hidden>
            <span style={{ width: `${elapsedPct}%` }} />
          </div>
        )}
        {phase === "recent" && showBoard && <p className="soc-comp-standings">Final standings</p>}
        {showBoard && data && <Leaderboard rows={board} me={data.me} metrics={c.metrics} />}
        {phase !== "recent" && entry.joined && board !== undefined && board.length <= 1 && (
          <p className="soc-comp-hint">Just you so far — friends can join right from this page.</p>
        )}
      </Card>
    );
  }

  return (
    <section>
      <SectionTitle
        action={
          <Button size="sm" variant="secondary" onClick={() => setCreating((v) => !v)}>
            {creating ? "Close" : "Start a competition"}
          </Button>
        }
      >
        Competitions
      </SectionTitle>

      {creating && (
        <Card className="soc-comp-form">
          <label className="soc-field">
            <span className="soc-field-label">Name</span>
            <input
              className="soc-search"
              value={name}
              maxLength={60}
              onChange={(e) => setName(e.target.value)}
              placeholder="Push Week"
            />
          </label>
          <div className="soc-field">
            <span className="soc-field-label">
              What counts <em className="soc-field-sub">pick 1–4 — standings combine them equally</em>
            </span>
            <div className="soc-metric-grid">
              {METRIC_OPTIONS.map((o) => {
                const selected = metrics.includes(o.key);
                return (
                  <button
                    key={o.key}
                    type="button"
                    className={`soc-metric-option${selected ? " selected" : ""}`}
                    aria-pressed={selected}
                    onClick={() => toggleMetric(o.key)}
                  >
                    <strong>
                      {o.label}
                      {selected && <span className="soc-metric-check" aria-hidden> ✓</span>}
                    </strong>
                    <small>{o.hint}</small>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="soc-field">
            <span className="soc-field-label">Duration</span>
            <div className="row-wrap">
              {([3, 5, 7] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  className={`soc-day-option${days === d ? " selected" : ""}`}
                  onClick={() => setDays(d)}
                >
                  {d} days
                </button>
              ))}
            </div>
            <small className="soc-comp-hint">Starts now, ends on its own.</small>
          </div>
          <div className="row-wrap">
            <Button size="sm" disabled={submitting} onClick={handleCreate}>
              {submitting ? "Starting…" : "Start"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setCreating(false)}>
              Cancel
            </Button>
          </div>
        </Card>
      )}

      {data === null ? (
        <Spinner label="Loading competitions…" />
      ) : nothingToShow ? (
        <Card className="soc-empty-card">
          <p>
            {hasFriends
              ? "No competitions yet. Start one — everyone's training counts automatically for the week."
              : "Competitions run between friends. Find an athlete above and connect first."}
          </p>
        </Card>
      ) : (
        <div className="soc-comp-list">
          {live.length > 0 && (
            <>
              <h3 className="soc-comp-group-label">Live</h3>
              {live.map((e) => renderCard(e, "live"))}
            </>
          )}
          {upcoming.length > 0 && (
            <>
              <h3 className="soc-comp-group-label">Upcoming</h3>
              {upcoming.map((e) => renderCard(e, "upcoming"))}
            </>
          )}
          {recent.length > 0 && (
            <>
              <h3 className="soc-comp-group-label">Recently finished</h3>
              {recent.map((e) => renderCard(e, "recent"))}
            </>
          )}
        </div>
      )}
    </section>
  );
}
