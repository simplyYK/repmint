"use client";

// /hub — the daily training home. Pulls the active plan (today's recommended
// day), recent sessions (streak + habits), and surfaces quick actions. Degrades
// gracefully when there's no data yet or AI isn't configured.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader, Card, LinkButton, Metric, Spinner, Reveal } from "../../components/ui/primitives";
import { getActivePlan, listSessions, listTemplates, getProfile, type ActivePlan, type TemplateWithExercises } from "../../lib/db";
import type { DbSession, DbProfile } from "../../lib/types";
import { computeStreak, relativeDate, formatDuration } from "../../lib/format";
import { athleteImageFor } from "../../lib/athleteImage";
import { estimateTemplateMinutes } from "../../lib/library";
import "./hub.css";

/** Realistic session estimate (shared logic — see lib/library). */
function estimateMinutes(t: TemplateWithExercises): number | null {
  return estimateTemplateMinutes(t);
}

const FIRST_RUN_OPTIONS = [
  {
    title: "In my room",
    sub: "No equipment needed — ready-made bodyweight routines that fit beside your bed.",
  },
  {
    title: "At a gym",
    sub: "Barbell, dumbbell and machine templates you can run straight from your phone.",
  },
  {
    title: "Just exploring",
    sub: "Browse starter workouts and see how the camera coach counts your reps.",
  },
];

