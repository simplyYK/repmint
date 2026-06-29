# RepWise Product Plan

## Overview

RepWise is a camera-based form coach and trainer-style companion for everyday workouts. A user opens the app, chooses a movement, places a phone or laptop camera in view, performs a set, receives short real-time cues, and gets a concise set review afterward.

The landing page should make the product feel useful beyond one exercise: RepWise is for movement practice, rep counting, form awareness, and post-set guidance across common strength and mobility patterns.

## Core Promise

Your form coach, in your pocket.

RepWise helps users train with more awareness by turning camera-based movement tracking into practical cues, sample metrics, and set summaries.

## Primary User

- Home workout users training without a coach nearby.
- Beginners who want clearer feedback during common exercises.
- Gym users who want rep counting and set review without extra hardware.
- Fitness-curious testers evaluating whether camera-based coaching feels useful.

## First Experience

The first screen should show the product, not a generic hero. It should include:

- RepWise wordmark.
- Clear value proposition.
- Generated or real training visual.
- Pose-tracking overlay.
- Sample live metrics.
- One active cue.
- Primary CTA: `Start Training`.

## Product Flow

1. Choose a movement.
2. Set the phone or laptop camera in view.
3. Start a set.
4. See reps, range, tempo, and one coaching cue.
5. End the set.
6. Review the set summary and next focus.

## Movement Scope

RepWise should be positioned as multi-movement from the start.

Initial movement profiles may include:

- Squat
- Lunge
- Push-up
- Hip hinge
- Plank
- Mobility drill

Each movement profile can define its own landmarks, rep phases, scoring rules, and cue library.

## Technical Direction

The current landing page is a Next.js static export.

Future product code can use:

- Browser camera APIs.
- Pose estimation in the browser.
- Plain JavaScript angle math.
- Movement profiles in configuration.
- A movement state machine for rep phases.
- Transparent scoring rules.
- Local set summaries.

No backend is required for the landing page.

## Out Of Scope

- Clinical analysis.
- Safety-outcome claims.
- Health-condition guidance.
- Guaranteed performance improvement.
- Payment, accounts, or saved workout history for this landing page.

## Definition Of Done

- Public UI and metadata use RepWise only.
- Page communicates a broader form coach, not a squat-only demo.
- Hero has a real visual asset and product preview.
- Copy is concise, supportive, and claim-safe.
- Build passes.
- GitHub branch and PR are updated.
