# App Plan - RepMint

## 1. App Overview

RepMint is a browser-based real-time exercise form coach for a 4-hour hackathon build. The v1 demo focuses on one job: count live squat reps from webcam pose tracking and give simple form feedback while the user moves. It uses React + Vite, MediaPipe BlazePose through `@mediapipe/tasks-vision`, plain JavaScript angle math, and a deterministic squat state machine. The app runs fully in the browser, stores nothing beyond the current session, and may generate a post-set coaching summary after the user ends a set.

## 2. Key Components

- Webcam capture module using `navigator.mediaDevices.getUserMedia`.
- MediaPipe PoseLandmarker setup through `@mediapipe/tasks-vision`.
- Canvas overlay that draws pose landmarks, skeleton lines, and optional angle markers.
- Joint-angle utility functions for knees, hips, and torso lean.
- Squat rep state machine with phases: `standing`, `descending`, `bottom`, `ascending`.
- Smoothing utilities to reduce jitter in angle values.
- Form scoring function that returns a 0-100 score, one primary cue, and issue flags.
- Session tracker for reps, set duration, average score, best rep score, and most common cue.
- Post-set summary generator with local fallback and optional Anthropic call.

Additional useful polish:

- Camera loading, permission-denied, and no-person-detected states.
- Developer debug panel hidden behind a flag.
- Responsive layout that keeps video, metrics, and cues readable on laptop and phone screens.

## 3. App Structure

Screens:

- Live Coach: main webcam view with overlay, rep count, score, cue, and start/end controls.
- Camera Error State: explains camera permission or device failure and offers retry.
- Tracking Empty State: tells the user to step back or move into frame.
- Post-Set Summary: shows reps, average score, best score, common issue, duration, and coaching note.

Navigation flow:

The app opens directly on Live Coach. If camera permission is missing, show Camera Error State. When pose landmarks are unavailable or confidence is too low, keep the video visible and show Tracking Empty State. Start Set resets counters and begins session tracking. During the set, pose frames update angles, reps, score, and cue. End Set stops session tracking and opens Post-Set Summary. A Start New Set action returns to Live Coach with cleared metrics.

## 4. User Interface

Live Coach:

- Full-page dark fitness interface with a top bar containing the RepMint wordmark, camera status, and small settings/debug toggle.
- Large video stage centered on the page with the webcam feed and absolutely aligned canvas overlay.
- Metrics rail beside or below the video with rep count, live form score, current phase, and set timer.
- Cue panel near the video stage with one short instruction such as "Try a little more depth" or "Keep your chest lifted".
- Primary control button for Start Set or End Set. Secondary button for Reset.

Camera Error State:

- Centered message with camera issue, browser permission hint, and Retry Camera button.

Tracking Empty State:

- Non-blocking overlay message on the video: "Step back so your full body is visible."
- Keep metrics visible but mark score as waiting.

Post-Set Summary:

- Summary panel with total reps, average score, best score, common cue, and duration.
- Coaching paragraph below metrics.
- Start New Set button.
- Optional "AI summary unavailable, showing local summary" note when Anthropic fails or is not configured.

All controls must have visible labels, keyboard focus states, and at least 44px touch targets.

## 5. Backend Requirements

No backend is required for v1. Camera frames, landmarks, angle values, rep counts, form scores, and set summaries stay in browser memory for the current session only.

No database, authentication, account creation, workout history, file upload, or server API should be added. If Anthropic summary support is attempted, it must be optional and must not block the local summary. Do not commit API keys. Prefer a local summary unless the hackathon environment provides a safe browser-compatible key or proxy.

## 6. APIs and Libraries

- React: component rendering and local state.
- Vite: local development server and production build.
- `@mediapipe/tasks-vision`: PoseLandmarker for BlazePose-style body landmarks.
- Browser MediaDevices API: webcam capture.
- Canvas 2D API: draw landmarks, skeleton lines, angle guides, and cue highlights.
- Plain JavaScript math utilities: vector angle calculation and movement thresholds.
- Optional Anthropic API: post-set coaching summary only after End Set, with local fallback on missing key, CORS failure, or request error.

Avoid routing, global state libraries, UI kits, backend SDKs, video recording libraries, and charting libraries for v1.

## 7. Testing Strategy

Unit tests:

- Angle helper returns expected degrees for known point triples.
- Squat state machine counts one full down-and-up movement as one rep.
- Squat state machine does not count partial dips.
- Scoring function returns depth cue when knee angle never reaches target depth.
- Local summary builder returns useful copy with zero reps, good reps, and low-score reps.

Integration checks:

- App initializes PoseLandmarker once.
- Webcam overlay stays aligned to video dimensions after resize.
- Start Set clears previous metrics.
- End Set freezes the session summary.

User acceptance tests:

- User grants camera access and sees webcam video within 5 seconds on a normal laptop.
- User sees pose landmarks when standing in frame.
- User performs 5 squats and the counter lands within 1 rep of the actual count.
- User receives at least three possible live cues based on movement or framing.
- User can end a set and read a useful summary without an API key.
- `npm run build` completes without errors.

## 8. Platform-Specific Considerations

Target platform: Cursor or another AI coding agent working in a React + Vite project.

Keep the implementation readable for AI iteration:

- Put pose setup in `src/pose/createPoseLandmarker.js`.
- Put frame-loop logic in `src/pose/usePoseLandmarks.js`.
- Put drawing code in `src/pose/drawPoseOverlay.js`.
- Put angle math in `src/exercise/angles.js`.
- Put rep logic in `src/exercise/squatStateMachine.js`.
- Put scoring rules in `src/exercise/squatScoring.js`.
- Put thresholds and cue text in `src/data/squatConfig.js`.

Performance guidelines:

- Run detection inside `requestAnimationFrame`.
- Reuse PoseLandmarker instead of recreating it per render.
- Draw canvas overlays without forcing React state updates for every frame.
- Store only derived session metrics, not video frames.
- Keep debug values out of the main UI once the demo works.

Design guidelines:

- The first screen is the coach, not a landing page.
- Use high contrast over the video.
- Keep cue text short enough to read during movement.
- Favor reliability over detailed biomechanical claims.

## 9. Out of Scope for v1

- Exercises other than squats.
- Login, accounts, profiles, or saved workout history.
- Backend services or database persistence.
- Video recording, uploads, or replay.
- Trainer dashboards.
- Payments or subscriptions.
- Medical, injury-prevention, or diagnosis claims.
- Multi-person tracking.
- Custom ML model training.
- Mobile app wrapper.
- Detailed nutrition or workout programming.
- Complex chat interface.

## 10. Definition of Done

- A user can open the app, grant webcam permission, and see live video.
- Pose landmarks draw over the user's body and remain aligned with the video.
- Knee angles are computed in real time and feed a squat state machine.
- The app counts completed squat reps without obvious double-counting.
- The UI shows rep count, phase, live form score, and one active cue.
- Start Set and End Set produce a clear session flow.
- Ending a set displays reps, score metrics, duration, common issue, and coaching summary.
- The app works without auth, backend, database, or required API key.
