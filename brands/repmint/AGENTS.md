# AGENTS.md: RepMint Build

RepMint is a camera-based training companion and trainer-style app for everyday exercise.

The product uses a phone or webcam to guide goal-based training plans, track form, count reps, estimate time under tension, support supersets and programmed workouts, summarize sets, and show progress over time. It should feel like a practical personal trainer in your pocket, not a clinical tool and not a squat-only demo.

## Single Brand Rule

This repo is RepMint only.

Do not use unrelated brand, wellness, supplement, marketplace, or commerce language.

## Canonical Files

- `brands/repmint/AGENTS.md`
- `brands/repmint/PRD.md`
- `brands/repmint/DESIGN.md`
- `brands/repmint/APP_DESIGN_SYSTEM.md`
- `brands/repmint/reference/stitch_repmint_design_system/`

## Updated Product Vision

RepMint should be built around five connected surfaces:

- Onboarding and goal setup.
- Daily training hub.
- Goal-based training programs.
- Active camera-based set coaching.
- Progress journey and settings.

The app should recommend what to train, guide the active set, review what happened, and update the user's plan/progress afterward.

## Preferred Product Language

Use:

- personal trainer in your pocket
- AI camera coach
- camera-based training companion
- goal-based training plans
- daily training hub
- smart recommendations
- movement profiles
- exercise library
- rep counting
- time under tension
- tempo tracking
- supersets
- set review
- progress tracking
- practical coaching cues

Avoid:

- medical advice
- clinical analysis
- injury prevention claims
- guaranteed outcomes
- perfect form claims
- replacement for a trainer or clinician
- sub-centimeter precision claims
- hypertrophy or body-change guarantees

## Core Experience Goal

A polished product flow should let a user:

1. Open RepMint.
2. Pick a goal and training preferences.
3. Receive a plan or daily recommendation.
4. Start a planned workout or movement.
5. Place their phone or laptop camera in view.
6. See rep count, TUT, tempo/range/control feedback, and one live cue.
7. Move through sets, circuits, or supersets.
8. End the set or workout.
9. Review a concise set/session summary.
10. Track plan progress and receive the next practical recommendation.

## First Movements

Initial movement profiles may include:

- Squat
- Lunge
- Push-up
- Hip hinge
- Plank
- Mobility drill

The first prototype may focus on a small subset, but shared copy, architecture, and brand positioning must remain broader than one movement.

## Architecture Direction

Keep pose detection, movement rules, training-plan logic, recommendations, and UI components separate.

Suggested structure:

```text
src/
  components/
    AppShell.jsx
    DailyTrainingHub.jsx
    ProgramCard.jsx
    CameraStage.jsx
    PoseOverlay.jsx
    MetricsPanel.jsx
    CuePanel.jsx
    ControlBar.jsx
    SetSummary.jsx
    ProgressJourney.jsx
    SettingsPanel.jsx
  pose/
    createPoseLandmarker.js
    usePoseLandmarks.js
    drawPoseOverlay.js
    landmarkUtils.js
  movement/
    movementProfiles.js
    angles.js
    movementStateMachine.js
    repCounter.js
    tutTracker.js
    tempoTracker.js
    movementScoring.js
    smoothing.js
  training/
    planProfiles.js
    workoutBuilder.js
    supersetRules.js
    recommendationRules.js
    progressSummary.js
  data/
    sampleUser.js
    samplePlans.js
    sampleSessions.js
```

Movement profiles define landmarks, phases, thresholds, TUT/tempo targets, scoring rules, and cue text.

Training plans define goal, phase, schedule, exercise blocks, supersets, rest, progression, and recommendation hooks.

## Design Direction

Use the Kinetic Performance design system from the package in `brands/repmint/reference/stitch_repmint_design_system/`.

Keep:

- Obsidian/dark fitness-tech base.
- Electric lime for primary actions and active tracking.
- Mint/teal for live status.
- Monospaced metrics for reps, timers, TUT, and plan progress.
- Camera-first active training layouts.
- Daily hub that feels like today's trainer plan.
- Short, readable cue text.

Avoid:

- Purple AI glow.
- Generic dashboards that hide the product.
- Clinical diagrams as the main brand expression.
- Busy overlays that obscure the athlete.
- Fake precision.

## Claim Safety

RepMint is coaching software, not clinical guidance.

Use safer phrasing:

- train with more awareness
- move with better control
- get clear real-time feedback
- review what to focus on next
- improve consistency over time
- adjust today's plan based on recent training

Never claim RepMint prevents injury, diagnoses problems, guarantees strength or muscle gain, or replaces a professional.

## Build Rules

- Keep the first screen product-led.
- For app screens, make the training plan, camera coach, or progress state visible immediately.
- Use real or generated visuals for major product moments.
- Keep CTAs short and consistent.
- Keep generated or demo numbers clearly framed as sample output.
- Make empty/loading/error states feel designed.
- Treat screenshots in the imported Stitch package as references, not production copy.
- Do not push old exports, zips, duplicate backup pages, temp folders, or screenshots unless explicitly requested.

## GitHub Push Security Rule

Each time new RepMint code is pushed to GitHub, spawn a subagent to run a security audit over the pushed code before considering the push complete.

The audit must check for private or sensitive information in source, assets, configuration, logs, generated files, and documentation, including API keys, tokens, secrets, credentials, personal data, private URLs, environment values, and accidental local artifacts.

If private information is found, stop and report the finding before any follow-up release, PR, or deployment step.
