# App Plan - RepWise

## Overview

RepWise is a browser-based form coach and personal-trainer-style companion. It uses camera-based pose tracking to count reps, provide practical movement cues, and generate concise set summaries for common exercises.

The landing page presents RepWise as a broader movement coach, not a single-exercise demo.

## Core Experience

User flow:

1. Choose a movement.
2. Place phone or laptop camera in view.
3. Start training.
4. See rep count, movement state, range, tempo, and one cue.
5. End the set.
6. Read a short set review with next focus.

## Movement Profiles

RepWise should support a profile-driven approach.

Initial profiles:

- Squat
- Lunge
- Push-up
- Hip hinge
- Plank
- Mobility drill

Each movement profile can define:

- key landmarks
- movement phases
- rep-completion rules
- range targets
- tempo cues
- coaching language
- summary logic

This lets RepWise expand without hard-coding the whole product around one exercise.

## User Interface

The product should feel direct, athletic, and useful during movement.

Primary surfaces:

- Camera preview.
- Pose overlay.
- Movement picker.
- Rep count.
- Form cue.
- Range and tempo status.
- Start, end, and reset controls.
- Set summary.

The first screen should show the live coach preview immediately.

## Landing Page Goals

- Explain RepWise in one glance.
- Show the camera-based coach visually.
- Communicate multi-movement support.
- Make the product feel credible for home and gym use.
- Avoid clinical or exaggerated claims.

## Technical Direction

Preferred product stack for a future demo:

- React or Next.js.
- Browser camera APIs.
- In-browser pose estimation.
- Canvas overlay for landmarks and skeleton lines.
- Plain JavaScript angle helpers.
- Movement profile configuration.
- Deterministic movement state machines.
- Transparent scoring and cue rules.
- Local set summaries.

No backend is required for the current landing page.

## Safety And Claims

RepWise is a coaching aid. Keep all claims practical, transparent, and outcome-safe.

Use practical cues:

- Move with control.
- Keep your range consistent.
- Stay centered in frame.
- Slow the lowering phase.
- Good rep.

Avoid fear-based or clinical language.

## Out Of Scope For The Landing Page

- Accounts.
- Payments.
- Saved history.
- Camera recording.
- Clinical analysis.
- Safety-outcome claims.

## Definition Of Done

- Public page says RepWise only.
- Page communicates form coaching beyond one movement.
- Generated visual asset is used in the hero.
- Sample output is clearly framed.
- Build passes.
- Changes are pushed to GitHub.
