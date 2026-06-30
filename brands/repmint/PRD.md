# Product Vision - RepMint

## 1. App Overview

RepMint is a camera-based training companion that feels like a personal trainer in your pocket. It gives users goal-based training plans, live camera coaching, rep counting, time-under-tension tracking, set review, and progress tracking across everyday strength and mobility work.

The product should move beyond a single set demo. The core promise is: choose a goal, follow a plan, train with camera-based feedback, and review what to focus on next.

RepMint is not clinical guidance and should not promise injury prevention, perfect form, or guaranteed results. It helps users train with more awareness, better control, and more consistent follow-through.

## 2. Product Pillars

- Goal-based plans: users choose goals such as strength foundation, muscle building, mobility, consistency, return-to-gym confidence, or technique practice.
- Daily training hub: RepMint recommends today's session, shows current plan progress, streak, recent work, and practical AI recommendations.
- Camera-based coaching: phone or webcam tracking detects movement, counts reps, estimates tempo and time under tension, and shows one useful cue at a time.
- Training intelligence: RepMint can recommend exercises, rest, mobility, supersets, tempo targets, and next-session focus based on goals and recent sessions.
- Progress tracking: users can review sessions, plan adherence, active time, consistency, rep quality trends, TUT targets, and movement history.
- Movement library: movements are profile-driven so RepMint can grow beyond squats into lunges, push-ups, hinges, planks, mobility drills, and programmed workouts.

## 3. Primary User Journey

1. User opens RepMint and completes onboarding.
2. User chooses a training goal, experience level, equipment, schedule, and coaching preferences.
3. RepMint creates or recommends a plan.
4. Daily hub shows the next session and smart recommendations.
5. User starts a workout, chooses or follows the prescribed movement block, and places the camera in view.
6. Active set mode tracks reps, form signals, tempo, time under tension, and set duration.
7. RepMint gives short real-time cues and optional haptic/audio prompts.
8. After the set, the user reviews reps, TUT, tempo, range/control notes, and next focus.
9. Session history and progress views update plan progress, trends, and recommendations.

## 4. Key Screens

- Onboarding welcome: explains RepMint as an AI camera coach and asks the user to start training setup.
- Goal setup: collects goal, level, available equipment, schedule, movement preferences, and coaching intensity.
- Daily training hub: shows today's recommended workout, plan progress, streak, smart recommendations, recent progress, and key metrics.
- Training programs: lists goal-based plans, plan phases, weekly sessions, supersets, progression rules, and saved programs.
- Active set coach: camera-first training screen with pose overlay, rep count, TUT timer, tempo, range/control cues, and start/end controls.
- Set review: summarizes reps, duration, TUT, tempo, range/control notes, and one next focus.
- Progress journey: visualizes consistency, active time, sessions completed, rep quality trends, movement history, and plan milestones.
- Settings/profile: manages user profile, coaching voice, haptics/audio, TUT preferences, camera calibration, device connections, privacy links, and app status.

## 5. Movement And Workout Model

RepMint should use movement profiles rather than hard-coded exercise behavior.

Initial movement profiles:

- Squat
- Lunge
- Push-up
- Hip hinge
- Plank
- Mobility drill

Each movement profile can define landmarks, phases, rep-completion rules, tempo targets, TUT expectations, common cues, camera framing guidance, and summary logic.

Workout plans can compose profiles into sets, circuits, supersets, warmups, main blocks, finishers, and mobility recommendations. Superset support should include paired exercises, rest guidance, set order, completion state, and post-block review.

## 6. AI Recommendation Behavior

AI recommendations should feel trainer-like, specific, and practical.

Examples:

- Lower-body mobility before a squat-heavy day.
- Adjusted tempo target after rushed reps.
- Rest or lighter session after high recent workload.
- Superset suggestion for a goal and available equipment.
- Next focus based on recurring cue history.

Recommendations must be framed as coaching suggestions, not medical or safety instructions. Avoid hidden scoring. Show the reason behind recommendations in plain language.

## 7. Technical Direction

Current implementation is a Next.js RepMint landing/product surface. Future app build should preserve the visual system from `brands/repmint/reference/stitch_repmint_design_system` while moving toward real product flows.

Recommended architecture:

- Next.js app shell.
- Browser camera APIs.
- In-browser pose estimation.
- Canvas pose overlay.
- Movement profile configuration.
- Deterministic rep/state machines.
- TUT and tempo calculation helpers.
- Plan/session data model.
- Local-first prototype storage, then authenticated backend when progress history and plans need persistence.
- Optional integrations for wearable signals and equipment later.

## 8. Data Model

Core entities:

- User profile: name, level, goals, equipment, schedule, coaching preferences.
- Training plan: goal, duration, phase, weeks, sessions, progression rules.
- Workout session: date, plan reference, blocks, movements, total time, completion.
- Exercise block: sets, reps or time, TUT target, rest, superset pairing.
- Set result: reps, duration, TUT, tempo, range/control notes, cues triggered, next focus.
- Movement profile: landmarks, thresholds, cue library, summary rules.
- Recommendation: type, reason, action, related plan/session/movement.
- Device setting: camera calibration, haptic/audio preference, connected devices.

## 9. Design Direction

The updated design system is Kinetic Performance: a premium dark fitness-tech interface with an obsidian base, electric lime action states, mint live status, monospaced metrics, and a camera-first training surface.

Design rules:

- Product-led first screen.
- Camera and plan context are the main surfaces.
- Metrics must be glanceable from a few feet away.
- Cue text should be short, supportive, and readable during movement.
- Daily hub should feel like a trainer's plan for today, not a generic dashboard.
- Sample/demo numbers must be labeled as sample output.
- Avoid clinical, fear-based, or guaranteed-outcome copy.

## 10. Out Of Scope For First Build

- Medical advice or injury claims.
- Guaranteed form/performance outcomes.
- Full nutrition coaching.
- Payments and commerce.
- Social feed or public leaderboard.
- Trainer marketplace.
- Every exercise type.
- Unexplained black-box scoring.

## 11. Definition Of Done For V1 Product Prototype

- User can complete onboarding and receive a goal-based starter plan.
- Daily hub shows today's session, current plan progress, and smart recommendations.
- User can start an active set for at least the initial movement profiles.
- Camera coach shows reps, TUT, tempo/range/control signals, and one live cue at a time.
- Set review summarizes what happened and what to focus on next.
- Progress view reflects completed sessions and trend-style metrics.
- Settings include coaching preferences and camera/device calibration.
- Copy stays direct, supportive, trainer-like, and non-clinical.
