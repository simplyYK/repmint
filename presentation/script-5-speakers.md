# RepMint — 10-Minute Presentation Script (5 speakers)

**Total: 9:45 + buffer. Deck: `RepMint-MVP-Deck.pptx` (14 slides). Demo: repmint.vercel.app**

Same beats as the 4-speaker version, with the demo split across two presenters
so everyone owns real content (faculty may direct questions at non-presenters —
in this version there are none).

---

## SPEAKER 1 — Hook, Problem, NABC (0:00 – 1:50) · Slides 1–4

Same as 4-speaker Speaker 1, trimmed ~10s per slide:

> *Hook:* who has filmed their own set to check form? That video exists
> because nobody is watching. We're Team RepMint — [names] — and RepMint is a
> personal trainer that lives in your camera.
>
> *Problem:* trainers cost €50–80 a session; four in five gym-goers train with
> zero feedback; and every app is blind — it logs what you type, not what you
> do.
>
> *NABC:* Need — real-time form guidance without a trainer's price tag.
> Approach — 33-point pose AI fully on-device in the browser. Benefits — a
> coach that sees, speaks, plans, remembers; video never leaves the phone.
> Competition — apps that can't see you, mirrors that cost €2,000, trainers
> that don't scale. We're the only camera-native software coach.

*(On slide 3 — "Nobody is watching." — pause two seconds before NABC.)*

**HANDOFF →** "Who needs it? [Speaker 2] met them."

---

## SPEAKER 2 — Personas, Jump Start, Solution (1:50 – 3:20) · Slides 5–7

Same beats as 4-speaker Speaker 2:

> Mateo optimizes minutes between classes. Priya trains in a dorm and worries
> about camera privacy. Lukas lives for the streak and his friends' respect.
>
> Three weeks: week one the camera engine, week two the AI brain, week three
> voice, community and polish. 45+ deployments, live right now — every exercise page now carries our own AI-illustrated muscle maps.
>
> Five superpowers: it sees (honest reps only), speaks (realtime voice), thinks
> (plans + grounded chat), connects (competitions), protects (video never
> uploaded). Is the AI decorative? Without the camera model there is no
> product.

**HANDOFF →** Click to slide 8 ("Enough slides.") as you say: "[Speaker 3] —
show them the coach."

---

## SPEAKER 3 — Demo Part 1: The Camera Coach (3:20 – 5:20) · Slide 9 → app

**Beat 1 — Train flow (100s):**
- Train → today's workout → camera gate → prop the phone → step back.
- Raise a hand → countdown → 4–5 live squats.
- *"Watch the count — and watch this half rep… rejected. Only honest reps."*
- Let one voice cue play: *"realtime voice, ~300ms from movement to speech."*
- End of set: per-rep quality, time under tension, fatigue read.
- End of workout beat: *"and when the session ends, the coach says its last
  line and goes quiet — the voice session closes itself."*

**Beat 2 — AI day workout (20s):**
- Create workout → "Ask your AI coach" → *"chest and triceps, 30 minutes"* →
  it saves a full session without touching the weekly plan.

**HANDOFF →** "That's the body. [Speaker 4] — the brain and the friends."

---

## SPEAKER 4 — Demo Part 2: Memory & Community (5:20 – 7:00) · app

**Beat 3 — Grounded coach chat (50s):**
- Coach → "Fixing my squat depth" conversation → ask live: *"did the pause
  trick work?"*
- Reply cites the real July 7 session — weights, ROM scores. *"Not a chatbot —
  it reads my training data. And it remembers my tweaky shoulder across every
  conversation."*
- Flash the chat controls: markdown, stop, regenerate.

**Beat 4 — Competitions (40s):**
- Community → leaderboard of this week's competition → join/create flow.
- *"Week-long races on reps, sets, sessions or minutes — between friends only.
  Accountability is the feature that keeps people training; it's also the
  feature that invites the next user."*

**FALLBACK (both demo speakers):** hiccup > 10s → backup video tab, same
narration, no second apology.

**HANDOFF →** "It works. [Speaker 5] — why it wins."

---

## SPEAKER 5 — Business, Architecture, Reliability, Close (7:00 – 9:45) · Slides 10–14

Same as 4-speaker Speaker 4, at full length:

> *Business:* free camera coach (zero marginal cost — vision runs on the
> user's device), €9.99 premium for the AI brain and voice (~€0.05 per active
> day → software margins), community as the built-in growth loop.
>
> *Architecture:* heavy where it matters, light everywhere else — vision in
> the browser; the cloud only for what must be shared: Postgres + RLS on
> every table, six edge functions, OpenRouter→Gemini fallback, OpenAI
> Realtime voice over WebRTC.
>
> *Reliability:* plans validated against a 115-exercise allowlist — the model
> cannot invent movements; the voice agent cannot ramble — no mic, no turn
> detection, cue-driven only, session closes when the workout ends.
>
> *Future:* wearables, form videos, marketplace, B2B gym pilots.
>
> *Close:* the full loop works today, deployed, for anyone in this room. A
> smaller working MVP with evidence beats an ambitious fake demo. We're Team
> RepMint — scan it and train.

*(All five stand for Q&A.)*
