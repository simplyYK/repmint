"use client";

// /hub — the daily training home. Pulls the active plan (today's recommended
// day), recent sessions (streak + habits), and surfaces quick actions. Degrades
// gracefully when there's no data yet or AI isn't configured.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { PageHeader, Card, LinkButton, Metric, Spinner } from "../../components/ui/primitives";
import { HeroVisual } from "../../components/visuals";
import { getActivePlan, listSessions, listTemplates, getProfile, type ActivePlan, type TemplateWithExercises } from "../../lib/db";
import type { DbSession, DbProfile } from "../../lib/types";
import { computeStreak, relativeDate, formatDuration } from "../../lib/format";

const QUICK_ACTIONS = [
  { href: "/train", img: "/images/quick-actions/start-workout.svg", label: "Start a workout", sub: "Camera coach" },
  { href: "/plan", img: "/images/quick-actions/generate-plan.svg", label: "Generate a plan", sub: "AI, goal-based" },
  { href: "/exercises", img: "/images/quick-actions/browse-exercises.svg", label: "Browse exercises", sub: "115 movements" },
  { href: "/coach", img: "/images/quick-actions/ask-coach.svg", label: "Ask your coach", sub: "Grounded in your data" },
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
  const recent = completed.slice(0, 4);

  // Today's recommended day: first non-rest plan day, else most-used template.
  const recommendedDay = plan?.days.find((d) => !d.is_rest && d.template_id);
  const recommendedTemplate =
    (recommendedDay && templates.find((t) => t.id === recommendedDay.template_id)) || templates[0];

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
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <Card className="hub-today">
            <div className="hub-today-body">
              <p className="eyebrow">Recommended today</p>
              {recommendedTemplate ? (
                <>
                  <h2>{recommendedTemplate.title}</h2>
                  <p className="hub-today-sub">
                    {recommendedDay?.focus ? `${recommendedDay.focus} · ` : ""}
                    {recommendedTemplate.exercises.length} exercise
                    {recommendedTemplate.exercises.length === 1 ? "" : "s"}
                    {recommendedTemplate.est_duration_min ? ` · ~${recommendedTemplate.est_duration_min} min` : ""}
                  </p>
                  <div className="row-wrap hub-today-actions">
                    <LinkButton href={trainHref} size="lg">
                      Start workout
                    </LinkButton>
                    <LinkButton href="/exercises" variant="secondary">
                      Browse exercises
                    </LinkButton>
                  </div>
                </>
              ) : (
                <>
                  <h2>Start your first session</h2>
                  <p className="hub-today-sub">
                    Pick any movement and let the camera coach count your reps, or generate a plan tailored to your goal.
                  </p>
                  <div className="row-wrap hub-today-actions">
                    <LinkButton href="/train" size="lg">
                      Start a quick set
                    </LinkButton>
                    <LinkButton href="/plan" variant="secondary">
                      Generate a plan
                    </LinkButton>
                  </div>
                </>
              )}
            </div>
            <div className="hub-today-visual">
              <HeroVisual />
            </div>
          </Card>
        </motion.div>

        <Card className="hub-streak">
          <div className="metric-row-3">
            <Metric label="Streak" value={`${streak}`} note={streak === 1 ? "day" : "days"} />
            <Metric label="This week" value={`${thisWeek}`} note="sessions" />
            <Metric label="Total" value={`${completed.length}`} note="logged" />
          </div>
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
      </div>

      <div className="hub-grid">
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
                    <span>{s.total_reps} reps</span>
                    <span>{formatDuration(s.active_seconds)}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <div className="section-title">
            <h2>Quick actions</h2>
          </div>
          <div className="hub-actions">
            {QUICK_ACTIONS.map((a) => (
              <Link key={a.href} href={a.href} className="hub-action">
                <img src={a.img} alt="" className="hub-action-img" />
                <span className="hub-action-label">{a.label}</span>
                <span className="hub-action-sub">{a.sub}</span>
              </Link>
            ))}
          </div>
          <Link href="/coach" className="hub-ai-teaser">
            <p className="eyebrow">AI coach</p>
            <strong>Get a recommendation grounded in your recent training.</strong>
            <span className="hub-ai-cta">Open coach →</span>
          </Link>
        </Card>
      </div>
    </div>
  );
}
