export type HeroVisualProps = {
  className?: string;
};

/**
 * Landing-page marquee visual: a stylized figure mid-squat with a
 * pose-tracking skeleton overlay (dots + lines) and floating metric chips
 * (reps, form %, time-under-tension). Pure SVG + absolutely-positioned HTML
 * chip overlays, CSS-animated (float/pulse), reduced-motion aware.
 */
export function HeroVisual({ className }: HeroVisualProps) {
  return (
    <div className={`rmviz-root rmviz-hero ${className ?? ""}`}>
      <svg
        className="rmviz-hero-svg"
        viewBox="0 0 400 500"
        role="img"
        aria-label="Illustration of a person mid-squat with a pose tracking overlay"
      >
        <defs>
          <radialGradient id="rmviz-hero-glow-grad" cx="50%" cy="38%" r="60%">
            <stop offset="0%" stopColor="var(--rmviz-accent, #b7ff3c)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--rmviz-accent, #b7ff3c)" stopOpacity="0" />
          </radialGradient>
        </defs>

        <circle className="rmviz-hero-glow" cx="200" cy="200" r="190" fill="url(#rmviz-hero-glow-grad)" />

        {/* ------------------------- Stylized mid-squat figure ------------------------- */}
        <g>
          {/* torso mass */}
          <path
            className="rmviz-hero-figure"
            d="M168 178
               c-6 20 -8 40 -6 58
               c2 22 10 40 10 58
               l-14 92
               c-2 10 4 18 14 18
               c8 0 14 -6 15 -14
               l10 -76
               l10 76
               c1 8 7 14 15 14
               c10 0 16 -8 14 -18
               l-14 -92
               c0 -18 8 -36 10 -58
               c2 -18 0 -38 -6 -58
               c-8 -14 -22 -22 -34 -22
               c-12 0 -26 8 -34 22 z"
          />
          {/* head */}
          <circle className="rmviz-hero-figure" cx="202" cy="140" r="26" />
        </g>

        {/* ------------------------- Pose-tracking skeleton overlay ------------------------- */}
        <g>
          {/* skeleton lines */}
          <path
            className="rmviz-hero-skeleton-line"
            d="M202 158 L202 210
               M202 178 L160 200
               M202 178 L246 196
               M160 200 L148 236
               M246 196 L262 228
               M202 210 L178 262
               M202 210 L228 258
               M178 262 L172 328
               M228 258 L236 326
               M172 328 L164 396
               M236 326 L244 392"
          />

          {/* joints */}
          {[
            [202, 140],
            [202, 178],
            [202, 210],
            [160, 200],
            [246, 196],
            [148, 236],
            [262, 228],
            [178, 262],
            [228, 258],
            [172, 328],
            [236, 326],
            [164, 396],
            [244, 392],
          ].map(([cx, cy], i) => (
            <circle
              key={`${cx}-${cy}`}
              className="rmviz-hero-skeleton-joint rmviz-hero-joint-pulse"
              cx={cx}
              cy={cy}
              r="3"
              style={{ animationDelay: `${(i % 5) * 0.15}s` }}
            />
          ))}
        </g>
      </svg>

      <div className="rmviz-chip rmviz-chip-reps">
        <span className="rmviz-chip-label">Reps</span>
        <span className="rmviz-chip-value">12</span>
      </div>

      <div className="rmviz-chip rmviz-chip-form">
        <span className="rmviz-chip-label">Form</span>
        <span className="rmviz-chip-value">94%</span>
      </div>

      <div className="rmviz-chip rmviz-chip-tut">
        <span className="rmviz-chip-label">TUT</span>
        <span className="rmviz-chip-value">2.4s</span>
      </div>
    </div>
  );
}

export default HeroVisual;
