# RepMint Visuals Library

Self-contained React/SVG visuals for the RepMint app. Pure React + inline SVG
+ scoped CSS (`visuals.css`, class prefix `rmviz-`). No external images, no
new npm dependencies. Server-component-safe by default — nothing here uses
hooks or browser APIs, so every component can be rendered from a server
component; CSS keyframe animation needs no `"use client"` directive.

Import everything from the barrel:

```ts
import {
  MuscleMap,
  MovementGlyph,
  EmptyState,
  HeroVisual,
} from "@/app/components/visuals";
```

The barrel (`index.ts`) imports `visuals.css` exactly once — you don't need
to import the stylesheet yourself.

## `MuscleMap`

```ts
MuscleMap({ primary, secondary, className }: {
  primary: MuscleGroup[];
  secondary: MuscleGroup[];
  className?: string;
})
```

Renders an original front + back human silhouette pair (side by side, SVG,
hand-authored paths — not clip-art) with one region per `MuscleGroup` from
`app/lib/movements/types.ts`: chest, back, shoulders, biceps, triceps,
forearms, quads, hamstrings, glutes, calves, core, obliques, hip_flexors,
adductors, abductors, traps, lats, lower_back, full_body.

- Regions listed in `primary` render filled mint (`--accent`).
- Regions listed in `secondary` render dimmer mint/outline (`--accent-2`
  translucent).
- Everything else renders as a neutral dark region on the outline body.
- `full_body` in `primary` lights every region primary; in `secondary` it
  lights every region secondary (soft full-body highlight).
- Region fill/stroke transitions are animated (420ms cubic-bezier) so
  swapping props (e.g. switching selected exercise) transitions smoothly.

Note: front and back views necessarily emphasize different muscles per
anatomy (e.g. triceps/glutes/hamstrings/lats/traps/lower_back only really
read on the back view; chest/biceps/abs/hip_flexors only read on the front) —
this mirrors how real anatomy charts work. A group with no visual counterpart
on a given view simply won't have geometry drawn there.

## `MovementGlyph`

```ts
MovementGlyph({ category, animated, className }: {
  category: string;
  animated?: boolean;
  className?: string;
})
```

Minimal stroke-based (`currentColor`-friendly) line-figure icon, one per
movement category: `legs` (squat), `hinge` (hip hinge), `push` (push-up),
`pull` (row/pull-up), `core` (plank), `shoulders` (overhead press), `arms`
(curl), `mobility` (stretch/reach), `machines` (seated machine), `conditioning`
(running figure). Any unrecognized `category` string renders a neutral
dumbbell glyph instead of crashing — pass any free-text category safely.

When `animated` is true, a subtle category-specific CSS keyframe loop plays
(bob, hinge tilt, pull shift, press lift, curl rotate, sway, run bounce).
Respects `prefers-reduced-motion` (animation is disabled entirely).

Since it's `currentColor`-based, wrap it in an element with `color: var(--accent)`
(or similar) to theme it, e.g. `<div style={{ color: "var(--accent)" }}><MovementGlyph category="push" /></div>`.

## `EmptyState`

```ts
EmptyState({ name, className }: {
  name: "history" | "plan" | "coach" | "workouts" | "insights";
  className?: string;
})
```

Five distinct illustrated empty-state scenes sized for empty screens
(`viewBox="0 0 200 160"`, scales with container width):

- `history` — empty calendar grid with a single ghosted, dashed-ring session dot.
- `plan` — a dotted path to a flag, signaling "no plan mapped out yet."
- `coach` — a chat bubble with a soft typing-dot row.
- `workouts` — a clipboard/template card next to a dumbbell.
- `insights` — a dashboard frame with a flatlining-to-rising sparkline.

## `HeroVisual`

```ts
HeroVisual({ className }: { className?: string })
```

The landing-page marquee visual: a stylized mid-squat figure with a
pose-tracking skeleton overlay (13 joints, connecting limb lines, pulsing
dots) plus three floating metric chips — Reps, Form %, TUT — that gently
float and the Form chip pulses via CSS. Fully self-contained (SVG figure +
skeleton + absolutely-positioned HTML chip overlays in one wrapper `div`);
give the wrapper a sized parent (e.g. `aspect-ratio: 4/5` as used by
`.hero-stage` in `globals.css`) since the SVG and chips fill 100%/100%.

## Design tokens

`visuals.css` mirrors the app's dark/mint token set as local custom
properties (`--rmviz-*`), falling back to the real `--bg`/`--accent`/etc.
tokens defined in `app/globals.css` when present (they're read via
`var(--accent, #b7ff3c)` fallback chains), so these components pick up the
live theme automatically when rendered inside the app shell, and still look
correct in isolation (e.g. Storybook, a design-review sandbox) if
`globals.css` isn't loaded.

## Accessibility

- All SVGs carry `role="img"` + descriptive `aria-label`.
- All animation is gated behind `@media (prefers-reduced-motion: reduce)` —
  animations are removed entirely, not just shortened.
- No component reads or requires JS at render time; the CSS keyframe loops
  run without any client-side logic.