export default function HubPage() {
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<ActivePlan | null>(null);
  const [sessions, setSessions] = useState<DbSession[]>([]);
  const [templates, setTemplates] = useState<TemplateWithExercises[]>([]);
  const [profile, setProfile] = useState<DbProfile | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const now = new Date();
        const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const [p, cur, last, tpls, prof] = await Promise.all([
          getActivePlan().catch(() => null),
          listSessions(now).catch(() => []),
          listSessions(prev).catch(() => []),
          listTemplates().catch(() => []),
          getProfile().catch(() => null),
        ]);
        if (!active) return;
        setPlan(p);
        setSessions([...cur, ...last]);
        setTemplates(tpls);
        setProfile((prof as DbProfile) ?? null);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const completed = useMemo(() => sessions.filter((s) => s.status === "completed"), [sessions]);
  const streak = useMemo(() => computeStreak(completed.map((s) => s.started_at)), [completed]);
  const thisWeek = useMemo(() => {
    const weekAgo = Date.now() - 7 * 86400000;
    return completed.filter((s) => new Date(s.started_at).getTime() >= weekAgo).length;
  }, [completed]);
  const trainedToday = useMemo(() => {
    const now = new Date();
    return completed.some((s) => {
      const d = new Date(s.started_at);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
    });
  }, [completed]);
  const recent = completed.slice(0, 4);
  const lastCompleted = completed[0];
  const streakAtRisk = streak > 0 && !trainedToday;

  // Today's recommended day: first non-rest plan day, else most-used template.
  const recommendedDay = plan?.days.find((d) => !d.is_rest && d.template_id);
  const recommendedTemplate =
    (recommendedDay && templates.find((t) => t.id === recommendedDay.template_id)) || templates[0];
  const estMin = recommendedTemplate ? estimateMinutes(recommendedTemplate) : null;

  const displayName = profile?.display_name || "athlete";
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  if (loading) return <Spinner label="Loading your hub…" />;

  const trainHref = recommendedTemplate
    ? `/train?template=${recommendedTemplate.id}${recommendedDay ? `&day=${recommendedDay.id}` : ""}`
    : "/train";

  return (
    <div className="stack">
      <PageHeader eyebrow="Daily training hub" title={`${greet}, ${displayName}.`} subtitle="Here's what your training looks like today." />

      <div className="hub-top">
        <Reveal>
          {recommendedTemplate ? (
            <Card className="hub-hero-card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={athleteImageFor(recommendedTemplate.title, recommendedDay?.focus, recommendedTemplate.description)} alt="" className="hub-hero-img" />
              <div className="hub-hero-scrim" aria-hidden />
              <div className="hub-hero-body">
                <p className="eyebrow">Recommended today</p>
                <h2 className="hub-hero-title">{recommendedTemplate.title}</h2>
                <p className="hub-hero-sub">
                  {recommendedDay?.focus ? `${recommendedDay.focus} · ` : ""}
                  {recommendedTemplate.exercises.length} exercise
                  {recommendedTemplate.exercises.length === 1 ? "" : "s"}
                  {estMin ? ` · ~${estMin} min` : ""}
                </p>
                <div className="row-wrap hub-hero-actions">
                  <LinkButton href={trainHref} size="lg">
                    Start workout{estMin ? ` · ~${estMin} min` : ""}
                  </LinkButton>
                  <LinkButton href={`${trainHref}&short=1`} variant="ghost" className="hub-hero-short">
                    Only have 20 min? Start the short version
                  </LinkButton>
                </div>
              </div>
            </Card>
          ) : (
            <Card className="hub-hero-card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/athletes/home-training.jpg" alt="" className="hub-hero-img" />
              <div className="hub-hero-scrim" aria-hidden />
              <div className="hub-hero-body">
                <p className="eyebrow">Let&apos;s get you set up</p>
                <h2 className="hub-hero-title">Where do you train?</h2>
                <p className="hub-hero-sub">Pick whatever fits today — there&apos;s a ready-made starter workout for each. No blank pages, no setup.</p>
                <div className="hub-firstrun-options">
                  {FIRST_RUN_OPTIONS.map((o) => (
                    <Link key={o.title} href="/workouts" className="hub-firstrun-option">
                      <strong>{o.title}</strong>
                      <span>{o.sub}</span>
                    </Link>
                  ))}
                </div>
              </div>
            </Card>
          )}
        </Reveal>

        <Reveal delay={0.08}>
          <Card className="hub-streak">
            <div className="metric-row-3">
              <div className={`hub-streak-cell${streakAtRisk ? " at-risk" : trainedToday && streak > 0 ? " done" : ""}`}>
                <Metric label="Streak" value={`${streak}`} note={streak === 1 ? "day" : "days"} />
              </div>
              <div className="hub-streak-cell">
                <Metric label="This week" value={`${thisWeek}`} note="sessions" />
              </div>
              <div className="hub-streak-cell">
                <Metric label="Total" value={`${completed.length}`} note="logged" />
              </div>
            </div>
            {streakAtRisk && (
              <div className="hub-streak-guard" role="status">
                <span>
                  Train today to keep your {streak}-day streak{streak === 1 ? "" : " alive"}.
                </span>
                <Link href="/train?quick=15" className="chip chip-warn">
                  Quick 15-min session
                </Link>
              </div>
            )}
            {trainedToday && streak > 0 && (
              <p className="hub-streak-done">
                <span className="hub-streak-done-dot" aria-hidden />
                Done today — your {streak}-day streak is safe.
              </p>
            )}
            {plan && (
              <div className="hub-plan-progress">
                <div className="section-title">
                  <h2>{plan.title}</h2>
                  <Link href="/plan" className="chip chip-accent">
                    View plan
                  </Link>
                </div>
                <p className="hub-today-sub">
                  {plan.weeks} week{plan.weeks === 1 ? "" : "s"} · {plan.days.filter((d) => !d.is_rest).length} training days
                </p>
              </div>
            )}
          </Card>
        </Reveal>
      </div>

      <div className="hub-grid">
        <Reveal delay={0.12}>
          <Card>
            <div className="section-title">
              <h2>Recent sessions</h2>
              <Link href="/history" className="chip">
                All history
              </Link>
            </div>
            {recent.length === 0 ? (
              <p className="hub-today-sub">No sessions yet — your saved training will show up here.</p>
            ) : (
              <div className="hub-recent">
                {recent.map((s) => (
                  <Link key={s.id} href={`/history?session=${s.id}`} className="hub-recent-row">
                    <div>
                      <strong>{s.title || "Training session"}</strong>
                      <small>{relativeDate(s.started_at)}</small>
                    </div>
                    <div className="hub-recent-stats">
                      <span>{s.total_sets} sets</span>
                      <span className="hub-recent-reps">{s.total_reps} reps</span>
                      <span>{formatDuration(s.active_seconds)}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </Reveal>

        <Reveal delay={0.18}>
          <Card>
            <div className="section-title">
              <h2>Quick actions</h2>
            </div>
            <div className="hub-actions">
              <Link href="/train" className="hub-action">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/images/quick-actions/start-workout.svg" alt="" className="hub-action-img" />
                <span className="hub-action-label">Start a workout</span>
                <span className="hub-action-sub">Camera coach</span>
              </Link>
              <Link href="/plan" className="hub-action">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/images/quick-actions/generate-plan.svg" alt="" className="hub-action-img" />
                <span className="hub-action-label">Generate a plan</span>
                <span className="hub-action-sub">AI, goal-based</span>
              </Link>
              {lastCompleted ? (
                <Link
                  href={lastCompleted.template_id ? `/train?template=${lastCompleted.template_id}` : "/train"}
                  className="hub-action"
                >
                  <svg viewBox="0 0 56 56" className="hub-action-img" aria-hidden fill="none">
                    <circle cx="28" cy="28" r="25" stroke="var(--line)" strokeWidth="2" />
                    <path
                      d="M17.5 25a11.5 11.5 0 0 1 20-3.4"
                      stroke="var(--accent-2)"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                    <path d="M38.5 15v7h-7" stroke="var(--accent-2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <path
                      d="M38.5 31a11.5 11.5 0 0 1-20 3.4"
                      stroke="var(--accent)"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                    <path d="M17.5 41v-7h7" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span className="hub-action-label">Repeat last workout</span>
                  <span className="hub-action-sub">
                    {lastCompleted.title || "Training session"} · {relativeDate(lastCompleted.started_at)}
                  </span>
                </Link>
              ) : (
                <Link href="/exercises" className="hub-action">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/images/quick-actions/browse-exercises.svg" alt="" className="hub-action-img" />
                  <span className="hub-action-label">Browse exercises</span>
                  <span className="hub-action-sub">115 movements</span>
                </Link>
              )}
              <Link href="/coach" className="hub-action">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/images/quick-actions/ask-coach.svg" alt="" className="hub-action-img" />
                <span className="hub-action-label">Ask your coach</span>
                <span className="hub-action-sub">Grounded in your data</span>
              </Link>
            </div>
            <Link href="/coach" className="hub-ai-teaser">
              <p className="eyebrow">AI coach</p>
              <strong>Get a recommendation grounded in your recent training.</strong>
              <span className="hub-ai-cta">Open coach →</span>
            </Link>
          </Card>
        </Reveal>
      </div>
    </div>
  );
}
