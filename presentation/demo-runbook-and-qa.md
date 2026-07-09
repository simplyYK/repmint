# RepMint — Demo Runbook & Q&A Prep

## Before the session (checklist)

- [ ] Submit the deck + **MVP URL (mandatory): https://repmint.vercel.app** +
      GitHub URL: https://github.com/simplyYK/repmint — *before the slot, hard deadline*.
- [ ] Demo machine: signed in at repmint.vercel.app as the demo account, Coach +
      Workouts + Community tabs pre-opened. Volume UP (voice cue must be heard).
- [ ] Camera permission already granted to the browser on the demo machine.
- [ ] **Record the backup video the evening before** (screen + phone recording of
      the exact 4 demo beats, ~3 min). Open it muted in a second tab.
- [ ] Phone hotspot ready in case venue wifi blocks WebRTC (realtime voice).
- [ ] One dry run in the actual room if possible — check projector contrast
      (deck is dark-theme; bump screen brightness).
- [ ] Faculty may interact with the MVP: have the QR slide (7 or 12) up during
      Q&A; the app is public and sign-up works.

## Demo choreography

| # | Beat | Where | Time | Wow moment |
|---|------|-------|------|-----------|
| 1 | Camera coach | /train | 90s | Half-rep rejected + voice cue out loud |
| 2 | AI day workout | /workouts → Create | 45s | Full session saved in seconds, plan untouched |
| 3 | Grounded chat | /coach | 45s | Reply cites real session data (July 7, ROM 91–93%) |
| 4 | Competitions | /social | 30s | Live leaderboard between friends |

**Failure protocol:** anything hangs >10s → switch to the backup video tab and
keep narrating the same beats. One light line ("the demo gods want the video
version") — never apologize twice, never debug on stage.

## Likely faculty questions — strong answers

**"Is the AI actually necessary here?"**
The core feature is computer vision — without it nothing counts your reps, so a
form or dashboard cannot replace it. The LLM layer is also load-bearing: plans
must adapt to goal, equipment, time and injuries; that's generation, not lookup.
Deterministic logic (rep thresholds, scoring, clamps) stays deterministic.

**"How do you prevent hallucinations?"**
Structured outputs validated against a 115-exercise allowlist; invalid JSON is
re-asked once, then rejected; every numeric field is clamped server-side. The
chat coach is grounded in the user's actual session rows and declines
off-topic/medical questions. Where evidence is thin, it's instructed to say so.

**"What about privacy — you're filming people?"**
We never receive the video. Pose estimation runs in the browser on-device;
only landmark-derived numbers (reps, scores) sync. That's architecture, not a
policy promise. The database enforces row-level security on every table, and
the friends leaderboard is a guarded aggregate function — raw sessions stay
private even from friends.

**"How accurate is the rep counting?"**
Tiered honestly: 58 exercises get full form coaching, 18 get rep counting, 39
are timer/manual — we never pretend the camera can track what it can't. Range-
of-motion gates reject partial reps; a One-Euro filter smooths landmark noise.

**"Why would anyone pay?"**
The free tier proves the magic in 30 seconds at zero marginal cost to us
(vision runs on the user's device). Premium unlocks the brain and the voice —
about €0.05 of AI cost per active training day against €9.99/month.

**"What's defensible here?"**
Execution speed and the data loop. Every session generates labeled form data
tied to outcomes; the coach's long-term memory makes switching costs real; and
competitions make the product social — you can't take your leaderboard with you.

**"Realtime voice — doesn't it talk over you or lag?"**
One WebRTC session per workout (~300ms latency). It physically cannot
self-trigger: no microphone attached, server-side turn detection disabled, it
speaks only cues we queue, and it closes itself after the final line. Fallback
chain: realtime → HTTP TTS → on-device speech — the workout never goes silent.

**"What did you validate with users?"**
Three personas from interviews drove scope (duration estimates, short
versions, privacy-by-design, streak saver). The canvas principle guided us:
smallest working version that proves value — deployed and testable by you now.

**"What breaks at 10,000 users?"**
Nothing architectural: static frontend on a CDN, vision cost scales with users'
own devices, Postgres + edge functions scale managed. The bottleneck would be
LLM spend — bounded per action and cached exercise bank keeps prompts lean.

**"Why isn't feature X in the MVP?"**
Deliberate scope: we shipped the loop that proves value end-to-end (see →
coach → plan → remember → compete). The canvas's own rule: a smaller working
MVP with evidence beats an ambitious fake demo.
