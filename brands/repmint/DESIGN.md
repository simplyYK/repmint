# RepMint Design System

## 1. Design Read

RepMint is a real-time workout coaching app for a 4-hour hackathon demo. The interface should feel like a focused training tool: precise, energetic, readable during movement, and credible without pretending to be medical-grade. The first screen is the product experience itself, not a landing page.

Design direction:

- Aesthetic family: dark athletic interface with clean neon-lime feedback, graphite surfaces, and clear camera overlays.
- Audience: hackathon judges, fitness-curious testers, and developers evaluating whether the live webcam demo works.
- System foundation: React + Vite with native CSS variables and plain CSS. Do not add a heavy UI kit.
- Design dials: `DESIGN_VARIANCE 5`, `MOTION_INTENSITY 4`, `VISUAL_DENSITY 5`.
- Theme: dark-first, with high contrast and no section-level theme flips.

## 2. Experience Principles

- The camera feed is the hero. Every other UI element should help the user perform squats and understand feedback.
- Use fewer, clearer metrics. During movement, the user can only read big numbers and short cues.
- Feedback must be immediate, calm, and non-medical.
- State changes should feel tactile but not distracting.
- The app should look credible even when pose tracking is loading, missing, or uncertain.

## 3. Brand Tokens

Use this token set in `src/styles.css`.

```css
:root {
  color-scheme: dark;

  --bg: #090b0f;
  --bg-2: #10141b;
  --surface: #151a22;
  --surface-2: #1d2430;
  --surface-3: #263040;

  --text: #f4f7fb;
  --text-soft: #c6d0dc;
  --text-muted: #7f8a99;

  --line: rgba(244, 247, 251, 0.12);
  --line-strong: rgba(244, 247, 251, 0.22);

  --accent: #b7ff3c;
  --accent-2: #48e5c2;
  --accent-dark: #6fa81e;

  --warn: #ffb84d;
  --danger: #ff5c7a;
  --success: #75f08b;

  --video-bg: #05070a;
  --overlay-line: rgba(183, 255, 60, 0.92);
  --overlay-joint: #f4f7fb;
  --overlay-warn: #ffb84d;
  --overlay-danger: #ff5c7a;

  --font-display: "Satoshi", "Geist", system-ui, sans-serif;
  --font-ui: "Geist", "Inter", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", "SFMono-Regular", ui-monospace, monospace;

  --radius-sm: 10px;
  --radius-md: 16px;
  --radius-lg: 24px;
  --radius-pill: 999px;

  --shadow-panel: 0 24px 80px rgba(0, 0, 0, 0.38);
  --shadow-focus: 0 0 0 4px rgba(183, 255, 60, 0.22);

  --maxw: 1280px;
}
```

Color rules:

- `--accent` is the primary action and positive tracking color.
- `--accent-2` is used sparingly for secondary live data, never as a second CTA color.
- `--warn` means fixable form cue.
- `--danger` means tracking or camera issue, not a body safety warning.
- Avoid purple gradients, blue glows, pure black, pure white, and decorative color dots.

## 4. Typography

Recommended fonts:

- Display: Satoshi or Geist.
- UI and body: Geist or system UI.
- Metrics and debug values: JetBrains Mono.

Type scale:

```css
--type-hero: clamp(38px, 6vw, 72px);
--type-title: clamp(28px, 4vw, 44px);
--type-section: clamp(22px, 3vw, 32px);
--type-body: 16px;
--type-small: 13px;
--type-metric: clamp(44px, 8vw, 86px);
```

Usage:

- App name and major state titles use display font.
- Buttons, cues, labels, and body copy use UI font.
- Rep count, timer, angle debug values, and score numerals use mono or tabular numbers.
- Letter spacing should be 0 for normal text.
- Use uppercase only for compact metric labels, not every section.

## 5. Layout System

Desktop layout:

```text
Top bar
Main grid
  Left: video stage
  Right: metrics rail
Bottom or floating: cue panel and controls
```

