# RepMint Validation Plan

## Objective

Validate whether solo exercisers want RepMint: an AI camera trainer that creates goal-based plans, guides sets with camera feedback, tracks reps and time under tension, supports supersets, reviews progress, and recommends what to do next.

## Target Customer

Primary target for testing:

- People who train alone at home or in a gym 2-5 times per week.
- Beginners to intermediate exercisers who follow workouts but want clearer feedback.
- Users who care about consistency, form awareness, rep counting, tempo, and knowing what to do next.

Exclude for v1 testing:

- People seeking medical, rehab, injury, or clinical advice.
- Advanced athletes with an in-person coach for every session.
- Users who only want passive fitness content with no tracking.

## Core Assumptions

1. Users feel uncertain about form, reps, tempo, and whether they are progressing when training alone.
2. Users want a plan and daily recommendation more than a standalone rep counter.
3. Camera-based feedback feels acceptable if privacy is clearly explained.
4. Time under tension, tempo, and set review are valuable enough to motivate signup or pilot participation.
5. A concierge version can deliver enough perceived value before real-time AI is fully built.

## Experiment 1: Landing Page Smoke Test

### Goal

Measure whether the RepMint promise earns action from likely customers.

### Hypothesis

If solo exercisers understand the RepMint value proposition, at least 8 percent of qualified visitors will click `Join Pilot`, and at least 3 percent will submit an email or send a pilot request.

### Asset

Use the updated landing page in `app/page.tsx`.

Primary message:

> Your AI camera trainer for goal-based workouts.

Primary CTA:

> Join Pilot

Secondary CTA:

> Take Survey

### Audience And Channels

Run for 3-5 days with 100-300 targeted visitors.

Suggested channels:

- Classmates who work out.
- University gym groups.
- Fitness Discords or WhatsApp groups.
- Reddit communities where self-promotion is allowed.
- Instagram story poll/link from team members.
- Friends who train at home.

Recruiting copy:

> We are testing RepMint, an AI camera trainer for solo workouts. It creates goal-based plans, counts reps, tracks time under tension, and gives short set feedback through your phone camera. If you train alone, please look at the page and join the pilot or take the 3-minute survey.

### Metrics

- Visitors.
- CTA clicks.
- Pilot requests.
- Survey starts.
- Survey completions.
- Source channel.
- Device type.
- Free-text objections.

### Success Criteria

Strong signal:

- CTA click rate of 8 percent or higher among qualified visitors.
- Pilot request rate of 3 percent or higher.
- At least 10 people agree to a follow-up or concierge test.

Mixed signal:

- CTA click rate of 4-7 percent.
- Users like the concept but hesitate because of camera privacy, price, or trust.

Weak signal:

- CTA click rate below 4 percent.
- Users describe the idea as unclear, unnecessary, or too similar to existing apps.

### Decision

- If strong: proceed to concierge pilot and refine onboarding.
- If mixed: narrow positioning around the strongest segment or goal.
- If weak: revisit the problem and test a different promise before building.

## Experiment 2: Goal-Based Training Survey

### Goal

Find the strongest customer segment, most painful training problem, and most desired first feature set.

### Hypothesis

Users will rank `goal-based plan + camera set feedback + progress tracking` above a simple form checker or rep counter.

### Asset

Use `experiments/SURVEY.md` to build a Google Form, Typeform, Tally, or classroom survey.

### Audience

Collect 30-50 responses from people who train at least once per week.

### Key Questions To Answer

- What training goal matters most?
- What is hardest about training alone?
- How comfortable are users with camera-based feedback?
- Which features matter most: plans, rep counting, TUT, form cues, supersets, progress, recommendations?
- Would they join a pilot?
- What would make them trust or reject the product?

### Metrics

- Percent who train alone at least weekly.
- Top three training goals.
- Top three pain points.
- Feature ranking score.
- Camera comfort score.
- Pilot interest score.
- Willingness to pay range.

### Success Criteria

Strong signal:

- 60 percent or more select a goal-based plan as useful or very useful.
- 50 percent or more rank camera set feedback in their top three features.
- 40 percent or more say they would join a pilot.
- Camera comfort average is 3.5 or higher on a 5-point scale.

Mixed signal:

- Strong interest in planning, but weak camera comfort.
- Strong interest in camera feedback, but only for one movement type.

Weak signal:

- Most users only want free workout content or manual tracking.
- Camera comfort average below 3.

### Decision

Use the results to pick the first wedge:

- If planning wins: build onboarding and daily hub first.
- If camera feedback wins: build active set demo first.
- If progress wins: build session review and tracking first.
- If privacy is the blocker: test local-only camera messaging and no-recording language.

## Experiment 3: Concierge Camera-Coaching Pilot

### Goal

Validate whether RepMint's coaching loop feels useful when delivered manually behind the scenes.

### Hypothesis

If users complete a guided workout and receive a set review, at least 70 percent will say the feedback was useful, and at least 50 percent will want to repeat it next week.

### Asset

Use `experiments/CONCIERGE_PILOT.md`.

### Format

Recruit 8-12 participants for one 20-30 minute session.

Two possible modes:

- Live observation: participant joins a video call, performs 2-3 simple movements, and receives trainer-style cues from the team.
- Recorded sample: participant records short sets and receives a manual set summary within 24 hours.

Do not provide medical or safety advice. Keep movements simple and optional.

### Pilot Workout

Choose one:

- Bodyweight starter: squat, push-up variation, plank.
- Lower-body control: squat, lunge, hinge.
- Mobility reset: hip hinge drill, lunge stretch, plank hold.

Collect:

- Goal.
- Experience level.
- Equipment.
- Session completed.
- Reps or hold time.
- Tempo/TUT estimate.
- One cue given.
- One next focus.
- User rating.

### Metrics

- Completion rate.
- Usefulness rating.
- Trust rating.
- Camera comfort rating.
- Clarity of cue.
- Desire to repeat.
- Feature requests.
- Objections.

### Success Criteria

Strong signal:

- 8 or more completed pilot sessions.
- Average usefulness rating of 4 or higher out of 5.
- 50 percent or more would use it weekly.
- 3 or more users ask when the app will be available.

Mixed signal:

- Users like the summary but not live camera coaching.
- Users want plans but do not care about TUT.
- Users need stronger privacy reassurance.

Weak signal:

- Users do not complete the session.
- Feedback feels obvious or not worth using again.
- Camera setup friction dominates the experience.

### Decision

Use pilot notes to define the first build:

- Daily hub and plan onboarding.
- Active set camera coach.
- Set review.
- Progress tracking.

Do not build features that users did not ask about, notice, or value during the pilot.

## Recommended Timeline

Day 1:

- Launch landing page.
- Build survey from `SURVEY.md`.
- Recruit first pilot participants.

Days 2-4:

- Collect landing and survey responses.
- Run 4-6 concierge sessions.
- Note objections and repeated user language.

Days 5-6:

- Run remaining concierge sessions.
- Summarize results in the tracker.
- Decide first build scope.

Day 7:

- Submit validation report.
- Update PRD with evidence-based priorities.

## Assignment Submission Summary

RepMint will be validated through three experiments:

1. A landing page smoke test to measure real customer action.
2. A goal-based training survey to quantify segment, pain, feature priority, and privacy comfort.
3. A concierge pilot to test the coaching loop before building full AI detection.

Together, these experiments test desirability, positioning, feature priority, usability, trust, and repeat intent quickly and efficiently.

