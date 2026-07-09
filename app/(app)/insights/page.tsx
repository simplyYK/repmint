"use client";

// /insights — a training dashboard built on hand-rolled SVG charts (no chart
// library). It reads the last ~3-4 months of sessions, caps how many session
// details it fetches (to stay light), and pulls per-exercise progress for a
// small fixed set of common lifts. All copy is supportive and practical; the
// form % is presented as a coaching signal, not a precise measurement.

import { useEffect, useMemo, useState } from "react";
import { PageHeader, Card, LinkButton, Spinner, InlineNotice, SectionTitle, SectionTabs } from "../../components/ui/primitives";
import { EmptyState } from "../../components/visuals";
import { listSessions, getSessionDetail, getExerciseProgress, getProfile, type ExerciseProgressPoint } from "../../lib/db";
import { getMeta } from "../../lib/library";
import { convertWeight } from "../../lib/format";
import type { DbSession, DbSessionSet } from "../../lib/types";
import { BarChart, LineChart, Sparkline, Heatmap, type BarDatum, type LinePoint, type HeatCell } from "./charts";
import "./insights.css";

const PROGRESS_TABS = [
  { href: "/history", label: "History" },
  { href: "/insights", label: "Insights" },
];

type Units = "kg" | "lb";

const KEY_SLUGS = ["squat", "bench_press", "deadlift", "overhead_press", "pull_up"];
const MONTHS_BACK = 3; // current month + 3 prior ≈ 12-16 weeks
const DETAIL_CAP = 40; // cap detail fetches to keep the page light
const WEEKS_SHOWN = 12;

