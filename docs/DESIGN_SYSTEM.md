# RepMint Design System — "Kinetic Precision"

Adopted 2026-07-09 from the Stitch design exploration (see scratchpad zips) and
implemented across the app. This is the single source of truth for visual
decisions; page-level CSS must derive from these tokens.

## Personality

High-performance sports-tech: authoritative yet motivating. Dark, focused,
low-distraction — like high-end athletic wearables (Whoop/Oura/Apple Fitness+),
never generic fitness clip-art. Minimalism + glassmorphism + technical
precision. Clinical accuracy with the raw energy of professional athletics.

## Color (CSS vars in app/globals.css — unchanged palette)

- Base bg `--bg: #080a0d`, secondary `--bg-2: #0d1218`
- Surfaces (tonal elevation, brighter = closer): `--surface: #141a22`,
  `--surface-2: #1b2430`, `--surface-3: #243141`
- Text: `--text: #f4f7fb`, `--text-soft: #c8d2df`, `--text-muted: #8794a4`
- Hero accent (lime) `--accent: #b7ff3c` — reserved for primary CTAs, live/PR
  data, active states. Secondary accent (teal) `--accent-2: #48e5c2` — for
  informative/secondary metrics and recovery/balanced states.
- Borders: white at 12% (`--line`) standard, 22% (`--line-strong`) active.

## Typography

- **Display/headlines: "Hanken Grotesk"** (via next/font/google, weights
  700/800), tight letter-spacing (-0.02em on display sizes). Var:
  `--font-display`.
- **Body + data: Geist Sans / Geist Mono** (existing). Metric labels use
  `label-sm` styling: 12px, 600, 0.1em letter-spacing, uppercase — the
  "instrument panel" look (`.eyebrow`, `.metric-label`).
- Big greeting/display headers: 800 weight, clamp(1.9rem, 4vw, 3rem).

## Depth & glass

Tonal layering instead of heavy shadows. Overlays/modals: `--surface-2` at
~85% opacity + `backdrop-filter: blur(20px)`. HUD overlays over camera:
`rgba(13,18,24,0.8)` + blur(25px) + 1px lime stroke. Active lime elements get
a glow: `box-shadow: 0 0 15px rgba(183,255,60,0.3)`.

## Shape

10px inputs/nested, 16px cards, 22px hero containers, pill for ALL buttons and
chips (interactive = pill; informational = rounded rect).

## Iconography

2px stroke, open geometric line icons, round caps. Teal for informative, lime
for action/active. Filled only when toggled/active. Custom set lives in
`app/components/ui/icons.tsx` (nav) and `public/images/quick-actions/`
(illustrated tiles).

## Brand

- Wordmark: "RepMint" set in Hanken Grotesk 800 italic, lime, tight tracking
  (`public/brand/wordmark.svg`, and `.shell-brand` renders it as styled text).
- Logomark: lime rounded-square with black lightning bolt + rep-ring arc
  (`public/brand/logomark.svg`) — used for favicon/app icon/loading marks.

## Signature elements

- **Raised Train button**: the center item of the mobile tab bar is a raised
  lime circular lightning-bolt button.
- **Rep ring**: circular lime progress ring around the live rep count.
- **Cue banner**: single coaching cue in a glass pill at the top of the HUD.
- **Stat bar**: glass bottom bar on Train with ROM %, tempo x:x:x (lime mono),
  TUT seconds.
- **Real athlete imagery**: hero cards use licensed athletic photography
  (public/images/athletes/), dark-toned to sit on the obsidian background,
  often with a lime/teal duotone gradient overlay.

## Motion

- Scroll-linked: sections reveal with opacity+y via framer-motion
  `whileInView` (viewport once), charts draw in on view, hero parallax on the
  landing page.
- Action-linked: rep-ring pulses on each rep; buttons press with slight scale;
  cards hover-lift 2px with border-brighten.
- Loading: branded logomark pulse + skeleton shimmer panels, never plain
  spinners. `Spinner` primitive renders the logomark version.
- Always respect `prefers-reduced-motion`.
