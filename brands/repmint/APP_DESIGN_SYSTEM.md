# RepMint App Design System

## 1. Product Read

RepMint is a camera-based form coach for everyday workouts. The actual app should feel like a focused training companion: fast to start, readable from a few feet away, supportive during movement, and credible without sounding clinical.

Primary user task:

1. Choose a movement.
2. Place the phone or laptop camera in view.
3. Start a set.
4. Follow one live cue at a time.
5. End the set.
6. Review a short, useful summary.

Design principles:

- The camera view is the main surface.
- The cue is the most important text during a set.
- Metrics must be glanceable while the user is moving.
- Controls must be easy to hit with sweaty hands.
- Feedback should be practical, not judgmental.
- Every loading, permission, no-person, tracking, active, paused, ended, and error state must feel designed.

## 2. Brand Tokens

Use semantic tokens in code. Avoid hard-coding raw colors inside components.

```css
:root {
  color-scheme: dark;

  --bg: #080a0d;
  --bg-raised: #0e1319;
  --surface: #141a22;
  --surface-raised: #1c2430;
  --surface-strong: #263342;

  --text: #f4f7fb;
  --text-soft: #c8d2df;
  --text-muted: #8794a4;
  --text-inverse: #10141b;

  --line: rgba(244, 247, 251, 0.12);
  --line-strong: rgba(244, 247, 251, 0.22);

  --accent: #b7ff3c;
  --accent-soft: rgba(183, 255, 60, 0.14);
  --accent-strong: #d7ff86;

  --live: #48e5c2;
  --warn: #ffb84d;
  --critical: #ff6b7f;

  --camera-bg: #05070a;
  --overlay-line: rgba(183, 255, 60, 0.92);
  --overlay-joint: #f4f7fb;

  --radius-sm: 10px;
  --radius-md: 16px;
  --radius-lg: 24px;
  --radius-pill: 999px;

  --shadow-panel: 0 28px 90px rgba(0, 0, 0, 0.44);
  --focus-ring: 0 0 0 4px rgba(183, 255, 60, 0.24);
}
```

Color usage:

- `--accent`: primary actions, active tracking, key metric values.
- `--live`: secondary live status, not CTA color.
- `--warn`: fixable coaching cue.
- `--critical`: camera or permission failure, not body safety language.
- Never use purple AI gradients or pure black/pure white.

## 3. Typography

Recommended stack:

```css
--font-display: "Satoshi", "Geist", system-ui, sans-serif;
--font-ui: "Geist", "Inter", system-ui, sans-serif;
--font-mono: "JetBrains Mono", "SFMono-Regular", ui-monospace, monospace;
```

Type scale:

```css
--type-title: clamp(28px, 5vw, 48px);
--type-section: clamp(22px, 3vw, 32px);
--type-body: 16px;
--type-small: 13px;
--type-metric: clamp(48px, 10vw, 88px);
--type-cue: clamp(22px, 5vw, 40px);
```

Rules:

- Rep count uses mono or tabular numbers.
- Cue text uses large UI type, not display typography.
- Labels are short and scannable.
- Body text should be at least 16px on mobile.
- Letter spacing stays `0` except compact uppercase labels.

## 4. App Shell

Mobile-first layout:

```text
Top bar
Movement picker
Camera stage
Live cue
Metric strip
Controls
Summary drawer or panel
```

Desktop layout:

```text
Top bar
Main grid
  Left: camera stage
  Right: metrics, movement, controls, summary
Bottom: cue panel or session timeline
```

Sizing:

- Page padding: 16px mobile, 24-32px desktop.
- Top bar height: 56px mobile, 64px desktop.
- Touch targets: minimum 44px.
- Camera stage: `aspect-ratio: 3 / 4` mobile, `16 / 10` desktop.
- Use `min-height: 100dvh`, not `100vh`.

## 5. Navigation

Top bar content:

- RepMint wordmark.
- Camera status chip.
- Optional settings/debug icon.

Status chip labels:

- `Camera off`
- `Loading model`
- `Ready`
- `Tracking`
- `No person`
- `Set active`

The current status must be visible at all times. Do not hide it in a menu.

## 6. Movement Picker

Purpose: choose the movement profile before training.

Component anatomy:

- Section label: `Movement`
- Selected movement pill.
- Horizontal segmented list or bottom sheet.
- Optional movement note: `Best with full body in frame`.

Initial movement options:

- Squat
- Lunge
- Push-up
- Hip hinge
- Plank
- Mobility

States:

- Default: movement can be changed.
- Set active: movement is locked.
- Unsupported: disabled with `Coming soon`.
- Loading profile: skeleton row, no spinner.

## 7. Camera Stage

The camera stage is the app’s hero component.

Layer order:

1. Video.
2. Pose skeleton.
3. Joint points.
4. Minimal status overlay.
5. Cue highlight.
6. Controls outside the video whenever possible.

Required states:

- Camera permission needed.
- Camera loading.
- Model loading.
- No person detected.
- Too close.
- Too far.
- Tracking.
- Low confidence.
- Set paused.

Camera empty copy:

- `Camera access is needed for live coaching.`
- `Step back so your full body is visible.`
- `Move into frame to start tracking.`
- `Hold still for a second.`

Do not draw stale pose lines when tracking confidence is low.

## 8. Pose Overlay

Overlay visual rules:

- Lines: 2px desktop, 1.5px mobile.
- Joints: 5-7px.
- Primary overlay color: `--overlay-line`.
- Warning overlay color: `--warn`.
- Hide low-confidence points instead of drawing noisy points.

Movement-specific focus:

