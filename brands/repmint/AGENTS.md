# AGENTS.md: RepMint Hackathon Build

## Project Overview

RepMint is a browser-based real-time exercise form coach built for a 4-hour hackathon demo.

The app uses the user's webcam, estimates body pose in the browser with MediaPipe BlazePose through `@mediapipe/tasks-vision`, calculates joint angles with plain JavaScript, counts squat reps with a simple state machine, scores form with transparent rules, and displays live coaching cues over the camera feed.

This is a frontend-only React + Vite app. There is no backend. Optional post-set coaching can call the Anthropic API directly only if the demo environment provides a safe key or proxy. If not, use a local generated summary from session metrics.

## Single Demo Goal

Build one polished demo flow:

**Live squat rep-counting + form scoring on webcam.**

A user should be able to:

1. Open the app in the browser.
2. Grant webcam permission.
3. Stand in view of the camera.
4. Perform bodyweight squats.
5. See pose landmarks overlaid on the webcam.
6. See squat reps counted in real time.
7. See a live form score and short corrective cues.
8. End the set and receive a concise coaching summary.

The demo should optimize for reliability, clarity, and visible feedback over broad feature coverage.

## Tech Stack

- **Frontend:** React + Vite
- **Pose estimation:** `@mediapipe/tasks-vision`
- **Exercise logic:** Plain JavaScript math and state machines
- **Styling:** Simple CSS modules or plain CSS
- **Optional summary:** Anthropic API call for post-set coaching summary
- **Backend:** None

## Architecture

The core pipeline should be easy to inspect and debug:

```text
Camera capture
  -> MediaPipe PoseLandmarker
  -> Normalized pose landmarks
  -> Joint-angle computation
  -> Squat rep state machine
  -> Form scoring rules
  -> UI overlay and coaching cues
```

### Camera Capture

Use browser APIs:

- `navigator.mediaDevices.getUserMedia`
- `<video>` element for webcam stream
- `<canvas>` overlay for landmarks, skeleton lines, angles, and cue highlights

Camera logic should be isolated from exercise logic.

### Pose Landmarks

Use MediaPipe BlazePose through `@mediapipe/tasks-vision`.

Responsibilities:

- Initialize the vision task once.
- Run pose detection on animation frames.
- Return the most recent pose landmarks.
- Handle loading, permission denied, and no-person-detected states.

Pose code should not contain squat-specific logic.

### Angle Computation

Use plain JavaScript helpers for joint-angle math.

Required angles for squat demo:

- Left knee angle
- Right knee angle
- Left hip angle
- Right hip angle
- Torso lean angle
- Optional ankle/knee alignment estimates if stable enough

Keep formulas readable and commented only where useful.

### Rep State Machine

Implement a deterministic squat state machine.

Suggested states:

```text
standing
  -> descending
  -> bottom
  -> ascending
  -> standing
```

Use knee angle thresholds and smoothing to avoid noisy rep counts.

Example rule direction:

- Standing: knees mostly extended
- Bottom: knees flexed below target threshold
- Count a rep only after returning from bottom to standing
- Add a short cooldown to prevent double counting

Prioritize stable behavior over perfect biomechanics.

### Form Scorer

Form scoring should use simple transparent rules.

Possible checks:

- Squat depth reached
- Knees bend consistently
- Torso does not lean excessively
- Movement is controlled enough
- Hips and knees move together
- Pose visibility confidence is adequate

Output:

- Current form score from 0 to 100
- One primary live cue at a time
- Optional secondary cue
- Per-rep score history

Avoid medical or injury-prevention claims. Use coaching language such as:

- "Try a little more depth"
- "Keep your chest lifted"
- "Move with control"
- "Stay centered in frame"
- "Good rep"

### UI Overlay

The first screen should be the working demo, not a marketing page.

Required UI elements:

- Webcam preview
- Pose overlay canvas
- Rep count
- Live form score
- Current squat phase
- Current cue
- Start set / End set controls
- Camera permission and loading states
- Post-set coaching summary panel

