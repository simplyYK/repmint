# RepMint Product Plan

## Overview

RepMint is a camera-based training companion that feels like a personal trainer in your pocket. It gives users goal-based training plans, live camera coaching, rep counting, time-under-tension tracking, set review, smart recommendations, and progress tracking.

The product direction is broader than a landing page or single-exercise demo. RepMint should help a user choose a goal, follow a plan, train with camera-based feedback, review what happened, and know what to focus on next.

## Core Promise

Your AI camera coach for goal-based training.

RepMint helps users train with more awareness by turning camera movement tracking into practical cues, plan guidance, sample metrics, and progress summaries.

## Primary User

- Home workout users training without a coach nearby.
- Beginners who want clearer feedback during common exercises.
- Gym users who want rep counting, TUT, supersets, and set review without extra hardware.
- People following goal-based plans who want daily recommendations and progress tracking.
- Fitness-curious testers evaluating whether camera-based coaching feels useful.

## Product Pillars

- Goal-based plans for strength foundation, muscle building, mobility, consistency, technique practice, or return-to-gym confidence.
- Daily training hub with today's recommended session, current plan progress, streak, recent work, and practical AI recommendations.
- Active camera coach with pose overlay, rep count, time under tension, tempo, movement cues, and set controls.
- Workout structure for sets, circuits, supersets, warmups, finishers, rest, and progression.
- Set and session review with concise next-focus guidance.
- Progress journey with session history, active time, consistency, plan completion, rep quality trends, and movement history.
- Settings for user profile, coaching voice, haptics/audio, TUT targets, camera calibration, and device connections.

## First Experience

The first screen should show the product, not a generic hero. It should include:

- RepMint wordmark.
- Clear trainer-style value proposition.
- A training plan, daily recommendation, or camera coach preview.
- Generated or real training visual.
- Pose-tracking overlay.
- Sample live metrics labeled as sample output.
- Primary CTA: `Start Training`.

## Core Product Flow

1. Complete onboarding.
2. Choose a goal, level, equipment, schedule, and coaching preferences.
3. Receive a goal-based starter plan.
4. Open the daily hub and start today's recommended session.
5. Place the phone or laptop camera in view.
6. Complete sets, circuits, or supersets with rep counting, TUT, tempo/range/control feedback, and one live cue.
7. Review the set/session summary.
8. Track progress and receive the next recommendation.

## Movement Scope

RepMint should be positioned as multi-movement from the start.

Initial movement profiles may include:

- Squat
- Lunge
- Push-up
- Hip hinge
- Plank
- Mobility drill

Each movement profile can define landmarks, movement phases, rep rules, TUT/tempo targets, range/control cues, camera framing guidance, and summary logic.

## Technical Direction

The current implementation is a Next.js static/product surface. Future product code should use the imported Kinetic Performance design system at `brands/repmint/reference/stitch_repmint_design_system/`.

Future app code can use:

- Browser camera APIs.
- In-browser pose estimation.
- Canvas overlay for landmarks and skeleton lines.
- Movement profile configuration.
- Deterministic state machines for reps and phases.
- TUT and tempo calculation helpers.
- Goal-based plan and workout data models.
- Recommendation rules with clear user-facing reasons.
- Local-first prototype storage, then authenticated persistence when saved plans and progress are needed.

## Claim Safety

RepMint is coaching software, not clinical guidance.

Use practical wording:

- train with more awareness
- move with better control
- get clear real-time feedback
- review what to focus on next
- improve consistency over time
- adjust today's plan based on recent training

Avoid:

- clinical analysis
- safety or injury claims
- guaranteed performance or body-composition outcomes
- perfect-form claims
- replacement-for-professional claims
- fake precision

## Out Of Scope For First Build

- Medical advice or injury guidance.
- Guaranteed outcomes.
- Full nutrition coaching.
- Payments or commerce.
- Trainer marketplace.
- Social feed or leaderboard.
- Every possible exercise.
- Unexplained black-box scoring.

## Definition Of Done

- Public UI and metadata use RepMint only.
- The product communicates a broader training companion, not a squat-only demo.
- User can complete onboarding and receive a goal-based starter plan.
- Daily hub shows today's session, plan progress, and smart recommendations.
- Active set view shows camera coach, reps, TUT, tempo/range/control feedback, and one cue.
- Set/session review summarizes what happened and what to focus on next.
- Progress view reflects completed sessions and trends.
- Copy is concise, supportive, trainer-like, and claim-safe.
