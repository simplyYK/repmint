import Image from "next/image";
import WaitlistForm from "./components/WaitlistForm";

const liveMetrics = [
  { label: "Today", value: "Push", note: "sample plan", featured: true },
  { label: "TUT", value: "38s", note: "sample set" },
  { label: "Reps", value: "12", note: "counted" },
  { label: "Focus", value: "Control", note: "next set" },
];

const scrollStory = [
  {
    title: "Pick a goal",
    copy: "RepMint starts with the outcome a user cares about: strength foundation, muscle building, mobility, consistency, or technique.",
    stat: "01",
  },
  {
    title: "Follow today's plan",
    copy: "The daily hub recommends the next session, shows plan progress, and explains why the workout fits today.",
    stat: "02",
  },
  {
    title: "Train with the camera",
    copy: "The active set coach counts reps, checks tempo and time under tension, and keeps feedback to one cue at a time.",
    stat: "03",
  },
  {
    title: "Review and progress",
    copy: "Every workout updates the plan, progress journey, and next recommendation.",
    stat: "04",
  },
];

const investorProof = [
  {
    title: "Plan-first training",
    copy: "The idea is not just rep counting. Users get a goal-based plan, a daily session, and clear next steps.",
  },
  {
    title: "Camera-based feedback",
    copy: "A phone or webcam becomes the input layer for form cues, time under tension, tempo, and set review.",
  },
  {
    title: "Built for habit loops",
    copy: "Plan, train, review, progress. RepMint gives users a reason to come back for the next session.",
  },
];

const summaryRows = [
  ["Total reps", "12"],
  ["TUT", "38s"],
  ["Tempo", "3-1-2"],
  ["Next focus", "Control"],
];

const planCards = [
  {
    title: "Strength foundation",
    copy: "Three sessions per week with camera-guided basics and simple progression.",
  },
  {
    title: "Muscle-building tempo",
    copy: "TUT-focused sets, supersets, and rest guidance for consistent training.",
  },
  {
    title: "Mobility and control",
    copy: "Short movement blocks for range, positioning, and weekly consistency.",
  },
];

const tickerItems = [
  "Camera feedback",
  "Goal-based plans",
  "Time under tension",
  "Supersets",
  "Rep counting",
  "Progress tracking",
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
          Get Access
        </a>
      </header>

      <section className="hero-coach" id="coach" aria-labelledby="hero-title">
        <div className="hero-copy reveal-block">
          <p className="micro-label">RepMint pilot</p>
          <h1 id="hero-title">Your AI camera trainer for goal-based workouts.</h1>
          <p className="hero-text">
            RepMint builds a plan around your goal, guides each set with camera-based feedback, tracks reps and time under tension, and shows what to focus on next.
          </p>
          <div className="hero-actions">
            <a className="button button-primary" href="#waitlist">
              Get Early Access
            </a>
            <a className="button button-secondary" href="#engine">
              See How It Works
            </a>
          </div>
          <p className="trust-line">
            Built for home workouts, gym sessions, mobility work, and solo training days.
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
              <span>Live tracking</span>
              <span>Goal: strength</span>
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
              Slow the lowering phase
            </div>
          </section>

          <aside className="metrics-rail" aria-label="Sample live metrics">
            {liveMetrics.map((metric) => (
              <div
                className={metric.featured ? "metric-card metric-card-featured" : "metric-card"}
                key={metric.label}
              >
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
                <small>{metric.note}</small>
              </div>
            ))}
          </aside>
        </div>
      </section>

      <section className="motion-ticker" aria-label="RepMint product capabilities">
        <div aria-hidden="true">
          {[...tickerItems, ...tickerItems].map((item, i) => (
            <span key={i}>{item}</span>
          ))}
        </div>
      </section>

      <section className="movement-section reveal-block" id="engine" aria-labelledby="movement-title">
        <div className="section-copy">
          <h2 id="movement-title">Start with a goal. Train with a plan.</h2>
          <p>
            RepMint combines plan guidance with movement profiles, so workouts can include sets, supersets, tempo targets, and camera-based coaching cues.
          </p>
        </div>
        <div className="movement-cloud" aria-label="Sample training plans">
          {planCards.map((plan) => (
            <span key={plan.title}>
              <strong>{plan.title}</strong>
              <small>{plan.copy}</small>
            </span>
          ))}
        </div>
      </section>

      <section className="scroll-story" aria-labelledby="story-title">
        <div className="story-sticky">
          <p className="micro-label">Product loop</p>
          <h2 id="story-title">The RepMint loop is simple enough to test now.</h2>
          <p>
            The first experiments validate whether users want the plan, trust the camera coach, and come back for the next recommendation.
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
            <span>38s time under tension</span>
            <span>Tempo target: 3-1-2</span>
          </div>
          </div>
        </div>
        <div className="phone-copy">
          <h2 id="phone-title">A coach UI people can use mid-set.</h2>
          <p>
            RepMint keeps the live screen focused: one cue, visible reps, TUT, tempo, and controls that are easy to hit between sets.
          </p>
          <div className="principle-grid" aria-label="Product principles">
            <span>One cue at a time</span>
            <span>Goal-based plan</span>
            <span>Sample set review</span>
          </div>
        </div>
      </section>

      <section className="investor-section" id="traction" aria-labelledby="traction-title">
        <div className="investor-copy reveal-block">
          <p className="micro-label">Why it can matter</p>
          <h2 id="traction-title">The training companion between workout apps and live coaching.</h2>
          <p>
            Workout apps tell people what to do. Coaches adjust the plan and give feedback. RepMint tests whether camera-based training guidance can sit in that gap.
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
          <h2 id="results-title">Every set feeds the next recommendation.</h2>
          <p>
            RepMint turns a finished set into a short review of reps, TUT, tempo, and what the user should focus on in the next set or session.
          </p>
          <a className="button button-primary" href="#waitlist">
            Get Early Access
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
            Good set. Keep the lowering phase patient and use the same range on the next round.
          </p>
        </div>
      </section>

      <section className="waitlist-section" id="waitlist" aria-labelledby="waitlist-title">
        <div>
          <p className="micro-label">Pilot waitlist</p>
          <h2 id="waitlist-title">Help test RepMint before the full app is built.</h2>
          <p>
            Join the pilot list if you train solo and want goal-based workouts with camera-based set feedback.
          </p>
        </div>
        <WaitlistForm />
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