/** Monday 00:00 (local) of the week containing `d`, as a timestamp. */
function weekStart(d: Date): number {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (x.getDay() + 6) % 7; // Mon=0
  x.setDate(x.getDate() - dow);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

function weekLabel(ts: number): string {
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

type ProgressBundle = { slug: string; name: string; points: ExerciseProgressPoint[] };

export default function InsightsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [units, setUnits] = useState<Units>("kg");
  const [sessions, setSessions] = useState<DbSession[]>([]);
  const [detailSets, setDetailSets] = useState<DbSessionSet[]>([]);
  const [progress, setProgress] = useState<ProgressBundle[]>([]);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const now = new Date();
        const months = Array.from({ length: MONTHS_BACK + 1 }, (_, i) => new Date(now.getFullYear(), now.getMonth() - i, 1));
        const monthResults = await Promise.all(months.map((m) => listSessions(m).catch(() => [])));
        const merged = monthResults.flat().filter((s) => s.status === "completed");

        const prof = await getProfile().catch(() => null);
        const u = (prof as { units?: Units } | null)?.units;
        if (u && active) setUnits(u);

        // Cap detail fetches: newest sessions first.
        const ordered = [...merged].sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());
        const toFetch = ordered.slice(0, DETAIL_CAP);
        const details = await Promise.all(
          toFetch.map((s) => getSessionDetail(s.id).then((d) => d.sets).catch(() => [] as DbSessionSet[])),
        );

        const prog = await Promise.all(
          KEY_SLUGS.map(async (slug) => {
            const points = await getExerciseProgress(slug).catch(() => [] as ExerciseProgressPoint[]);
            return { slug, name: getMeta(slug)?.name ?? slug, points };
          }),
        );

        if (!active) return;
        setSessions(merged);
        setDetailSets(details.flat());
        setProgress(prog.filter((p) => p.points.length > 0));
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Could not load your insights.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Weekly buckets over the last WEEKS_SHOWN weeks (Mon-anchored).
  const weekBuckets = useMemo(() => {
    const thisWeek = weekStart(new Date());
    const week = 7 * 86400000;
    const starts: number[] = [];
    for (let i = WEEKS_SHOWN - 1; i >= 0; i -= 1) starts.push(thisWeek - i * week);
    return starts;
  }, []);

  // Map session id → its started_at week, for attributing detail sets to weeks.
  const sessionWeek = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of sessions) m.set(s.id, weekStart(new Date(s.started_at)));
    return m;
  }, [sessions]);

  // Weekly load volume (sets × reps × weight, normalized to the user's unit).
  const volumeData = useMemo<BarDatum[]>(() => {
    const byWeek = new Map<number, number>();
    for (const st of detailSets) {
      const wk = sessionWeek.get(st.session_id);
      if (wk == null) continue;
      if (st.is_bodyweight || st.weight == null) continue;
      const reps = st.reps ?? 0;
      const w = convertWeight(st.weight, (st.weight_unit as Units) || units, units);
      byWeek.set(wk, (byWeek.get(wk) ?? 0) + reps * w);
    }
    return weekBuckets.map((ts) => ({ label: weekLabel(ts), value: Math.round(byWeek.get(ts) ?? 0) }));
  }, [detailSets, sessionWeek, weekBuckets, units]);

  // Weekly total reps (includes bodyweight — reps count regardless of load).
  const repsData = useMemo<LinePoint[]>(() => {
    const byWeek = new Map<number, number>();
    for (const s of sessions) {
      const wk = weekStart(new Date(s.started_at));
      byWeek.set(wk, (byWeek.get(wk) ?? 0) + (s.total_reps ?? 0));
    }
    return weekBuckets.map((ts) => ({ label: weekLabel(ts), value: byWeek.get(ts) ?? 0 }));
  }, [sessions, weekBuckets]);

  // Weekly average form score (a coaching signal, session-level).
  const formData = useMemo<LinePoint[]>(() => {
    const acc = new Map<number, { sum: number; n: number }>();
    for (const s of sessions) {
      if (s.avg_form_score == null) continue;
      const wk = weekStart(new Date(s.started_at));
      const cur = acc.get(wk) ?? { sum: 0, n: 0 };
      cur.sum += s.avg_form_score;
      cur.n += 1;
      acc.set(wk, cur);
    }
    return weekBuckets.map((ts) => {
      const c = acc.get(ts);
      return { label: weekLabel(ts), value: c ? Math.round(c.sum / c.n) : null };
    });
  }, [sessions, weekBuckets]);

  // Consistency heatmap: WEEKS_SHOWN columns × 7 rows, level 0-3 by session count.
  const heatWeeks = useMemo<HeatCell[][]>(() => {
    const byDay = new Map<string, number>();
    for (const s of sessions) {
      const d = new Date(s.started_at);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      byDay.set(key, (byDay.get(key) ?? 0) + 1);
    }
    return weekBuckets.map((ts) => {
      const col: HeatCell[] = [];
      for (let r = 0; r < 7; r += 1) {
        const day = new Date(ts + r * 86400000);
        const key = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`;
        const count = byDay.get(key) ?? 0;
        const level = count === 0 ? 0 : count === 1 ? 1 : count === 2 ? 2 : 3;
        const dateLabel = day.toLocaleDateString(undefined, { month: "short", day: "numeric" });
        col.push({ level, label: count ? `${dateLabel}: ${count} session${count === 1 ? "" : "s"}` : `${dateLabel}: rest` });
      }
      return col;
    });
  }, [sessions, weekBuckets]);

  // PRs: heaviest weight (with the reps at that session's peak day) per key lift.
  const prs = useMemo(() => {
    return progress
      .map((p) => {
        let best: ExerciseProgressPoint | null = null;
        for (const pt of p.points) {
          if (pt.max_weight == null) continue;
          if (!best || (best.max_weight ?? 0) < pt.max_weight) best = pt;
        }
        if (!best || best.max_weight == null) return null;
        return {
          slug: p.slug,
          name: p.name,
          weight: Math.round(convertWeight(best.max_weight, "kg", units) * 10) / 10,
          reps: best.total_reps ?? null,
          day: best.day,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x != null);
  }, [progress, units]);

  const loadTrends = useMemo(() => {
    return progress
      .map((p) => {
        const vals = p.points.map((pt) => pt.max_weight).filter((v): v is number => v != null).map((v) => convertWeight(v, "kg", units));
        return { slug: p.slug, name: p.name, values: vals };
      })
      .filter((t) => t.values.length >= 2);
  }, [progress, units]);

  if (loading) return <Spinner label="Crunching your numbers…" />;

  // Not-enough-data state.
  if (sessions.length <= 1) {
    return (
      <div className="stack">
        <SectionTabs tabs={PROGRESS_TABS} label="Progress section" />
        <PageHeader eyebrow="Training insights" title="Your progress, at a glance" />
        {error && <InlineNotice tone="danger">{error}</InlineNotice>}
        <Card className="insights-empty">
          <EmptyState name="insights" />
          <div className="insights-empty-text">
            <strong>A couple more sessions and this lights up</strong>
            <p>
              Insights build from your logged training — weekly volume, reps, consistency and how your key lifts trend
              over time. Log a session or two and check back.
            </p>
            <LinkButton href="/train">Start training</LinkButton>
          </div>
        </Card>
      </div>
    );
  }

  const unitLabel = units;
  const totalSessions = sessions.length;
  const anyVolume = volumeData.some((d) => d.value > 0);

  return (
    <div className="stack">
      <SectionTabs tabs={PROGRESS_TABS} label="Progress section" />
      <PageHeader
        eyebrow="Training insights"
        title="Your progress, at a glance"
        subtitle={`Built from your last ${totalSessions} logged session${totalSessions === 1 ? "" : "s"}. A practical read on volume, consistency and how your lifts are trending.`}
      />

      {error && <InlineNotice tone="danger">{error}</InlineNotice>}

      <div className="insights-grid">
        <Card className="insight-panel">
          <SectionTitle>Weekly load volume</SectionTitle>
          <p className="insight-sub">Sets × reps × weight across each week ({unitLabel}). Bodyweight work shows up in reps instead of load.</p>
          {anyVolume ? (
            <BarChart data={volumeData} valueFormat={(v) => (v >= 1000 ? `${Math.round(v / 100) / 10}k` : String(Math.round(v)))} />
          ) : (
            <p className="insight-hint">Log some weighted sets and your load volume will chart here.</p>
          )}
        </Card>

        <Card className="insight-panel">
          <SectionTitle>Reps per week</SectionTitle>
          <p className="insight-sub">Total reps logged each week — a simple pulse on your training volume.</p>
          <LineChart data={repsData} accent="var(--accent-2)" />
        </Card>

        <Card className="insight-panel insight-wide">
          <SectionTitle>Consistency</SectionTitle>
          <p className="insight-sub">The last {WEEKS_SHOWN} weeks. Each square is a day — brighter means you showed up.</p>
          <div className="heatmap-wrap">
            <Heatmap weeks={heatWeeks} />
            <div className="heat-legend">
              <span>Less</span>
              <i className="rm-heat-l0" />
              <i className="rm-heat-l1" />
              <i className="rm-heat-l2" />
              <i className="rm-heat-l3" />
              <span>More</span>
            </div>
          </div>
        </Card>

        <Card className="insight-panel">
          <SectionTitle>Form score trend</SectionTitle>
          <p className="insight-sub">Average form score per week — a coaching signal from your camera-tracked sets, not a precise measurement.</p>
          {formData.some((d) => d.value != null) ? (
            <LineChart data={formData} accent="var(--accent)" valueFormat={(v) => `${Math.round(v)}%`} />
          ) : (
            <p className="insight-hint">Camera-coached sets will build your form-score trend here.</p>
          )}
        </Card>

        <Card className="insight-panel">
          <SectionTitle>Load trend by lift</SectionTitle>
          <p className="insight-sub">How the top weight on your key lifts is moving over time ({unitLabel}).</p>
          {loadTrends.length > 0 ? (
            <div className="trend-cards">
              {loadTrends.map((t) => (
                <div key={t.slug} className="trend-card">
                  <div className="trend-card-head">
                    <strong>{t.name}</strong>
                    <span>
                      {Math.round(t.values[t.values.length - 1] * 10) / 10} {unitLabel}
                    </span>
                  </div>
                  <Sparkline values={t.values} />
                </div>
              ))}
            </div>
          ) : (
            <p className="insight-hint">Log a few weighted sessions of the big lifts to see their trend.</p>
          )}
        </Card>

        <Card className="insight-panel">
          <SectionTitle>Personal bests</SectionTitle>
          <p className="insight-sub">Your heaviest logged weight on each key lift so far.</p>
          {prs.length > 0 ? (
            <div className="pr-cards">
              {prs.map((pr) => (
                <div key={pr.slug} className="pr-card">
                  <span className="pr-name">{pr.name}</span>
                  <strong className="pr-value">
                    {pr.weight} {unitLabel}
                  </strong>
                  {pr.reps != null && <small className="pr-reps">{pr.reps} reps that day</small>}
                </div>
              ))}
            </div>
          ) : (
            <p className="insight-hint">Weighted personal bests will appear here as you train.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
