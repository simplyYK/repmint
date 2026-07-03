"use client";

// RepMint landing page.
//
// The signature motion is a live, self-animating pose skeleton doing squats on
// a canvas — the product itself, rendered as the hero. Scroll reveals bring the
// feature scenes in. Everything degrades to a calm static state when the user
// prefers reduced motion. No video files, no heavy deps.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { movementsByCategory } from "../lib/movements/registry";

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// ---- Live hero skeleton -------------------------------------------------
type Pt = [number, number];

function poseAt(d: number) {
  // d = squat depth, 0 (standing) .. 1 (bottom). Front-facing skeleton.
  const drop = 0.09 * d;
  const head: Pt = [0.5, 0.2 + drop];
  const shY = 0.31 + drop;
  const hipY = 0.53 + 0.13 * d;
  const kneeY = 0.73 + 0.06 * d;
  const ankY = 0.95;
  const elbY = 0.42 + drop - 0.05 * d;
  const wrY = 0.53 + drop - 0.16 * d;
  return {
    head,
    shL: [0.4, shY] as Pt,
    shR: [0.6, shY] as Pt,
    elbL: [0.35 + 0.03 * d, elbY] as Pt,
    elbR: [0.65 - 0.03 * d, elbY] as Pt,
    wrL: [0.4 + 0.04 * d, wrY] as Pt,
    wrR: [0.6 - 0.04 * d, wrY] as Pt,
    hipL: [0.45, hipY] as Pt,
    hipR: [0.55, hipY] as Pt,
    kneeL: [0.44 - 0.06 * d, kneeY] as Pt,
    kneeR: [0.56 + 0.06 * d, kneeY] as Pt,
    ankL: [0.45, ankY] as Pt,
    ankR: [0.55, ankY] as Pt,
  };
}