The app should work on desktop first, with reasonable mobile responsiveness if time allows.

## Coding Conventions

Keep the project framework-light and easy for an AI coding agent to modify quickly.

### Suggested File Structure

```text
src/
  App.jsx
  main.jsx
  styles.css

  components/
    CameraView.jsx
    MetricsPanel.jsx
    CuePanel.jsx
    SummaryPanel.jsx
    Controls.jsx

  pose/
    createPoseLandmarker.js
    usePoseLandmarks.js
    drawPoseOverlay.js
    landmarkUtils.js

  exercise/
    angles.js
    squatStateMachine.js
    squatScoring.js
    smoothing.js

  coaching/
    buildSetSummary.js
    anthropicSummary.js

  data/
    squatConfig.js
```

### File Responsibilities

`pose/createPoseLandmarker.js`

- Loads MediaPipe vision files.
- Creates and returns the PoseLandmarker instance.

`pose/usePoseLandmarks.js`

- Owns webcam frame loop.
- Runs pose detection.
- Exposes landmarks, status, and errors.

`pose/drawPoseOverlay.js`

- Draws skeleton, keypoints, angles, and status overlays on canvas.
- Should not calculate reps or scores.

`exercise/angles.js`

- Pure functions for angle math.
- No React imports.

`exercise/squatStateMachine.js`

- Pure state-machine logic.
- Accepts current angles and previous state.
- Returns next phase, rep count change, and debug data.

`exercise/squatScoring.js`

- Pure scoring rules.
- Accepts landmarks, angles, and squat phase.
- Returns score, issues, and live cue.

`exercise/smoothing.js`

- Small utilities for moving averages or low-pass smoothing.

`coaching/buildSetSummary.js`

- Builds local summary from set metrics.
- Should work without network access.

`coaching/anthropicSummary.js`

- Optional.
- Only called after the set ends.
- Must fail gracefully and fall back to local summary.

`data/squatConfig.js`

- Central place for thresholds, cue text, and scoring weights.

### Coding Style

- Prefer small pure functions for pose math and exercise logic.
- Keep React components mostly focused on rendering and user interaction.
- Avoid large all-in-one components.
- Avoid adding routing, global state libraries, animation libraries, or UI kits.
- Use clear variable names like `leftKneeAngle`, `repPhase`, `formScore`.
- Keep thresholds configurable in `squatConfig.js`.
- Add short comments around non-obvious math or state transitions.
- Do not over-engineer for multiple exercises.
- Do not introduce TypeScript unless the project already uses it.
- Do not add a backend.
- Do not store video, images, or pose history beyond the current session.

## Environment Variables

Optional Anthropic summary support may use:

```text
VITE_ANTHROPIC_API_KEY
```

Do not hard-code API keys.

If the key is missing, disabled, or blocked by browser CORS, use the local summary builder instead.

## Build Phases

Total time box: **4 hours**

### Phase 1: Webcam + Pose Landmark Overlay

**Time box: 60 minutes**

Goal: Get the user visible on screen with live pose landmarks.

Tasks:

1. Create the React + Vite app shell if needed.
2. Install and configure `@mediapipe/tasks-vision`.
3. Add webcam permission flow.
4. Render the webcam stream.
5. Add a canvas overlay aligned to the video.
6. Initialize PoseLandmarker.
7. Draw keypoints and skeleton lines on every frame.
8. Show loading, ready, no-person, and camera-error states.

Acceptance criteria:

- Webcam appears in the browser.
- Pose landmarks draw over the user.
- App does not crash if no person is detected.
- Overlay stays aligned with the video.

### Phase 2: Squat Angle Math + Rep Counter State Machine

**Time box: 70 minutes**

Goal: Detect squat movement and count reps.

Tasks:

1. Implement joint-angle helper functions.
2. Compute left and right knee angles.
3. Compute simple hip and torso angles.
4. Add smoothing for noisy angle values.
5. Implement squat phase detection.
6. Count reps only after a full down-and-up squat.
7. Display current phase and rep count.
8. Add debug values somewhere unobtrusive during development.

Suggested threshold starting points:

