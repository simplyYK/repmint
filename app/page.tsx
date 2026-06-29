import Image from "next/image";

const liveMetrics = [
  { label: "Reps", value: "12", note: "sample set", featured: true },
  { label: "Tempo", value: "Steady", note: "live cue" },
  { label: "Range", value: "Clean", note: "movement check" },
  { label: "Focus", value: "Control", note: "next rep" },
];

const movements = ["Squats", "Lunges", "Push-ups", "Hinges", "Planks", "Mobility"];

const scrollStory = [
  {
    title: "Choose a movement",
    copy: "RepMint loads a movement profile with the right phases, cues, and set summary logic.",
    stat: "01",
  },
  {
    title: "Train in frame",
    copy: "Your camera becomes the coach surface. No wearable setup, no extra hardware, no manual counting.",
    stat: "02",
  },
  {
    title: "Adjust in the moment",
    copy: "The interface keeps feedback short, so users can act on the cue before the set is over.",
    stat: "03",
  },
  {
    title: "Leave with a focus",
    copy: "Each set ends with a compact review of reps, range, tempo, and what to work on next.",
    stat: "04",
  },
];

const investorProof = [
  {
    title: "Camera-first coaching",
    copy: "A familiar device becomes the input layer for form feedback, rep counting, and exercise guidance.",
  },
  {
    title: "Profile-driven expansion",
    copy: "New movements can be added as profiles instead of rebuilding the whole experience around one exercise.",
  },
  {
    title: "Designed for habit loops",
    copy: "Live cue, completed set, next focus. The product gives users a reason to come back tomorrow.",
  },
];

const summaryRows = [
  ["Total reps", "12"],
  ["Next focus", "Control"],
  ["Range", "Clean"],
  ["Tempo", "Steady"],
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
          <a href="#engine">Engine</a>
          <a href="#traction">Why Now</a>
        </nav>
        <a className="top-action" href="#waitlist">
          Request Access
        </a>
      </header>

      <section className="hero-coach" id="coach" aria-labelledby="hero-title">
        <div className="hero-copy reveal-block">
          <p className="micro-label">RepMint</p>
          <h1 id="hero-title">A form coach for every solo workout.</h1>
          <p className="hero-text">
            RepMint turns your camera into a rep counter, form cue layer, and set review for the movements you already train.
          </p>
          <div className="hero-actions">
            <a className="button button-primary" href="#waitlist">
              Request Access
            </a>
            <a className="button button-secondary" href="#engine">
              See Product
            </a>
          </div>
          <p className="trust-line">
            Built for home workouts, gym sessions, travel training, and form practice.
          </p>
        </div>

        <div className="coach-grid hero-product" aria-label="RepMint live coach preview">
          <section className="video-stage" aria-label="Camera preview with movement overlay">
            <Image
              className="coach-photo"
              src="/images/repmint-hero.png"
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
            <div className="scan-plane" aria-hidden="true" />
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

      <section className="motion-ticker" aria-label="RepMint product capabilities">
        <div>
          <span>Camera feedback</span>
          <span>Movement profiles</span>
          <span>Rep counting</span>
          <span>Set review</span>
          <span>Trainer-style cues</span>
          <span>Camera feedback</span>
          <span>Movement profiles</span>
        </div>
      </section>

      <section className="movement-section reveal-block" id="engine" aria-labelledby="movement-title">
        <div className="section-copy">
          <h2 id="movement-title">One engine. Many movement patterns.</h2>
          <p>
            RepMint is built around movement profiles, so the product can expand from bodyweight basics into a larger coaching library.
          </p>
        </div>
        <div className="movement-cloud" aria-label="Supported movement examples">
          {movements.map((mode) => (
            <span key={mode}>{mode}</span>
          ))}
        </div>
      </section>

      <section className="scroll-story" aria-labelledby="story-title">
        <div className="story-sticky">
          <p className="micro-label">Product loop</p>
          <h2 id="story-title">The RepMint set flow feels obvious.</h2>
          <p>
            The page motion mirrors the product: observe, cue, review, repeat.
          </p>
        </div>
        <div className="story-cards">
          {scrollStory.map((item) => (
            <article className="story-card" key={item.title}>
              <span>{item.stat}</span>
              <h3>{item.title}</h3>
              <p>{item.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="how-section reveal-block" aria-labelledby="phone-title">
        <div className="phone-panel" aria-label="RepMint phone result preview">
          <div className="phone-shell">
            <div className="phone-top">
              <strong>RepMint</strong>
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
        <div className="phone-copy">
          <h2 id="phone-title">A coach UI people can read mid-set.</h2>
          <p>
            Motion, contrast, and short labels are tuned for someone who is moving, breathing, and checking the screen from a few feet away.
          </p>
          <div className="principle-grid" aria-label="Product principles">
            <span>One cue at a time</span>
            <span>Visible status</span>
            <span>Sample set review</span>
          </div>
        </div>
      </section>

      <section className="investor-section" id="traction" aria-labelledby="traction-title">
        <div className="investor-copy reveal-block">
          <p className="micro-label">Why it can matter</p>
          <h2 id="traction-title">The training companion between video content and live coaching.</h2>
          <p>
            Fitness content tells people what to do. Coaches give feedback. RepMint sits in the gap with camera-based guidance that can scale.
          </p>
        </div>
        <div className="investor-grid">
          {investorProof.map((item) => (
            <article className="investor-card" key={item.title}>
              <h3>{item.title}</h3>
              <p>{item.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="results-section reveal-block" id="results" aria-labelledby="results-title">
        <div className="results-copy">
          <h2 id="results-title">Every set ends with a next step.</h2>
          <p>
            RepMint turns a finished set into a short review of what happened and what the user should focus on next.
          </p>
          <a className="button button-primary" href="#waitlist">
            Request Access
          </a>
        </div>
        <div className="summary-panel" aria-label="Sample set summary">
          <p className="sample-label">Sample session</p>
          <dl className="summary-stats">
            {summaryRows.map(([label, value]) => (
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

      <section className="waitlist-section" id="waitlist" aria-labelledby="waitlist-title">
        <div>
          <p className="micro-label">Launch path</p>
          <h2 id="waitlist-title">Bring trainer-style feedback to the camera people already own.</h2>
        </div>
        <a className="button button-primary" href="mailto:hello@repmint.ai">
          Request Access
        </a>
      </section>

      <footer className="site-footer">
        <strong>RepMint</strong>
        <p>
          Camera-based coaching feedback for training awareness. RepMint is not a substitute for professional health advice.
        </p>
      </footer>
    </main>
  );
}