function HeroSkeleton() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [reps, setReps] = useState(0);
  const [depth, setDepth] = useState(0);
  const [tut, setTut] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = prefersReducedMotion();
    let raf = 0;
    let start = 0;
    let lastRep = -1;
    let tutAcc = 0;
    let lastTs = 0;
    const period = 2600; // ms per rep

    const draw = (d: number) => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const p = poseAt(d);
      const X = (n: number) => n * w;
      const Y = (n: number) => n * h;
      const bones: Array<[Pt, Pt]> = [
        [p.shL, p.shR],
        [p.shL, p.hipL],
        [p.shR, p.hipR],
        [p.hipL, p.hipR],
        [p.shL, p.elbL],
        [p.elbL, p.wrL],
        [p.shR, p.elbR],
        [p.elbR, p.wrR],
        [p.hipL, p.kneeL],
        [p.kneeL, p.ankL],
        [p.hipR, p.kneeR],
        [p.kneeR, p.ankR],
      ];
      ctx.lineWidth = 5;
      ctx.lineCap = "round";
      ctx.strokeStyle = "rgba(183,255,60,0.92)";
      ctx.shadowColor = "rgba(183,255,60,0.5)";
      ctx.shadowBlur = 16;
      for (const [a, b] of bones) {
        ctx.beginPath();
        ctx.moveTo(X(a[0]), Y(a[1]));
        ctx.lineTo(X(b[0]), Y(b[1]));
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
      const joints = [p.head, p.shL, p.shR, p.elbL, p.elbR, p.wrL, p.wrR, p.hipL, p.hipR, p.kneeL, p.kneeR, p.ankL, p.ankR];
      ctx.fillStyle = "#48e5c2";
      for (const j of joints) {
        ctx.beginPath();
        ctx.arc(X(j[0]), Y(j[1]), j === p.head ? 12 : 5.5, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    if (reduced) {
      draw(0.55);
      setReps(8);
      setDepth(0.55);
      setTut(37);
      return;
    }

    const loop = (ts: number) => {
      if (!start) start = ts;
      const dt = lastTs ? ts - lastTs : 16;
      lastTs = ts;
      const elapsed = ts - start;
      const cycle = Math.floor(elapsed / period);
      const phase = (elapsed % period) / period; // 0..1
      const d = (1 - Math.cos(phase * Math.PI * 2)) / 2; // smooth down-up
      draw(d);
      if (cycle !== lastRep) {
        lastRep = cycle;
        setReps((r) => r + 1);
      }
      if (d > 0.15) tutAcc += dt / 1000;
      setDepth(d);
      setTut(Math.round(tutAcc));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="hero-stage">
      <canvas ref={canvasRef} className="hero-canvas" aria-hidden="true" />
      <div className="hero-hud">
        <span className="hero-hud-badge">
          <em />
          Live tracking
        </span>
        <div className="hero-hud-metrics">
          <div>
            <small>Reps</small>
            <strong>{reps}</strong>
          </div>
          <div>
            <small>TUT</small>
            <strong>{tut}s</strong>
          </div>
        </div>
        <div className="hero-depth">
          <div className="hero-depth-fill" style={{ width: `${Math.round(depth * 100)}%` }} />
        </div>
        <span className="hero-hud-cue">{depth > 0.6 ? "Great depth — drive up." : "Lower with control."}</span>
      </div>
    </div>
  );
}

// ---- Scroll reveal ------------------------------------------------------
function Reveal({ children, className = "", delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (prefersReducedMotion()) {
      setShown(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setShown(true);
            io.disconnect();
          }
        }
      },
      { threshold: 0.2 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={`reveal ${shown ? "revealed" : ""} ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

const CUES = [
  "Sit a little deeper — thighs toward parallel.",
  "Lift your hips into one straight line.",
  "Keep your elbows pinned to your sides.",
  "Push your knees out over your toes.",
  "Drive your elbows back to your hips.",
];

export default function Landing({
  onGetStarted,
  onSignIn,
  onGuest,
}: {
  onGetStarted: () => void;
  onSignIn: () => void;
  onGuest: () => void;
}) {
  const groups = movementsByCategory();
  const totalExercises = groups.reduce((n, g) => n + g.items.length, 0);

  return (
    <main className="landing">
      <header className="landing-nav">
        <div className="brand-lockup landing-brand">
          <span>R</span>
          <strong>RepMint</strong>
        </div>
        <div className="landing-nav-actions">
          <button className="button ghost-button" onClick={onSignIn}>
            Sign in
          </button>
          <button className="button button-primary" onClick={onGetStarted}>
            Start free
          </button>
        </div>
      </header>

      <section className="landing-hero">
        <div className="landing-hero-copy">
          <Reveal>
            <p className="micro-label">AI camera coach</p>
            <h1>Train with a coach in your camera.</h1>
            <p className="landing-lead">
              RepMint counts your reps, tracks time under tension and tempo, and gives one clear form cue at a time —
              using just your phone or laptop camera.
            </p>
            <div className="hero-actions">
              <button className="button button-primary" onClick={onGetStarted}>
                Start training free
              </button>
              <button className="button button-secondary" onClick={onSignIn}>
                I have an account
              </button>
            </div>
            <p className="landing-microtrust">No equipment or wearables needed · Works in your browser</p>
          </Reveal>
        </div>
        <div className="landing-hero-visual">
          <HeroSkeleton />
        </div>
      </section>

      <section className="landing-marquee" aria-hidden="true">
        <div className="marquee-track">
          {[...Array(2)].map((_, i) => (
            <span key={i}>
              Rep counting · Time under tension · Tempo · Form coach · Push · Pull · Legs · Core · Progress ·
            </span>
          ))}
        </div>
      </section>

      <section className="landing-scene">
        <Reveal className="scene-text">
          <p className="micro-label">Every rep, counted</p>
          <h2>It counts the reps that actually count.</h2>
          <p>
            A depth-aware rep engine only logs reps that reach real range of motion — partial reps don&apos;t sneak in.
            Time under tension and tempo are tracked per rep, automatically.
          </p>
        </Reveal>
        <Reveal className="scene-visual" delay={120}>
          <div className="scene-card">
            <div className="scene-metric">
              <small>Reps</small>
              <strong>8 / 8</strong>
            </div>
            <div className="scene-bar">
              <div className="scene-bar-fill" />
              <span>Depth 82%</span>
            </div>
            <div className="scene-metric-row">
              <span>TUT 37s</span>
              <span>Avg rep 4.4s</span>
              <span>Tempo 3-1-1-0</span>
            </div>
          </div>
        </Reveal>
      </section>

      <section className="landing-scene reverse">
        <Reveal className="scene-text">
          <p className="micro-label">Real-time form coach</p>
          <h2>One clear cue at a time.</h2>
          <p>
            RepMint reads your joint angles and turns them into calm, practical cues grounded in mainstream coaching
            standards — never a wall of noise, just the one thing to fix next.
          </p>
        </Reveal>
        <Reveal className="scene-visual" delay={120}>
          <div className="cue-stack">
            {CUES.map((c, i) => (
              <div key={c} className="cue-line" style={{ transitionDelay: `${i * 120}ms` }}>
                {c}
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      <section className="landing-exercises">
        <Reveal>
          <p className="micro-label">Movement library</p>
          <h2>Push. Pull. Legs. Core.</h2>
          <p className="landing-lead center">
            {totalExercises} exercises from one shared coaching engine — bodyweight and loaded, from squats and push-ups
            to hinges, curls, presses and planks.
          </p>
        </Reveal>
        <div className="exercise-grid">
          {groups.map((group, gi) => (
            <Reveal key={group.category} className="exercise-col" delay={gi * 80}>
              <p className="group-label">{group.label}</p>
              <ul>
                {group.items.map((item) => (
                  <li key={item.id}>{item.name}</li>
                ))}
              </ul>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="landing-scene">
        <Reveal className="scene-text">
          <p className="micro-label">Your training, remembered</p>
          <h2>Progress that follows you.</h2>
          <p>
            Create an account and every set, rep and cue is saved to your profile — so your history and next-focus
            guidance are there on any device. Prefer to explore first? Jump in as a guest.
          </p>
          <div className="hero-actions">
            <button className="button button-primary" onClick={onGetStarted}>
              Create your account
            </button>
            <button className="button ghost-button" onClick={onGuest}>
              Explore as guest
            </button>
          </div>
        </Reveal>
        <Reveal className="scene-visual" delay={120}>
          <div className="progress-preview">
            <div className="progress-row">
              <span>This week</span>
              <strong>3 / 3</strong>
            </div>
            <div className="progress-row">
              <span>Total reps</span>
              <strong>142</strong>
            </div>
            <div className="progress-row">
              <span>Training time</span>
              <strong>28m</strong>
            </div>
            <div className="progress-spark">
              {[40, 62, 55, 78, 70, 90, 84].map((v, i) => (
                <span key={i} style={{ height: `${v}%` }} />
              ))}
            </div>
          </div>
        </Reveal>
      </section>

      <section className="landing-cta">
        <Reveal>
          <h2>Ready when you are.</h2>
          <p>Set up your camera, run one controlled set, and see what better awareness feels like.</p>
          <div className="hero-actions center">
            <button className="button button-primary" onClick={onGetStarted}>
              Start training free
            </button>
            <button className="button button-secondary" onClick={onSignIn}>
              Sign in
            </button>
          </div>
        </Reveal>
      </section>

      <footer className="landing-footer">
        <div className="brand-lockup landing-brand">
          <span>R</span>
          <strong>RepMint</strong>
        </div>
        <p>RepMint is coaching software that helps you train with more awareness — not medical guidance.</p>
      </footer>
    </main>
  );
}
