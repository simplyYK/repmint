# RepMint Design System

## Design Read

RepMint is a camera-based form coach and personal-trainer-style companion. The experience should feel focused, athletic, credible, and easy to read during movement.

Design direction:

- Aesthetic: premium dark fitness tech.
- Palette: graphite, charcoal, chrome, and one lime action accent.
- Audience: home workout users, gym users, beginners, and product reviewers.
- Visual assets: generated or real training photography with subtle pose-tracking overlays.
- Motion: light feedback motion only.
- Theme: dark-first and consistent across the whole page.

Design dials:

- `DESIGN_VARIANCE 7`
- `MOTION_INTENSITY 5`
- `VISUAL_DENSITY 5`

## Brand Tokens

```css
:root {
  --bg: #080a0d;
  --bg-2: #0e1319;
  --surface: #141a22;
  --surface-2: #1c2430;
  --text: #f4f7fb;
  --text-soft: #c8d2df;
  --text-muted: #8794a4;
  --line: rgba(244, 247, 251, 0.12);
  --accent: #b7ff3c;
  --accent-2: #48e5c2;
  --warn: #ffb84d;
  --radius-md: 16px;
  --radius-lg: 24px;
  --radius-pill: 999px;
}
```

Use `--accent` for CTAs, tracking lines, positive live feedback, and key sample metrics. Use `--accent-2` sparingly for secondary live-data detail.

## Typography

- Display: Satoshi, Geist, or system sans.
- UI: Geist or system sans.
- Metrics: JetBrains Mono or system monospace.
- Letter spacing should be 0 for normal text.
- Use uppercase only for compact labels.

## Layout

Desktop:

```text
Top bar
Hero
  Left: tight value proposition
  Right: large coach preview with image, overlay, metrics
Signal strip
Movement profiles
Phone result preview + how it works
Benefits
Set summary CTA
Footer
```

Mobile:

```text
Top bar
Coach preview
Hero copy
Signal strip
Movement profiles
Phone preview
Benefits
Set summary CTA
Footer
```

The product surface should appear quickly on mobile.

## Visual Asset Rules

- Hero should use a real or generated training visual.
- Overlay should be functional and subtle.
- Do not use fake dashboards made of generic rectangles.
- Do not obscure the athlete with too many lines or labels.
- Avoid purple AI glow.
- Avoid stock-photo gym clichés.

## UI Components

### Top Bar

- Wordmark left.
- Three or fewer nav links.
- Primary CTA right.
- Height under 72px.

### Coach Preview

- Generated training image.
- Subtle pose overlay.
- Tracking chip.
- Local session chip.
- One cue panel.
- Metrics rail with one featured metric.

### Movement Cloud

- Shows common exercises as capability examples.
- Should feel like a growing library, not a hard promise that every movement is perfect.

### Phone Preview

- Shows set complete, next focus, and a few result rows.
- Use product-like UI, not a fake screenshot.

### Summary

- Label sample/demo data clearly.
- Show a short coaching note under 30 words.

## Copy Voice

Voice: concise, supportive, practical.

Good:

- Your form coach, in your pocket.
- Move with control.
- Choose a movement.
- Start Training.
- Set complete.
- Next focus.

Avoid:

- Clinical promises.
- Pain or safety claims.
- Guaranteed outcomes.
- Perfect every rep.
- Replace your trainer.
- Works for every exercise.

## Accessibility

- Button text must pass contrast.
- Focus states must be visible.
- Do not rely on color alone.
- Use semantic headings.
- Keep cue text short and readable.
- Respect reduced motion.

## Quality Checklist

- RepMint only.
- RepMint only.
- No squat-only positioning.
- Hero CTA visible without scroll.
- Generated visual renders correctly.
- Navigation stays on one line on desktop.
- Mobile layout is explicit.
- Sample numbers are labeled.
- No clinical or safety-outcome claims.