Mobile layout:

```text
Top bar
Video stage
Cue panel
Metric cards
Controls
Summary panel when set ends
```

Spacing:

- Page padding: `16px` mobile, `24px-32px` desktop.
- Main gap: `16px` mobile, `24px` desktop.
- Panel padding: `16px` mobile, `20px-24px` desktop.
- Top bar height: `64px` desktop max, `56px` mobile.

Constraints:

- Use `min-height: 100dvh`, never `h-screen`.
- Video stage should use `aspect-ratio: 16 / 9` on desktop and `aspect-ratio: 3 / 4` or natural camera ratio on narrow mobile.
- Keep controls visible without scrolling on common laptop screens.
- Do not put cards inside cards.

## 6. Core Components

### Top Bar

Purpose: identity and system status.

Elements:

- Left: RepMint wordmark.
- Center or right: camera status chip.
- Optional right: debug toggle.

Style:

- Transparent over page background.
- Bottom border using `--line`.
- Status chip uses pill radius with clear text.

### Video Stage

Purpose: main coaching surface.

Elements:

- Webcam `<video>`.
- Matched `<canvas>` overlay.
- Tracking empty state overlay.
- Optional small corner badge for `Ready`, `Tracking`, or `No person`.

Style:

- Background `--video-bg`.
- Radius `--radius-lg`.
- Border `1px solid var(--line-strong)`.
- Shadow `--shadow-panel`.
- Overflow hidden.

Do not add decorative effects that obscure the body.

### Metrics Rail

Purpose: glanceable set status.

Cards:

- Reps.
- Form score.
- Phase.
- Timer.

Style:

- Use surface panels with `--radius-md`.
- Rep number should be the largest metric.
- Score should show numeric value and label, not a filled progress bar.
- Phase should use plain words: `Standing`, `Descending`, `Bottom`, `Ascending`.

### Cue Panel

Purpose: one immediate coaching instruction.

Style:

- Large readable text.
- Use accent border for positive cues, warn border for correction cues, danger border for camera or tracking issues.
- Keep message under 8 words when possible.

Approved cues:

- "Step back into frame"
- "Try a little more depth"
- "Keep your chest lifted"
- "Move with control"
- "Stay centered"
- "Good rep"

Avoid:

- "Dangerous form"
- "Prevents injury"
- "Fixes knee pain"
- "Medical-grade analysis"

### Controls

Purpose: start, end, reset, and retry.

Buttons:

- Primary: Start Set, End Set, Start New Set.
- Secondary: Reset, Retry Camera.

Style:

- Primary button uses `--accent` background and dark text.
- Secondary button uses transparent or `--surface-2` background and light text.
- All buttons use `--radius-pill`, 44px minimum height, and visible focus ring.
- Button text must stay on one line.

### Summary Panel

Purpose: post-set review.

Elements:

- Total reps.
- Average score.
- Best score.
- Duration.
- Common cue.
- Coaching summary paragraph.
- Start New Set button.

Style:

- Place over or below the main coach depending on viewport.
- Use a clear title: "Set summary".
- Keep the summary under 90 words.

## 7. Pose Overlay Visual Rules

Canvas overlay should be functional, not decorative.

Landmarks:

- Joints: small filled circles, `4px-7px` depending on viewport.
- Primary joints for squat: shoulders, hips, knees, ankles.
- Low-confidence landmarks can be hidden rather than drawn poorly.

Skeleton:

- Main lines use `--overlay-line`, 2px desktop, 1.5px mobile.
- Warning lines use `--overlay-warn`.
- Tracking failure should not draw stale skeletons.

Angle labels:

- Show only if useful for debugging or optional debug mode.
- Use mono font at 12px.
- Place labels near joints without covering the body.

Overlay hierarchy:

1. Video.
2. Skeleton lines.
3. Joint points.
4. Minimal status or cue highlight.
5. UI panels outside the canvas.

## 8. State Design

