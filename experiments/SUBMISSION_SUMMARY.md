# RepMint Experiment Submission Summary

## Idea Being Validated

RepMint is an AI camera trainer for solo workouts. It gives users goal-based training plans, camera-based form feedback, rep counting, time-under-tension tracking, supersets, set review, progress tracking, and practical recommendations.

## Top Three Experiments

### 1. Landing Page Smoke Test

Purpose:

Validate whether potential customers understand the promise and take action.

What will be tested:

- Value proposition: AI camera trainer for goal-based workouts.
- CTA: `Join Pilot`.
- Secondary action: `Take Survey`.
- Interest in plan + camera feedback + progress as one product.

Success metric:

- 8 percent or higher CTA click rate from qualified visitors.
- 3 percent or higher pilot request rate.
- 10 or more people agree to follow-up.

Launch asset:

- Updated RepMint landing page in `app/page.tsx`.

### 2. Goal-Based Training Survey

Purpose:

Validate the strongest segment, goal, pain point, and feature bundle before building.

What will be tested:

- Training frequency and solo training behavior.
- Biggest pain points in training alone.
- Interest in plans, camera feedback, rep counting, TUT, supersets, set review, and progress.
- Camera privacy comfort.
- Pilot interest.

Success metric:

- 60 percent or more rate goal-based plans useful.
- 50 percent or more rank camera set feedback in their top three features.
- 40 percent or more say yes or maybe to joining a pilot.
- Camera comfort averages 3.5 or higher out of 5.

Launch asset:

- `experiments/SURVEY.md`.

### 3. Concierge Camera-Coaching Pilot

Purpose:

Validate the real coaching loop before building full AI detection.

What will be tested:

- Goal setup.
- Short planned workout.
- Camera observation.
- Rep/TUT/tempo estimate.
- One cue at a time.
- Set review.
- Repeat intent.

Success metric:

- 8 completed sessions.
- Average usefulness rating of 4 or higher out of 5.
- 50 percent or more would use it weekly.
- 3 or more users ask to join another test.

Launch asset:

- `experiments/CONCIERGE_PILOT.md`.

## Why These Three Experiments

Together, the experiments test the idea from three angles:

- Demand: Will people click and volunteer?
- Direction: Which goals, pains, and features matter most?
- Experience: Does the coaching loop feel useful enough to repeat?

This prevents building a full app before validating whether users want the promise, trust the camera experience, and value the feedback.

## Launch Timeline

- Day 1: Launch landing page, publish survey, recruit pilot users.
- Days 2-4: Collect responses and run first pilot sessions.
- Days 5-6: Finish pilot sessions and analyze results.
- Day 7: Decide what to build first based on evidence.

