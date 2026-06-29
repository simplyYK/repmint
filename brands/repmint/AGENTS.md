# AGENTS.md: RepMint Build

RepMint is a camera-based form coach and personal-trainer-style companion for everyday workouts.

The product uses a phone or webcam to observe movement, count reps, surface simple coaching cues, and summarize sets. It should feel useful for common strength and mobility movements, not only squats.

## Single Brand Rule

This repo is RepMint only.

Do not use unrelated brand, wellness, or commerce language.

## Product Positioning

RepMint helps users train with more awareness when a coach is not nearby.

Preferred terms:

- form coach
- trainer-style guidance
- personal trainer in your pocket
- camera-based feedback
- movement profiles
- exercise library
- rep counting
- set review
- practical coaching cues

Avoid positioning RepMint as a clinician, medical product, or replacement for professional instruction.

## Experience Goal

A polished product flow should let a user:

1. Open RepMint.
2. Choose a movement.
3. Place their phone or laptop camera in view.
4. Start a set.
5. See rep count and one live cue.
6. End the set.
7. Review a concise set summary.

## Architecture Direction

Future implementation should keep pose logic separate from movement rules.

Suggested structure:

```text
src/
  components/
    CameraView.jsx
    MetricsPanel.jsx
    CuePanel.jsx
    SummaryPanel.jsx
    MovementPicker.jsx
  pose/
    createPoseLandmarker.js
    usePoseLandmarks.js
    drawPoseOverlay.js
    landmarkUtils.js
  movement/
    angles.js
    movementStateMachine.js
    movementScoring.js
    smoothing.js
  data/
    movementProfiles.js
```

Movement profiles can define landmarks, phases, thresholds, scoring rules, and cue text for squats, lunges, push-ups, hinges, planks, and mobility drills.

## Claim Safety

RepMint is not clinical guidance.

Never make clinical, safety, replacement, or guaranteed-outcome claims.

Use safer phrasing:

- train with more awareness
- move with better control
- get clear feedback
- review what to focus on next
- build more consistent reps

## Landing Page Rules

- First screen should show the product experience.
- Use real or generated visuals for major product moments.
- Keep cues short.
- Keep sample numbers clearly framed as examples.
- Make the product broader than a squat demo.
- Keep CTAs short and consistent.
