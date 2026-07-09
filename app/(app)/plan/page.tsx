"use client";

// /plan — AI training-plan wizard + plan view. If the user already has an
// active plan we render it as a weeks × days grid; otherwise we show a single
// form that collects goal/level/equipment/schedule and calls generatePlan().
// Never crashes: provider/config errors surface as a friendly empty-state.

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  PageHeader,
  Card,
  Button,
  LinkButton,
  Chip,
  Spinner,
  InlineNotice,
  SectionTitle,
} from "../../components/ui/primitives";
import { EmptyState } from "../../components/visuals";
import { listMeta } from "../../lib/library";
import { getActivePlan, getProfile, type ActivePlan } from "../../lib/db";
import type { DbPlanDay } from "../../lib/types";
import { generatePlan } from "../../lib/ai";
import "./plan.css";

const GOAL_OPTIONS: { value: string; label: string; hint: string }[] = [
  { value: "strength", label: "Strength", hint: "Build force with heavier, lower-rep work" },
  { value: "muscle", label: "Muscle", hint: "Grow size with moderate-rep volume" },
  { value: "mobility", label: "Mobility", hint: "Move better with range-focused sessions" },
  { value: "consistency", label: "Consistency", hint: "A steady, repeatable weekly rhythm" },
  { value: "conditioning", label: "Conditioning", hint: "Raise work capacity and stamina" },
];

const LEVELS = ["beginner", "intermediate", "advanced"];

const EQUIPMENT = [
  "bodyweight",
  "dumbbell",
  "barbell",
  "kettlebell",
  "cable",
  "machine",
  "band",
  "bench",
  "pull_up_bar",
];

const SESSION_MINUTES = [30, 45, 60, 75];
const WEEK_OPTIONS = [4, 6, 8];

const WEEKDAY_LABEL = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const GEN_STATUS = [
  "Reading your goal and schedule…",
  "Choosing movements for your equipment…",
  "Balancing push, pull and legs…",
  "Spacing rest days across the week…",
  "Setting sets, reps and progression…",
  "Finalising your plan…",
];

