"use client";

// RepMint landing page.
//
// The signature motion is a live, self-animating pose skeleton doing squats on
// a canvas — the product itself, rendered as the hero. Scroll reveals bring the
// feature scenes in. Everything degrades to a calm static state when the user
// prefers reduced motion. No video files, no heavy deps.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { EXERCISES } from "../lib/movements/registry";
import { listMeta, glyphCategory } from "../lib/library";

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

export default function Landing() {
  const router = useRouter();
  const onGetStarted = () => router.push("/auth?mode=sign-up");
  const onSignIn = () => router.push("/auth");
  const totalExercises = Object.keys(EXERCISES).length;
  // All real categories with counts (not just the 4 legacy camera groups).
  const categoryCounts = listMeta().reduce<Record<string, number>>((acc, ex) => {
    const c = glyphCategory(ex);
    acc[c] = (acc[c] ?? 0) + 1;
    return acc;
  }, {});
  const CHIP_ORDER = ["legs", "push", "pull", "core", "shoulders", "arms", "hinge", "conditioning", "mobility", "machines"];
  const categoryChips = Object.entries(categoryCounts)
    .sort((a, b) => {
      const ia = CHIP_ORDER.indexOf(a[0]);
      const ib = CHIP_ORDER.indexOf(b[0]);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    })
    .map(([c, n]) => [c.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase()), n] as const);

  return (
    <main className="landing">
      <header className="landing-nav">
        <div className="brand-lockup landing-brand">
          <img src="/brand/logomark.svg" alt="" className="brand-lockup-mark" />
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
            <p className="micro-label">Your AI camera coach</p>
            <h1>A personal trainer, living in your camera.</h1>
            <p className="landing-lead">
              Counts your reps, coaches your form out loud, and knows when you&apos;re done — using
              nothing but your phone&apos;s camera.
            </p>
            <div className="hero-actions">
              <button className="button button-primary" onClick={onGetStarted}>
                Start training free
              </button>
              <a className="button button-secondary" href="#how">
                See how it works
              </a>
            </div>
            <p className="landing-microtrust">
              Video never leaves your device · No equipment needed · Free to start
            </p>
          </Reveal>
        </div>
        <div className="landing-hero-visual">
          <HeroSkeleton />
        </div>
      </section>

      <section className="landing-stats" aria-label="RepMint by the numbers">
        {[
          ["115", "exercises, one coaching engine"],
          ["33-point", "pose AI at 30fps"],
          ["Real voice", "coaching mid-set"],
          ["100%", "of video stays on-device"],
        ].map(([big, small], i) => (
          <Reveal key={big} delay={i * 70} className="landing-stat">
            <strong>{big}</strong>
            <small>{small}</small>
          </Reveal>
        ))}
      </section>

      <section className="landing-how" id="how">
        <Reveal>
          <p className="micro-label center">How it works</p>
          <h2 className="center">From pocket to coached set in 30 seconds.</h2>
        </Reveal>
        <div className="landing-steps">
          {[
            {
              n: "1",
              t: "Prop your phone against anything",
              d: "A water bottle works — RepMint tells you where to stand.",
            },
            {
              n: "2",
              t: "Raise a hand. 3… 2… 1.",
              d: "One gesture starts the set. Hands stay on the weights.",
            },
            {
              n: "3",
              t: "Every rep counted, scored, coached",
              d: "Honest reps only, with one clear voice cue at a time.",
            },
          ].map((s2, i) => (
            <Reveal key={s2.n} delay={i * 100} className="landing-step">
              <span className="landing-step-n">{s2.n}</span>
              <strong>{s2.t}</strong>
              <p>{s2.d}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="landing-scene">
        <Reveal className="scene-text">
          <p className="micro-label">Every rep, counted</p>
          <h2>It counts the reps that actually count.</h2>
          <p>Half-reps don&apos;t fool it — only full range of motion makes the count.</p>
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
          <p className="micro-label">A coach that speaks up</p>
          <h2>It talks you through the set.</h2>
          <p>You can&apos;t read a screen mid-squat — so your coach speaks, one cue at a time.</p>
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

      <section className="landing-scene">
        <Reveal className="scene-text">
          <p className="micro-label">Fatigue, measured</p>
          <h2>It knows when you&apos;re grinding.</h2>
          <p>Rep speed dropping? It tells you when to push and when to call it.</p>
        </Reveal>
        <Reveal className="scene-visual" delay={120}>
          <div className="scene-card">
            <div className="scene-metric">
              <small>Rep speed</small>
              <strong>−18%</strong>
            </div>
            <div className="fatigue-bars" aria-hidden>
              {[92, 90, 88, 84, 78, 70].map((v, i) => (
                <span key={i} style={{ height: `${v}%` }} className={i >= 4 ? "hot" : ""} />
              ))}
            </div>
            <div className="scene-metric-row">
              <span className="fatigue-tag">In the productive zone</span>
            </div>
          </div>
        </Reveal>
      </section>

      <section className="landing-scene reverse">
        <Reveal className="scene-text">
          <p className="micro-label">Plans that fit real life</p>
          <h2>Built around your week, not someone else&apos;s.</h2>
          <p>Your goal, your gear, your week — a full plan in seconds, with a 20-minute version for the days that go sideways.</p>
        </Reveal>
        <Reveal className="scene-visual" delay={120}>
          <div className="landing-photo-card">
            <img src="/images/athletes/home-training.jpg" alt="Athlete training at home" loading="lazy" />
            <div className="landing-photo-scrim" aria-hidden />
            <div className="landing-photo-caption">
              <small>Tuesday · 18:00</small>
              <strong>Upper Push · ~40 min</strong>
              <span>Short on time? 20-min version ready</span>
            </div>
          </div>
        </Reveal>
      </section>

      <section className="landing-scene">
        <Reveal className="scene-text">
          <p className="micro-label">A coach with memory</p>
          <h2>It remembers your shoulder. And your goals.</h2>
          <p>Mention a tweaky shoulder once — every future session trains around it.</p>
        </Reveal>
        <Reveal className="scene-visual" delay={120}>
          <div className="progress-preview">
            <div className="progress-row">
              <span>This week</span>
              <strong>3 / 3</strong>
            </div>
            <div className="progress-row">
              <span>Form score trend</span>
              <strong>82% → 93%</strong>
            </div>
            <div className="progress-row">
              <span>Coach remembers</span>
              <strong>“keep pressing light”</strong>
            </div>
            <div className="progress-spark">
              {[40, 62, 55, 78, 70, 90, 84].map((v, i) => (
                <span key={i} style={{ height: `${v}%` }} />
              ))}
            </div>
          </div>
        </Reveal>
      </section>

      <section className="landing-exercises">
        <Reveal>
          <p className="micro-label center">Movement library</p>
          <h2 className="center">Push. Pull. Legs. Core.</h2>
          <p className="landing-lead center">
            {totalExercises} exercises, one coaching engine — dorm-room push-ups to barbell deadlifts.
          </p>
        </Reveal>
        <Reveal delay={100}>
          <div className="exercise-chips">
            {categoryChips.map(([label, count]) => (
              <span key={label} className="exercise-chip">
                {label}
                <em>{count}</em>
              </span>
            ))}
          </div>
        </Reveal>
      </section>

      <section className="landing-privacy">
        <Reveal>
          <div className="landing-privacy-inner">
            <span className="landing-privacy-icon" aria-hidden>
              🔒
            </span>
            <div>
              <h2>Your camera never phones home.</h2>
              <p>Pose tracking runs on your device. Video is never uploaded, stored, or seen — only your numbers sync.</p>
            </div>
          </div>
        </Reveal>
      </section>

      <section className="landing-cta">
        <Reveal>
          <h2>Stop guessing. Start counting.</h2>
          <p>Prop up your phone, raise a hand — your coach is ready. Free.</p>
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
          <img src="/brand/logomark.svg" alt="" className="brand-lockup-mark" />
          <strong>RepMint</strong>
        </div>
        <p>RepMint is coaching software that helps you train with more awareness — not medical guidance.</p>
      </footer>
    </main>
  );
}
