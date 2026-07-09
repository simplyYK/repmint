# RepMint — 10-Minute Presentation Script (4 speakers)

**Total: 9:45 + buffer. Deck: `RepMint-MVP-Deck.pptx` (12 slides). Demo: repmint.vercel.app**

> Faculty rule: reading from paper or screen is penalized. These are *beats to
> internalize*, not lines to read. Each speaker owns their beats; rehearse the
> handoff sentences out loud — they're the glue.

---

## SPEAKER 1 — The Problem (0:00 – 2:00) · Slides 1–3

**[Slide 1 — Title]** *(35s)*

> Quick show of hands — who has ever propped up their phone at the gym to film
> a set, just to check their own form afterwards?
>
> That awkward video exists because when you train alone, nobody is watching.
> We built the coach that watches. We're Team RepMint — [first names, one
> breath] — and RepMint is a personal trainer that lives in your camera.

**[Slide 2 — Problem]** *(45s)*

> Here's the gap. A personal trainer costs fifty to eighty euros a session —
> that's not a habit, that's a luxury. So four out of five gym-goers train
> with zero feedback: no one counts an honest rep, no one catches a knee caving
> in, no one tells you when to stop.
>
> And every fitness app on your phone right now has the same blind spot — it
> logs whatever you *type*. It has no idea what you actually *did*. The moment
> of pain is mid-set, alone: "was that rep even right?"

**[Slide 3 — NABC]** *(40s)*

> The need: real-time form guidance for people who will never pay for a
> trainer. Our approach: a 33-point pose model that runs entirely on your
> phone, in the browser — no app store, no hardware. The benefit: a coach that
> sees, speaks, plans and remembers, for the price of a coffee — and your
> video never leaves the device.
>
> Competition? Freeletics and Fitbod plan workouts but they can't *see* you.
> Smart mirrors see you — for two thousand euros of hardware. Trainers see you
> but don't scale. We are the only camera-native, software-only coach.

**HANDOFF →** "So who is this for? [Speaker 2] met them."

---

## SPEAKER 2 — The People & The Product (2:00 – 3:45) · Slides 4–6

**[Slide 4 — Personas]** *(35s)*

> Three people from our user research. Mateo, 26, trains between classes —
> he abandons any app that makes him take more than two decisions. Priya, 22,
> dorm room, no equipment — she'll never build a workout from a blank screen,
> and she cares deeply that camera video stays private. Lukas, 29, ex-athlete —
> what keeps him going is the streak and his friends seeing it.
>
> Every feature you're about to see exists because one of these three needed it.

**[Slide 5 — Jump Start]** *(30s)*

> We didn't spend three weeks on slides. Week one: the camera engine — pose
> tracking, honest rep counting, a 115-exercise library. Week two: the brain —
> AI plans, a coach with long-term memory, full training history. Week three:
> the feel — a realtime voice, a community, and hardening. Forty-five-plus
> production deployments later, it's live at repmint-dot-vercel-dot-app.

**[Slide 6 — Solution]** *(40s)*

> One coach, five superpowers. It **sees**: only full range-of-motion reps
> count — half reps don't fool it. It **speaks**: a natural voice mid-set, one
> cue at a time. It **thinks**: weekly plans, day workouts on demand, answers
> grounded in your real data. It **connects**: friends and week-long
> competitions. And it **protects**: pose runs on-device; video is never
> uploaded, ever.
>
> And to answer the canvas question directly — is the AI necessary or
> decorative? Without the vision model there is no product. A form can't count
> your reps.

**HANDOFF →** "Enough slides. [Speaker 3] — show them."

---

## SPEAKER 3 — Live Demo (3:45 – 7:15) · Slide 7 stays up, then the app

*(Slide 7 shows the run-of-show + QR while you switch to the browser.
Phone/laptop already signed in. Backup video open in a second tab, muted.)*

**Beat 1 — Train (90s, the wow):**
- Open Train → pick the day's workout → camera gate → prop the phone.
- Step back, raise a hand → "3·2·1" → do 4–5 squats live on stage.
- Narrate only what the room can see: *"It's counting — but watch, I'll cut
  this one short… no count. Only honest reps."*
- Let ONE voice cue play out loud. *"That's the realtime coach — about 300
  milliseconds from movement to voice."*
- Finish the set → point at per-rep quality + fatigue read.

**Beat 2 — AI builds today's workout (45s):**
- Workouts → Create workout → "Ask your AI coach."
- Type: *"chest and triceps, 30 minutes, feeling strong"* → Build.
- While it generates: *"This builds ONE session for today without touching my
  weekly plan — different job than the planner."*
- Show the saved workout with exercises.

**Beat 3 — A coach that remembers (45s):**
- Coach → open "Fixing my squat depth" → scroll the history.
- Ask live: *"did the pause trick work?"* → the reply cites the actual July 7
  session, weights and ROM scores. *"It's not chatting — it's reading my
  training data."*
- Point at markdown rendering, regenerate button, stop button — *"full chat
  controls."*

**Beat 4 — Accountability (30s):**
- Community → live competition leaderboard → *"week-long metric races between
  friends. This is our retention loop AND our growth loop."*

**FALLBACK:** any hiccup > 10 seconds → switch tabs to the backup video and
keep narrating over it with the same beats. Do not apologize twice.

**HANDOFF →** "It works. [Speaker 4] — why it's a business."

---

## SPEAKER 4 — Business, Architecture, Close (7:15 – 9:45) · Slides 8–12

**[Slide 8 — Business value]** *(50s)*

> The business writes itself from the architecture. Free tier: the camera
> coach — because it shows the magic in thirty seconds and costs us nothing;
> pose runs on the *user's* device. Premium, €9.99 a month: the AI brain and
> the realtime voice — our marginal AI cost is about five cents per active
> training day. That's software margins on a personal-training problem.
> And the community layer means the product invites the next user for us —
> competitions literally require friends.

**[Slide 9 — Architecture]** *(40s)*

> One idea to remember: heavy where it matters, light everywhere else. The
> heaviest AI — vision — runs in the browser. That single decision makes
> RepMint private, free to scale, and instant. The cloud does only what must
> be shared: Postgres with row-level security on every table, six edge
> functions, and the language models — OpenRouter with a Gemini fallback, and
> OpenAI's Realtime API for the voice over WebRTC.

**[Slide 10 — Reliability]** *(30s)*

> We built for trust, not just for demo day. Two examples: generated plans are
> validated against a 115-exercise allowlist — the model *cannot* invent an
> exercise. And the voice agent physically cannot ramble: no microphone, turn
> detection off, it speaks only the cues we send, and the session closes the
> moment the workout ends.

**[Slide 11 — Future & conclusions]** *(30s)*

> Next: wearables, form-video library, a workout marketplace, B2B pilots with
> gyms and university sport programs. But the conclusion is on the right: the
> full loop — see, coach, plan, remember, compete — works today, deployed,
> for anyone in this room. Your own canvas says it best: a smaller working MVP
> with evidence beats an ambitious fake demo.

**[Slide 12 — Close]** *(10s)*

> We're Team RepMint. Stop guessing, start counting — scan it and train.
> Questions welcome.

*(All four stand for Q&A.)*
