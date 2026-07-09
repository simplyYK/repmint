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
import {
  loadSocialGraph,
  searchAthletes,
  sendFriendRequest,
  acceptFriendRequest,
  removeFriendship,
  setDiscoverable,
  listPublicTemplatesOf,
  type SocialGraph,
  type FriendEntry,
} from "../../lib/social";
import type { DbProfile } from "../../lib/types";
import "./social.css";

type Notice = { tone: "info" | "warn" | "danger"; text: string } | null;

function Avatar({ profile, size = 44 }: { profile: DbProfile | null; size?: number }) {
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

export default function SocialPage() {
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<Notice>(null);
  const [graph, setGraph] = useState<SocialGraph>({ friends: [], incoming: [], outgoing: [] });
  const [discoverable, setDiscoverableState] = useState<boolean | null>(null);
  const [hasUsername, setHasUsername] = useState(true);

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

  return (
    <div className="stack">
      <PageHeader
        eyebrow="Community"
        title="Train with your people."
        subtitle="Find friends, see their profiles, and share workouts."
      />

      {notice && <InlineNotice tone={notice.tone}>{notice.text}</InlineNotice>}

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

      <section>
        <SectionTitle>
          Friends{graph.friends.length > 0 ? ` · ${graph.friends.length}` : ""}
        </SectionTitle>
        {graph.friends.length === 0 ? (
          <Card className="soc-empty-card">
            <p>No friends yet. Search above — or share your username so people can find you.</p>
          </Card>
        ) : (
          <div className="soc-grid">
            {graph.friends.map((e) => (
              <button key={e.friendship.id} type="button" className="soc-friend-card" onClick={() => setViewing(e)}>
                <Avatar profile={e.profile} size={56} />
                <strong>{nameOf(e.profile)}</strong>
                {e.profile?.username && <small>@{e.profile.username}</small>}
                <span className="soc-friend-since">Friends since {sinceLabel(e.friendship.created_at)}</span>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/** A friend's profile: identity, training identity, and their public workouts. */
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
  const [workouts, setWorkouts] = useState<{ id: string; title: string; description: string | null }[] | null>(null);
  const [confirming, setConfirming] = useState(false);
  const otherId = entry.outgoing ? entry.friendship.friend_id : entry.friendship.user_id;

  useEffect(() => {
    let active = true;
    listPublicTemplatesOf(otherId)
      .then((w) => active && setWorkouts(w))
      .catch(() => active && setWorkouts([]));
    return () => {
      active = false;
    };
  }, [otherId]);

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
                  {w.description && <small>{w.description}</small>}
                </div>
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
