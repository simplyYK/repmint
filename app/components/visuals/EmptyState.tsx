import type { ReactElement } from "react";

export type EmptyStateName = "history" | "plan" | "coach" | "workouts" | "insights";

export type EmptyStateProps = {
  name: EmptyStateName;
  className?: string;
};

/** Friendly full-scene illustrations for empty screens (no session history, no plan yet, etc). */
export function EmptyState({ name, className }: EmptyStateProps) {
  return (
    <svg
      viewBox="0 0 200 160"
      className={`rmviz-root rmviz-emptystate ${className ?? ""}`}
      role="img"
      aria-label={`${name} empty state illustration`}
    >
      {SCENES[name]}
    </svg>
  );
}

const SCENES: Record<EmptyStateName, ReactElement> = {
  // Empty calendar with a single ghosted dot — "no sessions logged yet"
  history: (
    <g>
      <rect className="rmviz-emptystate-fill" x="30" y="26" width="140" height="112" rx="16" />
      <rect className="rmviz-emptystate-line" x="30" y="26" width="140" height="112" rx="16" />
      <path className="rmviz-emptystate-line" d="M30 56 H170" />
      <path className="rmviz-emptystate-line rmviz-emptystate-accent" d="M62 18 V34 M138 18 V34" />
      {Array.from({ length: 4 }).map((_, row) =>
        Array.from({ length: 6 }).map((_, col) => (
          <circle
            key={`${row}-${col}`}
            className="rmviz-emptystate-muted"
            opacity={0.18}
            cx={52 + col * 20}
            cy={76 + row * 16}
            r="2"
          />
        ))
      )}
      <circle className="rmviz-emptystate-dot" cx="112" cy="92" r="5" />
      <path className="rmviz-emptystate-line rmviz-emptystate-accent" d="M112 92 m-9 0 a9 9 0 1 0 18 0 a9 9 0 1 0 -18 0" strokeDasharray="2 4" />
    </g>
  ),

  // Rolled-out map/path with a flag at the end — "no plan generated yet"
  plan: (
    <g>
      <path
        className="rmviz-emptystate-line rmviz-emptystate-accent"
        d="M32 128 C 60 128 55 96 85 96 C 115 96 108 62 140 62"
        strokeDasharray="1 8"
      />
      <circle className="rmviz-emptystate-dot" cx="32" cy="128" r="4" />
      <g transform="translate(140,44)">
        <path className="rmviz-emptystate-line" d="M0 0 V36" />
        <path className="rmviz-emptystate-fill rmviz-emptystate-accent2" d="M0 2 L20 8 L0 14 Z" />
        <path className="rmviz-emptystate-line rmviz-emptystate-accent2" d="M0 2 L20 8 L0 14 Z" />
      </g>
      <rect className="rmviz-emptystate-fill" x="20" y="118" width="24" height="16" rx="4" />
      <rect className="rmviz-emptystate-line" x="20" y="118" width="24" height="16" rx="4" />
    </g>
  ),

  // Chat bubble with a friendly pulse dot — "no coach conversation yet"
  coach: (
    <g>
      <rect className="rmviz-emptystate-fill" x="40" y="34" width="120" height="70" rx="20" />
      <rect className="rmviz-emptystate-line" x="40" y="34" width="120" height="70" rx="20" />
      <path className="rmviz-emptystate-line" d="M70 104 L60 122 L86 104 Z" />
      <path className="rmviz-emptystate-fill" d="M70 104 L60 122 L86 104 Z" />
      <circle className="rmviz-emptystate-dot" cx="80" cy="68" r="4" />
      <circle className="rmviz-emptystate-dot" cx="100" cy="68" r="4" opacity="0.6" />
      <circle className="rmviz-emptystate-dot" cx="120" cy="68" r="4" opacity="0.3" />
    </g>
  ),

  // Stacked dumbbell + clipboard — "no workouts built yet"
  workouts: (
    <g>
      <rect className="rmviz-emptystate-fill" x="56" y="30" width="70" height="96" rx="10" />
      <rect className="rmviz-emptystate-line" x="56" y="30" width="70" height="96" rx="10" />
      <rect className="rmviz-emptystate-line rmviz-emptystate-accent" x="78" y="24" width="26" height="12" rx="4" />
      <path className="rmviz-emptystate-line" d="M70 56 H112 M70 72 H112 M70 88 H100" />
      <g transform="translate(30,120)">
        <path className="rmviz-emptystate-line" d="M0 8 H40" />
        <rect className="rmviz-emptystate-fill rmviz-emptystate-accent2" x="-6" y="0" width="12" height="16" rx="3" />
        <rect className="rmviz-emptystate-line" x="-6" y="0" width="12" height="16" rx="3" />
        <rect className="rmviz-emptystate-fill rmviz-emptystate-accent2" x="34" y="0" width="12" height="16" rx="3" />
        <rect className="rmviz-emptystate-line" x="34" y="0" width="12" height="16" rx="3" />
      </g>
    </g>
  ),

  // Flatlined-to-rising sparkline in a dashboard frame — "no insights yet"
  insights: (
    <g>
      <rect className="rmviz-emptystate-fill" x="26" y="30" width="148" height="98" rx="14" />
      <rect className="rmviz-emptystate-line" x="26" y="30" width="148" height="98" rx="14" />
      <path className="rmviz-emptystate-line" d="M46 108 H154" opacity="0.4" />
      <path
        className="rmviz-emptystate-line rmviz-emptystate-accent"
        d="M46 100 L70 96 L92 104 L114 80 L136 88 L154 58"
      />
      <circle className="rmviz-emptystate-dot" cx="154" cy="58" r="4" />
      <path className="rmviz-emptystate-line rmviz-emptystate-accent2" d="M46 116 H80 M46 122 H66" opacity="0.5" />
    </g>
  ),
};

export default EmptyState;
