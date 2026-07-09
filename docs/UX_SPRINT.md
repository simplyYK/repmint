# Sprint brief — 2026-07-09 "Kinetic Precision" uplift

Shared context for all implementation agents. Read docs/DESIGN_SYSTEM.md first.
Palette/tokens are in app/globals.css — use existing CSS vars, never hardcode
new colors. Page-scoped styles go in the page's own .css file (NEVER edit
app/globals.css — the orchestrator owns it).

## Personas (IE University demographic)

1. **Mateo — between-classes optimizer** (26, MiM). Trains in fixed 45-75 min
   windows. Two app opens: night-before (pick), at-gym (run). Abandons flows
   with >2 decisions. Wants est. duration on everything, week-over-week data,
   and a sanctioned shorter version when a class runs over.
2. **Priya — intimidated home beginner** (22, exchange student, dorm room, no
   equipment). Will never build a workout from a blank builder. Needs
   ready-made room-friendly routines, plain language, private-by-design camera
   ("pose tracking runs on your device"), and "you did it right" feedback.
3. **Lukas — streak-driven hybrid** (29, MBA, ex-athlete). Checks streak every
   morning. Needs a legit 12-15-min minimum session to protect the streak, one
   calendar for every session type, and shareable on-brand stat cards.

## Signature visual moves (from Stitch "Kinetic Precision")

- Real athlete photography with dark duotone overlays on hero cards
  (public/images/athletes/: squat-rack.jpg, deadlift.jpg, home-training.jpg,
  kettlebell.jpg, pushup.jpg, focus.jpg).
- Instrument-panel labels (uppercase, 0.1em tracking), lime numerals for hero
  metrics, teal for secondary/status.
- Pill buttons only; glass overlays (blur + 1px line); lime glow on active
  (`--glow-accent`).
- Scroll-linked reveals: use the `Reveal` primitive from
  app/components/ui/primitives.tsx (framer-motion whileInView) for section
  entrances; charts draw in on view. Respect prefers-reduced-motion.
- Display font: Hanken Grotesk via `var(--font-display)` (weights 600-800).

## Sprint scope by owner

- Hub (agent): time-aware hero CTA + short-version pill, athlete-image hero,
  streak-guard state, "Repeat last workout" quick action, first-run 3-choice
  card, scroll reveals.
- Workouts (agent): starter-template empty state (3 cards), "Jump back in"
  resume card, duration+equipment badges + filter chips, duplicate-and-edit,
  plan .ics export button.
- Progress (agent): charts draw-in, monthly consistency framing, share-ready
  polish.
- Train (orchestrator): session launcher, camera setup/privacy screen, HUD
  (cue banner, rep ring, glass stat bar), voice coach, rep quality, fatigue.
- ML modules (agent): pure TS libs under app/lib/tracking/ + app/lib/pose/.
- Coach dock (orchestrator): floating context-aware coach on all pages.
