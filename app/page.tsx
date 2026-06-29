const metrics = [
  { label: "Reps", value: "12", note: "current set" },
  { label: "Form score", value: "86", note: "live average" },
  { label: "Phase", value: "Bottom", note: "squat state" },
  { label: "Timer", value: "01:38", note: "set time" },
];

const cues = [
  "Try a little more depth",
  "Keep your chest lifted",
  "Move with control",
  "Stay centered",
];

const flow = [
  {
    title: "Camera starts locally",
    copy: "RepMint asks for webcam access and keeps frames in the browser for the current session.",
  },
  {
    title: "Pose landmarks appear",
    copy: "MediaPipe-style body points make the demo visible, inspectable, and easy to judge.",
  },
  {
    title: "Squats become signals",
    copy: "Knee, hip, and torso angles feed a simple state machine for rep counting.",
  },
  {
    title: "The set ends clearly",
    copy: "Reps, score, duration, common cue, and a short local coaching note appear after End Set.",
  },
];

const checks = [
  "Depth reached",
  "Chest position",
  "Controlled tempo",
  "Centered frame",
  "Rep completion",
];

export default function Home() {
  return (
    <main className="app-shell" id="top">
      <header className="top-bar" aria-label="Primary navigation">
        <a className="wordmark" href="#top" aria-label="RepMint home">
          RepMint
        </a>
        <nav className="nav-links" aria-label="Page sections">
          <a href="#coach">Coach</a>
          <a href="#flow">Flow</a>
          <a href="#summary">Summary</a>
        </nav>
        <a className="top-action" href="#coach">
          Start Set
        </a>
      </header>

      <section className="hero-coach" id="coach" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="micro-label">Webcam squat coach</p>
          <h1 id="hero-title">Real-time reps. Clear form cues.</h1>
          <p className="hero-text">
            RepMint turns a webcam squat set into live rep counting, simple scoring, and one readable cue at a time.
          </p>
          <div className="hero-actions">
            <a className="button button-primary" href="#summary">
              View Demo
            </a>
            <a className="button button-secondary" href="#flow">
              See Flow
            </a>
          </div>
        </div>

        <div className="coach-grid" aria-label="RepMint live coach preview">
          <section className="video-stage" aria-label="Webcam preview with pose overlay">
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
              Try a little more depth
            </div>
          </section>

          <aside className="metrics-rail" aria-label="Live metrics">
            {metrics.map((metric) => (
              <article className="metric-card" key={metric.label}>
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
                <small>{metric.note}</small>
              </article>
            ))}
          </aside>
        </div>
      </section>

      <section className="state-strip" aria-label="Demo states">
        <article>
          <strong>Loading</strong>
          <span>Loading pose model</span>
        </article>
        <article>
          <strong>Permission</strong>
          <span>Retry Camera</span>
        </article>
        <article>
          <strong>No person</strong>
          <span>Step back into frame</span>
        </article>
        <article>
          <strong>Tracking</strong>
          <span>Good rep</span>
        </article>
      </section>

      <section className="flow-section" id="flow" aria-labelledby="flow-title">
        <div className="section-copy">
          <h2 id="flow-title">The demo flow is built for judges.</h2>
          <p>
            One reliable squat workflow, clear browser-only architecture, and visible feedback from camera permission to set summary.
          </p>
        </div>
        <div className="flow-grid">
          {flow.map((item) => (
            <article key={item.title}>
              <h3>{item.title}</h3>
              <p>{item.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="scoring-section" aria-labelledby="scoring-title">
        <div className="score-card">
          <span>Live score</span>
          <strong>86</strong>
          <p>Transparent rules produce a simple score. No medical claims, no hidden model magic.</p>
        </div>
        <div className="scoring-copy">
          <h2 id="scoring-title">Coaching cues stay practical.</h2>
          <p>
            RepMint chooses one short instruction at a time, so the user can keep moving without reading a wall of text.
          </p>
          <div className="cue-list" aria-label="Example cues">
            {cues.map((cue) => (
              <span key={cue}>{cue}</span>
            ))}
          </div>
        </div>
      </section>

      <section className="summary-section" id="summary" aria-labelledby="summary-title">
        <div className="summary-panel">
          <div>
            <h2 id="summary-title">Set summary</h2>
            <p>
              12 reps completed with an 86 average score. Best rep was 92. Most common cue: try a little more depth.
            </p>
          </div>
          <dl className="summary-stats">
            <div>
              <dt>Total reps</dt>
              <dd>12</dd>
            </div>
            <div>
              <dt>Average</dt>
              <dd>86</dd>
            </div>
            <div>
              <dt>Best</dt>
              <dd>92</dd>
            </div>
            <div>
              <dt>Duration</dt>
              <dd>01:38</dd>
            </div>
          </dl>
          <a className="button button-primary" href="#coach">
            Start New Set
          </a>
        </div>

        <div className="check-panel" aria-label="Scoring checks">
          <h3>Form checks</h3>
          {checks.map((check) => (
            <div className="check-row" key={check}>
              <span>{check}</span>
              <strong>Checked</strong>
            </div>
          ))}
        </div>
      </section>

      <footer className="site-footer">
        <strong>RepMint</strong>
        <p>
          Browser-based movement coaching demo. RepMint is not a medical device and does not diagnose, treat, or prevent conditions.
        </p>
      </footer>
    </main>
  );
}
