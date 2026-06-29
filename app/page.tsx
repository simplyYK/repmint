import Image from "next/image";

const liveMetrics = [
  { label: "Reps", value: "12", note: "sample set", featured: true },
  { label: "Tempo", value: "Good", note: "steady pace" },
  { label: "Range", value: "Clean", note: "full enough" },
  { label: "Cue", value: "Control", note: "next focus" },
];

const coachingModes = [
  "Squats",
  "Lunges",
  "Push-ups",
  "Hinges",
  "Planks",
  "Mobility",
];

const flow = [
  {
    title: "Choose a movement",
    copy: "Pick the exercise you are training and RepWise loads the right movement profile.",
  },
  {
    title: "Set your phone down",
    copy: "The camera watches body position locally while you move through the set.",
  },
  {
    title: "Follow one cue",
    copy: "RepWise keeps feedback short, so you can adjust without pausing your workout.",
  },
  {
    title: "Review the set",
    copy: "See reps, control, range, tempo, and what to focus on next time.",
  },
];

const highlights = [
  {
    title: "Trainer-style cues",
    copy: "Simple prompts help you move with better control during real sets, not after the moment is gone.",
  },
  {
    title: "Multi-movement profiles",
    copy: "Start with the basics and expand across strength, mobility, and bodyweight practice.",
  },
  {
    title: "Built for solo training",
    copy: "Use RepWise when you are at home, traveling, or training without a coach nearby.",
  },
];

const results = [
  ["Total reps", "12"],
  ["Best set cue", "Control"],
  ["Range", "Clean"],
  ["Tempo", "Steady"],
];

export default function Home() {
  return (
    <main className="app-shell" id="top">
      <header className="top-bar" aria-label="Primary navigation">
        <a className="wordmark" href="#top" aria-label="RepWise home">
          RepWise
        </a>
        <nav className="nav-links" aria-label="Page sections">
          <a href="#coach">Coach</a>
          <a href="#movements">Movements</a>
          <a href="#results">Results</a>
        </nav>
        <a className="top-action" href="#coach">
          Start Training
        </a>
      </header>

      <section className="hero-coach" id="coach" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="micro-label">RepWise</p>
          <h1 id="hero-title">Your form coach, in your pocket.</h1>
          <p className="hero-text">
            RepWise watches your movement, counts reps, and gives simple coaching cues across the exercises you already do.
          </p>
          <div className="hero-actions">
            <a className="button button-primary" href="#results">
              Start Training
            </a>
            <a className="button button-secondary" href="#how">
              See Results
            </a>
          </div>
          <p className="trust-line">
            No wearables. No guesswork. Just guided movement feedback from your camera.
          </p>
        </div>

        <div className="coach-grid" aria-label="RepWise live coach preview">
          <section className="video-stage" aria-label="Camera preview with movement overlay">
            <Image
              className="coach-photo"
              src="/images/repwise-hero.png"
              alt="Athlete training at home with subtle pose tracking overlay"
              width={1586}
              height={992}
              priority
            />
            <div className="stage-scrim" />
            <div className="stage-topline">
              <span>Tracking</span>
              <span>Local session</span>
            </div>
            <div className="body-frame" aria-hidden="true">
              <span className="joint shoulder-left" />
              <span className="joint shoulder-right" />
              <span className="joint hip-left" />
              <span className="joint hip-right" />
              <span className="joint knee-left" />
              <span className="joint knee-right" />
              <span className="joint ankle-left" />
              <span className="joint ankle-right" />
              <span className="bone torso-left" />
              <span className="bone torso-right" />
              <span className="bone hip-line" />
              <span className="bone left-thigh" />
              <span className="bone right-thigh" />
              <span className="bone left-shin" />
              <span className="bone right-shin" />
            </div>
            <div className="cue-panel" aria-live="polite">
              Move with control
            </div>
          </section>

          <aside className="metrics-rail" aria-label="Sample live metrics">
            {liveMetrics.map((metric) => (
              <article
                className={metric.featured ? "metric-card metric-card-featured" : "metric-card"}
                key={metric.label}
              >
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
                <small>{metric.note}</small>
              </article>
            ))}
          </aside>
        </div>
      </section>

      <section className="signal-strip" aria-label="RepWise product signals">
        <span>Camera-based feedback</span>
        <span>Exercise library</span>
        <span>Rep counting</span>
        <span>Set review</span>
      </section>

      <section className="movement-section" id="movements" aria-labelledby="movement-title">
        <div className="section-copy">
          <h2 id="movement-title">Coaching that moves with you.</h2>
          <p>
            RepWise is designed around movement profiles, so feedback can stay specific without pretending every exercise works the same way.
          </p>
        </div>
        <div className="movement-cloud" aria-label="Supported movement examples">
          {coachingModes.map((mode) => (
            <span key={mode}>{mode}</span>
          ))}
        </div>
      </section>

      <section className="how-section" id="how" aria-labelledby="how-title">
        <div className="phone-panel" aria-label="RepWise phone result preview">
          <div className="phone-shell">
            <div className="phone-top">
              <strong>RepWise</strong>
              <span>Set complete</span>
            </div>
            <div className="phone-score">
              <span>Next focus</span>
              <strong>Control</strong>
            </div>
            <div className="phone-rows">
              <span>12 reps counted</span>
              <span>Range looked clean</span>
              <span>Tempo stayed steady</span>
            </div>
          </div>
        </div>
        <div className="flow-content">
          <h2 id="how-title">From camera to cue in one set.</h2>
          <div className="flow-list">
            {flow.map((item) => (
              <article key={item.title}>
                <h3>{item.title}</h3>
                <p>{item.copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="highlight-section" aria-label="RepWise benefits">
        {highlights.map((item) => (
          <article key={item.title}>
            <h3>{item.title}</h3>
            <p>{item.copy}</p>
          </article>
        ))}
      </section>

      <section className="results-section" id="results" aria-labelledby="results-title">
        <div className="results-copy">
          <h2 id="results-title">A smarter way to finish a set.</h2>
          <p>
            After training, RepWise turns the session into a short review: what looked solid, what needs attention, and what to try next.
          </p>
          <a className="button button-primary" href="#coach">
            Start Training
          </a>
        </div>
        <div className="summary-panel" aria-label="Sample set summary">
          <p className="sample-label">Sample session</p>
          <dl className="summary-stats">
            {results.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <p>
            Good set. Keep your range consistent and stay patient through the lowering phase.
          </p>
        </div>
      </section>

      <footer className="site-footer">
        <strong>RepWise</strong>
        <p>
          Camera-based coaching feedback for training awareness. RepWise is not a substitute for professional health advice.
        </p>
      </footer>
    </main>
  );
}