- Squat: shoulders, hips, knees, ankles.
- Lunge: hips, knees, ankles, torso.
- Push-up: shoulders, elbows, hips.
- Hinge: shoulders, hips, knees, torso.
- Plank: shoulders, hips, ankles.
- Mobility: movement-specific key landmarks only.

Avoid clutter:

- No angle labels in normal mode.
- No debug numbers in user mode.
- No more than one cue highlight at once.

## 9. Live Cue Panel

The cue is the most important element during a set.

Component anatomy:

- Cue text.
- Cue tone.
- Optional short subcue.

Tone examples:

- Positive: `Good rep`
- Coaching: `Move with control`
- Range: `Keep your range consistent`
- Frame: `Stay centered in frame`
- Tempo: `Slow the lowering phase`
- Camera: `Step back into frame`

Rules:

- Keep cue text under 7 words when possible.
- Use `aria-live="polite"`.
- Do not update more than once every 1.5 seconds.
- Do not use fear-based language.
- Do not claim safety or clinical outcomes.

## 10. Metrics

Primary metric:

- Reps.

Secondary metrics:

- Tempo.
- Range.
- Control.
- Set time.
- Next focus.

Metric card anatomy:

- Label.
- Large value.
- Small helper.

Example:

```text
Reps
12
sample set
```

Rules:

- Use sample labels for demo data.
- Do not use fake precision such as `97.8%`.
- Avoid progress bars as the default. Prefer words and numbers.
- Use color plus text, never color alone.

## 11. Controls

Primary controls:

- `Start Set`
- `End Set`
- `Start New Set`

Secondary controls:

- `Reset`
- `Retry Camera`
- `Change Movement`
- `Pause`

Button rules:

- Primary button: accent background, dark text.
- Secondary button: surface background or outline, light text.
- Disabled button: visible but muted, with reason nearby.
- Loading button: keep width stable and label clear.
- Press state: slight downward movement or scale.

Do not use multiple labels for the same action. Pick one label per intent.

## 12. Set Summary

The summary should be short, useful, and easy to act on.

Component anatomy:

- `Set summary` title.
- Total reps.
- Duration.
- Range status.
- Tempo status.
- Next focus.
- One coaching note.
- `Start New Set` button.

Example summary:

```text
Set summary
12 reps
Tempo: Steady
Range: Clean
Next focus: Control

Good set. Keep your range consistent and stay patient through the lowering phase.
```

Keep the coaching note under 30 words.

## 13. Loading, Empty, And Error States

Loading states:

- Camera shell skeleton.
- Model loading status chip.
- Metrics placeholders shaped like final cards.

Empty states:

- No camera permission.
- No person in frame.
- No movement selected.
- No completed set yet.

Error states:

- Camera blocked.
- Camera unavailable.
- Model failed to load.
- Tracking confidence too low.

Error copy should explain the action:

- `Allow camera access in your browser settings.`
- `Close other apps using your camera, then retry.`
- `Check your connection and reload the model.`

## 14. Motion

Motion should communicate status and progression.

Allowed motion:

- Status chip pulse while tracking.
- Pose joints subtle pulse.
- Cue panel entrance.
- Summary drawer slide.
- Button press response.
- Movement picker selection transition.

Timing:

- Micro-interactions: 150-220ms.
- Panel transitions: 240-320ms.
- Cue entrance: 180-240ms.

Rules:

- Animate only transform and opacity.
- Respect `prefers-reduced-motion`.
- Do not animate the camera feed itself.
- Avoid decorative loops that compete with training.

## 15. Accessibility

Required:

- All controls keyboard reachable.
- Focus ring visible and not clipped.
- Every button has a visible label or accessible name.
- Camera status is text, not color only.
- Cue panel uses polite live region.
- Error text appears near the affected action.
- All touch targets are at least 44px.
- Contrast passes WCAG AA.

Reduced motion:

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation: none !important;
    transition-duration: 1ms !important;
    scroll-behavior: auto !important;
  }
}
```

## 16. Responsive Rules

Mobile:

- Camera first.
- Cue directly under camera.
- Metrics in a 2-column grid or horizontal snap row.
- Controls sticky near bottom only if they do not cover the camera.

Tablet:

- Camera first, metrics to the side if space allows.
- Movement picker can become a segmented row.

Desktop:

- Camera left.
- Metrics and controls right.
- Summary can appear as a side panel.

Never allow horizontal scroll at 360px width.

## 17. Copy Guidelines

Voice:

- Direct.
- Calm.
- Supportive.
- Trainer-like, not clinical.

Use:

- `Move with control`
- `Good rep`
- `Keep your range consistent`
- `Stay centered in frame`
- `Slow the lowering phase`
- `Start Set`
- `End Set`
- `Set summary`

Avoid:

- Clinical promises.
- Fear-based warnings.
- Guaranteed outcomes.
- “Perfect form” language.
- Claims that the app replaces a professional.

## 18. Component Inventory

Core components:

- `AppShell`
- `TopBar`
- `CameraStage`
- `PoseOverlay`
- `MovementPicker`
- `CuePanel`
- `MetricsPanel`
- `ControlBar`
- `SummaryPanel`
- `PermissionState`
- `TrackingEmptyState`
- `ErrorState`
- `DebugPanel`

Debug-only components must be hidden from normal users.

## 19. Quality Checklist

Before shipping app UI:

- Camera is visually dominant.
- Cue can be read from a few feet away.
- Start and End controls are obvious.
- No clinical or safety-outcome claims.
- No squat-only assumptions in shared components.
- Movement-specific logic lives in movement profiles.
- Loading, empty, error, active, paused, and summary states exist.
- Mobile layout works at 360px.
- Focus states are visible.
- Reduced motion is respected.
- Sample metrics are labeled when data is mocked.
