import type { ReactNode } from "react";

export type MovementGlyphCategory =
  | "legs"
  | "hinge"
  | "push"
  | "pull"
  | "core"
  | "shoulders"
  | "arms"
  | "mobility"
  | "machines"
  | "conditioning";

export type MovementGlyphProps = {
  category: string;
  animated?: boolean;
  className?: string;
};

const KNOWN: readonly MovementGlyphCategory[] = [
  "legs",
  "hinge",
  "push",
  "pull",
  "core",
  "shoulders",
  "arms",
  "mobility",
  "machines",
  "conditioning",
];

function isKnown(category: string): category is MovementGlyphCategory {
  return (KNOWN as readonly string[]).includes(category);
}

/** Minimal stroke-based line-figure icon per movement category. */
export function MovementGlyph({ category, animated, className }: MovementGlyphProps) {
  const key = isKnown(category) ? category : "neutral";
  const animCls = animated ? "rmviz-animated" : "";

  return (
    <svg
      viewBox="0 0 64 64"
      className={`rmviz-root rmviz-glyph rmviz-glyph-${key} ${animCls} ${className ?? ""}`}
      role="img"
      aria-label={`${key} movement icon`}
    >
      {GLYPHS[key]}
    </svg>
  );
}

const GLYPHS: Record<MovementGlyphCategory | "neutral", ReactNode> = {
  // Squatting figure: head, torso hinged, bent knees.
  legs: (
    <g className="rmviz-glyph-move">
      <circle className="rmviz-glyph-dot" cx="32" cy="12" r="5" />
      <path className="rmviz-glyph-stroke" d="M32 17 L30 32 M30 32 L20 40 M30 32 L40 40 M20 40 L18 54 M40 40 L42 54" />
      <path className="rmviz-glyph-stroke" d="M22 24 L14 34 M42 24 L50 34" />
    </g>
  ),
  // Hip hinge: torso leaning forward, straight legs, arms hanging.
  hinge: (
    <g className="rmviz-glyph-move">
      <circle className="rmviz-glyph-dot" cx="20" cy="16" r="5" />
      <path className="rmviz-glyph-stroke" d="M20 21 L34 34 M34 34 L54 30 M34 34 L32 54 M20 26 L18 40" />
    </g>
  ),
  // Push-up: horizontal figure, arms bent supporting torso.
  push: (
    <g className="rmviz-glyph-move">
      <circle className="rmviz-glyph-dot" cx="14" cy="34" r="5" />
      <path className="rmviz-glyph-stroke" d="M19 36 L46 40 M46 40 L56 30 M28 38 L26 52 M38 39 L44 52 M19 36 L14 46" />
    </g>
  ),
  // Row / pull-up: arms pulling toward torso, elbows back.
  pull: (
    <g className="rmviz-glyph-move">
      <circle className="rmviz-glyph-dot" cx="32" cy="10" r="5" />
      <path className="rmviz-glyph-stroke" d="M32 15 L32 38 M32 20 L16 14 M32 20 L48 14 M32 38 L22 54 M32 38 L42 54" />
    </g>
  ),
  // Plank: flat horizontal line figure with slight arm support.
  core: (
    <g className="rmviz-glyph-move">
      <circle className="rmviz-glyph-dot" cx="12" cy="32" r="5" />
      <path className="rmviz-glyph-stroke" d="M17 32 L52 32 M22 32 L20 44 M46 32 L52 44" />
    </g>
  ),
  // Overhead press: arms raised above head.
  shoulders: (
    <g className="rmviz-glyph-move">
      <circle className="rmviz-glyph-dot" cx="32" cy="14" r="5" />
      <path className="rmviz-glyph-stroke" d="M32 19 L32 40 M32 24 L18 10 M32 24 L46 10 M32 40 L24 54 M32 40 L40 54" />
    </g>
  ),
  // Curl: elbow bent, forearm up toward shoulder.
  arms: (
    <g className="rmviz-glyph-move">
      <circle className="rmviz-glyph-dot" cx="32" cy="12" r="5" />
      <path className="rmviz-glyph-stroke" d="M32 17 L32 38 M32 38 L22 54 M32 38 L42 54 M32 22 L44 26" />
      <path className="rmviz-glyph-stroke" d="M44 26 L38 16" />
    </g>
  ),
  // Stretch: reaching figure, one arm extended overhead.
  mobility: (
    <g className="rmviz-glyph-move">
      <circle className="rmviz-glyph-dot" cx="28" cy="14" r="5" />
      <path className="rmviz-glyph-stroke" d="M28 19 L30 38 M30 22 L46 10 M30 22 L18 30 M30 38 L22 54 M30 38 L40 54" />
    </g>
  ),
  // Seated machine: figure seated with a handle/lever.
  machines: (
    <g className="rmviz-glyph-move">
      <circle className="rmviz-glyph-dot" cx="22" cy="14" r="5" />
      <path className="rmviz-glyph-stroke" d="M22 19 L22 36 M22 36 L14 52 M22 36 L34 40 M22 24 L36 22 M44 14 L44 34 M36 22 L52 22" />
    </g>
  ),
  // Running figure: legs mid-stride, bent arms.
  conditioning: (
    <g className="rmviz-glyph-move">
      <circle className="rmviz-glyph-dot" cx="30" cy="12" r="5" />
      <path className="rmviz-glyph-stroke" d="M30 17 L34 32 M34 32 L46 26 M34 32 L22 24 M34 32 L26 52 M34 32 L48 46" />
    </g>
  ),
  // Neutral fallback: dumbbell.
  neutral: (
    <g className="rmviz-glyph-move">
      <path className="rmviz-glyph-stroke" d="M20 32 L44 32" />
      <rect className="rmviz-glyph-stroke" x="12" y="24" width="8" height="16" rx="2" />
      <rect className="rmviz-glyph-stroke" x="44" y="24" width="8" height="16" rx="2" />
    </g>
  ),
};

export default MovementGlyph;
