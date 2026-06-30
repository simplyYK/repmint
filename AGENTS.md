# AGENTS.md: RepMint

This repository is for RepMint only.

RepMint is a camera-based training companion and trainer-style app for everyday exercise. It uses a phone or webcam to support goal-based training plans, form tracking, rep counting, time-under-tension tracking, supersets, set review, AI recommendations, and progress tracking. Do not introduce unrelated brand or commerce context into this repo.

## Canonical Files

- `brands/repmint/AGENTS.md`
- `brands/repmint/PRD.md`
- `brands/repmint/DESIGN.md`
- `brands/repmint/APP_DESIGN_SYSTEM.md`
- `brands/repmint/reference/stitch_repmint_design_system/`

## Current Implementation

- `app/page.tsx`
- `app/globals.css`
- `app/layout.tsx`
- `public/images/repmint-hero.png`

## Updated Product Scope

Position RepMint as a broader AI camera coach and personal trainer in your pocket, not a squat-only demo.

Core product surfaces:

- onboarding and goal setup
- daily training hub
- goal-based training programs
- active camera-based set coaching
- progress journey
- settings/profile

Supported language:

- personal trainer in your pocket
- AI camera coach
- camera-based training companion
- goal-based training plans
- daily training hub
- smart recommendations
- movement profiles
- exercise library
- rep counting
- time under tension
- tempo tracking
- supersets
- set review
- progress tracking
- practical coaching cues

Allowed first movements:

- squats
- lunges
- push-ups
- hinges
- planks
- mobility drills

It is fine to say a first prototype may focus on a small set of movements. Do not make the whole brand identity squat-only.

## Updated Vision Notes From Design Package

The Stitch package in `brands/repmint/reference/stitch_repmint_design_system/` points toward a full app experience:

- onboarding/welcome
- daily training recommendation hub
- training programs
- active TUT/form coach
- progress journey
- account/settings
- Kinetic Performance visual system

Use the package for design direction and screen structure. Treat its screenshots and HTML as references, not production-safe copy; revise any clinical, exaggerated, or fake-precision wording before using it.

## Claim Safety

RepMint is a coaching product, not clinical guidance.

Avoid clinical, safety, replacement, or guaranteed-outcome claims.

Use practical wording instead:

- train with more awareness
- move with better control
- get clear real-time feedback
- review what to focus on next
- improve consistency over time
- adjust today's plan based on recent training

Avoid:

- injury prevention claims
- diagnosis or clinical assessment
- perfect form claims
- guaranteed hypertrophy, strength, or body-change claims
- replacement for trainers, clinicians, or professional instruction
- sub-centimeter precision claims

## Build Rules

- Keep the first screen product-led, not a generic marketing splash.
- For app screens, surface a plan, camera coach, or progress state immediately.
- Use real visual assets or generated bitmap visuals for major hero/product moments.
- Keep CTAs short and consistent.
- Keep copy direct, supportive, and non-medical.
- Keep generated or demo numbers clearly framed as sample session output.
- Separate pose detection, movement rules, plan logic, recommendations, and UI.
- Keep movement profiles configurable so RepMint can grow beyond the first exercises.
- Do not push old exports, zips, duplicate backup pages, temp folders, or screenshots unless explicitly requested.
