# AGENTS.md: AI Lab Brand Router

This workspace is an AI lab for multiple brands. Do not assume every project file belongs to the same product.

## First Step For Every New Prompt

Before planning, writing, building, or using subagents, classify the request as one of:

1. `DUSK`
2. `RepMint`
3. `Multi-brand / lab operations`
4. `Unclear`

Use the user's latest message as the strongest signal. If the user names a brand, that brand wins even if other files mention a different product.

If a prompt asks to "read AGENTS.md, PRD.md, DESIGN.md, memory/MEMORY.md, memory/lessons.md, tasks/todo.md", read those files, then follow this router and the brand-specific files below.

## Brand Routing

### DUSK

Route to DUSK when the prompt mentions:

- DUSK
- gummies, supplements, functional gummies
- sleep support, stress support, wind-down, calm routine
- guided quiz, formula match, subscription purchase, checkout, subscription management
- launch strategy, segments, landing pages, outreach, email sequences, conversion copy for DUSK

Canonical files:

- `brands/dusk/AGENTS.md`
- `brands/dusk/PRD.md`
- `brands/dusk/DESIGN.md`

Current implementation files for DUSK:

- `app/page.tsx`
- `app/globals.css`
- `public/images/`
- `dusk-final-deploy/`
- `dusk-static-deploy/`

### RepMint

Route to RepMint when the prompt mentions:

- RepMint
- webcam fitness coach
- MediaPipe, BlazePose, pose landmarks
- squats, rep counting, form scoring, exercise cues
- React + Vite hackathon demo for live movement coaching

Canonical files:

- `brands/repmint/AGENTS.md`
- `brands/repmint/PRD.md`
- `brands/repmint/DESIGN.md`

Important note: the current root app is a Next.js DUSK site. RepMint implementation may need a separate app folder or new project setup if the user asks to build it.

### Multi-brand / Lab Operations

Route here when the user asks to organize files, update memory, create process docs, compare brands, or set up instructions for future agents.

Use:

- root `AGENTS.md`
- root `PRD.md`
- root `DESIGN.md`
- `memory/MEMORY.md`
- `memory/lessons.md`
- `tasks/todo.md`

## If The Request Is Unclear

Do not guess silently when the work could affect files, strategy, or brand claims. Ask one concise clarification question:

"Is this for DUSK, RepMint, or both?"

If the request is read-only and the likely brand is obvious from the prompt, proceed and state the routing assumption.

## Cross-Brand Rules

- Do not mix DUSK supplement copy into RepMint fitness coaching.
- Do not mix RepMint webcam/exercise architecture into DUSK ecommerce strategy.
- Do not overwrite brand-specific docs with another brand's context.
- For strategy/copy tasks, return the plan in chat unless the user explicitly asks to create or edit files.
- For build tasks, inspect the relevant implementation files first and keep changes scoped to the routed brand.
- Keep workspace memory current when the user corrects routing, strategy, or process.

## DUSK Claim Safety

DUSK is a wellness supplement brand, not a medical product.

Never claim DUSK cures, treats, prevents, or diagnoses any disease or condition. Avoid medical promises, fake proof, exaggerated outcomes, fear-based language, and candy-like positioning.

Use calm, premium, trustworthy, science-informed, warm, conversion-focused language.

## RepMint Claim Safety

RepMint is a coaching demo, not a medical device.

Avoid injury-prevention, diagnosis, treatment, or medical-grade analysis claims. Use practical coaching cues and transparent form-scoring language.