function labelFor(v: string) {
  return v
    .split("_")
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

export default function PlanPage() {
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<ActivePlan | null>(null);
  const [showWizard, setShowWizard] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const p = await getActivePlan().catch(() => null);
      setPlan(p);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  if (loading) return <Spinner label="Loading your plan…" />;

  if (plan && !showWizard) {
    return <PlanView plan={plan} onNew={() => setShowWizard(true)} />;
  }

  return (
    <PlanWizard
      onGenerated={async () => {
        setShowWizard(false);
        await refresh();
      }}
      onCancel={plan ? () => setShowWizard(false) : undefined}
    />
  );
}

// ---------------------------------------------------------------------------
// Plan view
// ---------------------------------------------------------------------------

function PlanView({ plan, onNew }: { plan: ActivePlan; onNew: () => void }) {
  // Group days into weeks of 7 by day_index. Some plans store a flat list; if
  // day_index runs 0..N we still get a clean week grid.
  const weeks = useMemo(() => {
    const byWeek = new Map<number, DbPlanDay[]>();
    for (const d of plan.days) {
      const w = Math.floor(d.day_index / 7);
      const list = byWeek.get(w) ?? [];
      list.push(d);
      byWeek.set(w, list);
    }
    return [...byWeek.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([week, days]) => ({
        week,
        days: days.sort((a, b) => a.day_index - b.day_index),
      }));
  }, [plan.days]);

  const trainingDays = plan.days.filter((d) => !d.is_rest).length;

  return (
    <div className="stack">
      <PageHeader
        eyebrow="Your active plan"
        title={plan.title}
        subtitle={`${plan.goal ? labelFor(plan.goal) + " · " : ""}${plan.weeks} week${
          plan.weeks === 1 ? "" : "s"
        } · ${trainingDays} training day${trainingDays === 1 ? "" : "s"}`}
        actions={
          <Button variant="secondary" onClick={onNew}>
            Generate a new plan
          </Button>
        }
      />

      <div className="stack">
        {weeks.map(({ week, days }) => (
          <section key={week} className="pl-week">
            <SectionTitle>Week {week + 1}</SectionTitle>
            <div className="pl-day-grid">
              {days.map((day) => (
                <PlanDayTile key={day.id} day={day} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function PlanDayTile({ day }: { day: DbPlanDay }) {
  const heading =
    day.title || (day.is_rest ? "Rest day" : day.focus || `Day ${day.day_index + 1}`);
  const weekday = day.weekday != null ? WEEKDAY_LABEL[day.weekday] : null;

  return (
    <Card className={`pl-day${day.is_rest ? " pl-day-rest" : ""}`}>
      <div className="pl-day-top">
        <span className="pl-day-index">
          {weekday ?? `Day ${(day.day_index % 7) + 1}`}
        </span>
        {day.is_rest ? (
          <Chip tone="neutral">Rest</Chip>
        ) : (
          day.template_id && <Chip tone="accent">Session</Chip>
        )}
      </div>

      <strong className="pl-day-title">{heading}</strong>
      {day.focus && !day.is_rest && day.focus !== heading && (
        <small className="pl-day-focus">{day.focus}</small>
      )}

      {day.is_rest ? (
        <p className="pl-day-note">Recover and come back fresh.</p>
      ) : day.template_id ? (
        <LinkButton
          href={`/train?template=${day.template_id}&day=${day.id}`}
          size="sm"
          full
        >
          Start this session
        </LinkButton>
      ) : (
        <p className="pl-day-note">Open training to log this session.</p>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Wizard
// ---------------------------------------------------------------------------

type ProfileShape = {
  experience_level?: string;
  equipment?: string[];
} | null;

function PlanWizard({
  onGenerated,
  onCancel,
}: {
  onGenerated: () => void | Promise<void>;
  onCancel?: () => void;
}) {
  const [goal, setGoal] = useState("strength");
  const [level, setLevel] = useState("beginner");
  const [equipment, setEquipment] = useState<string[]>(["bodyweight"]);
  const [daysPerWeek, setDaysPerWeek] = useState(3);
  const [sessionMinutes, setSessionMinutes] = useState(45);
  const [weeks, setWeeks] = useState(4);
  const [prefilled, setPrefilled] = useState(false);

  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A handful of common slugs so plan generation can work before the exercises
  // table is seeded server-side.
  const fallbackSlugs = useMemo(() => {
    return listMeta()
      .filter((m) => m.tier === 1 || m.tier === 2)
      .slice(0, 20)
      .map((m) => m.slug);
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      const prof = (await getProfile().catch(() => null)) as ProfileShape;
      if (!active || !prof) return;
      if (prof.experience_level && LEVELS.includes(prof.experience_level)) {
        setLevel(prof.experience_level);
      }
      if (Array.isArray(prof.equipment) && prof.equipment.length > 0) {
        const known = prof.equipment.filter((e) => EQUIPMENT.includes(e));
        if (known.length > 0) setEquipment(known);
      }
      setPrefilled(true);
    })();
    return () => {
      active = false;
    };
  }, []);

  function toggleEquipment(eq: string) {
    setEquipment((cur) =>
      cur.includes(eq) ? cur.filter((e) => e !== eq) : [...cur, eq],
    );
  }

  async function handleGenerate() {
    setError(null);
    if (equipment.length === 0) {
      setError("Pick at least one piece of equipment (bodyweight counts).");
      return;
    }
    setGenerating(true);
    const result = await generatePlan({
      goal,
      level,
      equipment,
      daysPerWeek,
      sessionMinutes,
      weeks,
      fallbackSlugs,
    });
    if ("error" in result) {
      setGenerating(false);
      setError(friendlyError(result.error));
      return;
    }
    await onGenerated();
    setGenerating(false);
  }

  if (generating) return <GeneratingState />;

  return (
    <div className="stack">
      <PageHeader
        eyebrow="Plan builder"
        title="Design your plan"
        subtitle="Answer a few questions and we’ll shape a weekly plan around your goal, gear and schedule."
        actions={
          onCancel ? (
            <Button variant="ghost" onClick={onCancel}>
              Back to plan
            </Button>
          ) : undefined
        }
      />

      {error && (
        <Card className="pl-error">
          <EmptyState name="plan" className="pl-error-art" />
          <div className="pl-error-body">
            <h2>Let’s try that again</h2>
            <InlineNotice tone={error.includes("API key") ? "warn" : "danger"}>
              {error}
            </InlineNotice>
            <Button onClick={handleGenerate}>Retry</Button>
          </div>
        </Card>
      )}

      <Card className="stack">
        <fieldset className="pl-fieldset">
          <legend>Goal</legend>
          <div className="pl-goal-grid">
            {GOAL_OPTIONS.map((g) => (
              <button
                key={g.value}
                type="button"
                className={`pl-goal${goal === g.value ? " active" : ""}`}
                onClick={() => setGoal(g.value)}
                aria-pressed={goal === g.value}
              >
                <strong>{g.label}</strong>
                <small>{g.hint}</small>
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="pl-fieldset">
          <legend>Experience{prefilled ? "" : ""}</legend>
          <div className="pl-chips">
            {LEVELS.map((l) => (
              <Chip key={l} active={level === l} onClick={() => setLevel(l)}>
                {labelFor(l)}
              </Chip>
            ))}
          </div>
        </fieldset>

        <fieldset className="pl-fieldset">
          <legend>Equipment</legend>
          <div className="pl-chips">
            {EQUIPMENT.map((eq) => (
              <Chip
                key={eq}
                active={equipment.includes(eq)}
                tone="accent"
                onClick={() => toggleEquipment(eq)}
              >
                {labelFor(eq)}
              </Chip>
            ))}
          </div>
        </fieldset>

        <div className="pl-steppers">
          <div className="pl-stepper-block">
            <span className="pl-stepper-label">Days per week</span>
            <NumberStepper
              value={daysPerWeek}
              min={2}
              max={6}
              onChange={setDaysPerWeek}
            />
          </div>

          <fieldset className="pl-fieldset pl-inline-set">
            <legend>Minutes per session</legend>
            <div className="pl-chips">
              {SESSION_MINUTES.map((m) => (
                <Chip
                  key={m}
                  active={sessionMinutes === m}
                  onClick={() => setSessionMinutes(m)}
                >
                  {m} min
                </Chip>
              ))}
            </div>
          </fieldset>

          <fieldset className="pl-fieldset pl-inline-set">
            <legend>Plan length</legend>
            <div className="pl-chips">
              {WEEK_OPTIONS.map((w) => (
                <Chip key={w} active={weeks === w} onClick={() => setWeeks(w)}>
                  {w} weeks
                </Chip>
              ))}
            </div>
          </fieldset>
        </div>

        <Button onClick={handleGenerate} size="lg" full>
          Generate plan
        </Button>
        <p className="pl-disclaimer">
          A practical starting point you can adjust anytime — swap days or
          exercises whenever you like.
        </p>
      </Card>
    </div>
  );
}

function NumberStepper({
  value,
  min,
  max,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="pl-stepper">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        aria-label="Fewer days"
      >
        −
      </button>
      <span className="pl-stepper-value">{value}</span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        aria-label="More days"
      >
        +
      </button>
    </div>
  );
}

function GeneratingState() {
  const [statusIndex, setStatusIndex] = useState(0);

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setStatusIndex(GEN_STATUS.length - 1);
      return;
    }
    const id = setInterval(() => {
      setStatusIndex((i) => (i + 1 < GEN_STATUS.length ? i + 1 : i));
    }, 1600);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="pl-generating">
      <div className="pl-generating-core">
        <Spinner />
        <h2>Designing your plan…</h2>
        <div className="pl-status-lines" aria-live="polite">
          <AnimatePresence mode="wait">
            <motion.p
              key={statusIndex}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.35 }}
            >
              {GEN_STATUS[statusIndex]}
            </motion.p>
          </AnimatePresence>
        </div>
        <p className="pl-generating-note">This usually takes a few moments.</p>
      </div>
    </div>
  );
}

// Turn a provider error into supportive, claim-safe copy. Config/no-key errors
// get the "add a key" nudge; everything else surfaces the raw message.
function friendlyError(raw: string): string {
  const lower = raw.toLowerCase();
  if (
    lower.includes("key") ||
    lower.includes("set up") ||
    lower.includes("configured") ||
    lower.includes("503")
  ) {
    return "AI needs an API key — add OPENROUTER_API_KEY in Supabase secrets.";
  }
  return raw;
}