```js
standingKneeAngle: 160
bottomKneeAngle: 105
minRepDurationMs: 700
repCooldownMs: 400
```

Tune thresholds by trying real webcam movement.

Acceptance criteria:

- Rep count increases once per completed squat.
- Partial dips do not count as full reps.
- The phase indicator changes during the movement.
- Noise does not rapidly flip the state.

### Phase 3: Form Scoring Rules + Live Cues

**Time box: 60 minutes**

Goal: Give useful real-time coaching feedback.

Tasks:

1. Create scoring rules in `squatScoring.js`.
2. Score depth, torso lean, control, and visibility.
3. Track per-rep quality where practical.
4. Display live form score.
5. Display one clear primary cue.
6. Highlight relevant joints or lines on the overlay if time allows.
7. Add friendly fallback cues when landmarks are low confidence.

Example cue priority:

1. "Step back so your full body is visible"
2. "Try a little more depth"
3. "Keep your chest lifted"
4. "Move with control"
5. "Good rep"

Acceptance criteria:

- User sees a live score from 0 to 100.
- User sees short, actionable cues.
- Cues change based on movement quality.
- Low-confidence tracking produces a camera/framing cue.

### Phase 4: Coaching Summary + Polish

**Time box: 50 minutes**

Goal: Finish the demo experience.

Tasks:

1. Add Start Set and End Set controls.
2. Track session metrics:
   - Total reps
   - Average form score
   - Best rep score
   - Common cue or issue
   - Set duration
3. Generate a local post-set summary.
4. Optionally call Anthropic for a more natural coaching summary.
5. Add fallback if the API call fails.
6. Improve visual design enough for a clean demo.
7. Check responsive layout.
8. Remove distracting debug UI or hide it behind a dev flag.
9. Run build and fix obvious errors.

Acceptance criteria:

- User can start and end a set.
- Ended set displays a useful summary.
- Summary works without an API key.
- The app looks demo-ready.
- `npm run build` succeeds.

## Hard Scope Cuts

Do not build these during the hackathon unless all core demo work is complete:

- More than one exercise
- Login or authentication
- User profiles
- Backend services
- Database persistence
- Workout history across sessions
- Cloud video storage
- Social sharing
- Mobile app wrapper
- Wearable support
- Nutrition tracking
- Payments
- Complex AI chat
- Perfect biomechanical analysis
- Injury diagnosis or medical recommendations
- Multi-person tracking
- Trainer dashboards
- Custom model training

## Demo Copy Guidelines

Use simple coaching language.

Good:

- "Try a little more depth"
- "Keep your chest lifted"
- "Move with control"
- "Stay centered in frame"
- "Nice rep"

Avoid:

- "This prevents injury"
- "This fixes knee pain"
- "Your form is dangerous"
- "Guaranteed performance improvement"
- "Medical-grade analysis"

RepMint is a coaching demo, not a medical device.

## Definition of Done

The hackathon demo is done when:

1. The app runs locally with React + Vite.
2. The webcam permission flow works.
3. The user appears on screen.
4. MediaPipe pose landmarks are drawn over the webcam.
5. Squat knee angles are computed in real time.
6. A state machine counts completed squat reps.
7. Partial movements are not counted as full reps.
8. A live form score is shown.
9. At least three live cues can appear based on user movement.
10. The user can start and end a set.
11. A post-set summary appears after ending the set.
12. The summary works without a backend or required API key.
13. The UI is readable and stable during movement.
14. The app handles no-person-detected and camera-denied states.
15. No auth, database, or backend dependency is required.
16. The project builds successfully with `npm run build`.

## Final Quality Checklist

Before handing off:

- Confirm webcam works in a secure browser context.
- Confirm pose overlay aligns with video.
- Test at least 5 squats.
- Confirm rep count is not double-counting.
- Confirm cues are understandable.
- Confirm ending a set shows useful metrics.
- Confirm missing Anthropic key does not break the app.
- Confirm no API keys are committed.
- Run the available build command.
- Keep the final demo focused on live squat coaching.