Loading:

- Show video stage shell with pulsing neutral blocks.
- Text: "Loading pose model".

Camera permission:

- Show clear message.
- Text: "Camera access is needed for live coaching."
- Button: "Retry Camera".

No person detected:

- Keep video visible.
- Text: "Step back so your full body is visible."

Tracking:

- Show landmarks, metrics, and cue.
- Camera status chip: "Tracking".

Set active:

- Start button becomes End Set.
- Timer runs.
- Metrics update.

Set ended:

- Freeze summary metrics.
- Keep last cue secondary to the summary.

Error:

- Use `--danger` sparingly.
- Explain what failed and what action the user can take.

## 9. Motion

Motion intensity is moderate. Use motion for feedback and state changes only.

Allowed:

- Button press: `transform: translateY(1px) scale(0.99)`.
- Panel entrance: opacity and `translateY(8px)` over 180ms.
- Score change: subtle numeric color flash for 200ms.
- Landmark drawing updates via canvas only.

Avoid:

- Parallax.
- Custom cursors.
- Scroll effects.
- Infinite animated backgrounds.
- Motion that competes with the user moving on camera.

Reduced motion:

- Disable panel entrance movement.
- Keep opacity transitions under 120ms.
- Do not animate score flashes.

## 10. Accessibility

- All interactive controls must be reachable by keyboard.
- Focus ring uses `--shadow-focus`.
- Buttons must meet WCAG AA contrast.
- Do not rely on color alone for score or cue state. Pair color with text.
- Use semantic buttons, headings, and status regions.
- Cue panel should use `aria-live="polite"` so screen readers can receive coaching updates without spam.
- Camera errors should use clear text, not only icons.

## 11. Responsive Rules

At widths below `768px`:

- Use one-column layout.
- Place video first, cue second, metrics third, controls fourth.
- Reduce metric card density.
- Keep rep count and cue visible near the video.
- Avoid tiny overlay labels.

At widths above `1024px`:

- Use video plus metrics rail.
- Keep summary in a side panel or centered modal-like panel after the set.
- Do not let top navigation wrap.

## 12. Copy Voice

Voice: concise, direct, supportive.

Good:

- "Start Set"
- "End Set"
- "Step back into frame"
- "Try a little more depth"
- "Good rep"
- "Set summary"

Bad:

- "Unlock perfect movement"
- "Prevent injury"
- "Fix your squat"
- "AI-powered biomechanics lab"
- "Revolutionize your fitness"

Rules:

- No medical claims.
- No fake precision.
- No long motivational paragraphs during active tracking.
- No decorative microcopy.
- No em dashes.

## 13. Implementation Notes

Suggested CSS structure:

```text
src/
  styles.css
  components/
    TopBar.jsx
    CameraView.jsx
    MetricsPanel.jsx
    CuePanel.jsx
    Controls.jsx
    SummaryPanel.jsx
```

Class naming:

- Use simple app-specific classes: `.app-shell`, `.top-bar`, `.video-stage`, `.metric-card`, `.cue-panel`, `.control-row`.
- Keep component CSS grouped by section in `styles.css`.
- Use CSS variables for all colors, radii, shadows, and font stacks.

Do not add:

- Tailwind unless already installed and preferred by the current project.
- shadcn/ui.
- Framer Motion or Motion.
- Large animation libraries.
- Icon libraries unless the UI needs non-text controls.

## 14. Quality Checklist

Before handing off:

- Camera feed is visually dominant.
- Pose overlay is aligned and readable.
- Rep count can be read from 6 feet away.
- Cue text can be understood during movement.
- Buttons pass contrast checks.
- Focus states are visible.
- No white text on bright accent buttons.
- No progress bars with heavy filled tracks.
- No purple-blue gradient background.
- No fake medical language.
- No auth, backend, history, or profile UI.
- Mobile layout keeps video, cue, and controls reachable.
- Empty, loading, error, tracking, active set, and ended set states are designed.
