# AI Lab Product Index

This root PRD is a routing index for the workspace. Product requirements live in brand-specific folders.

## Workspace Products

### DUSK

DUSK is a premium functional gummy brand focused on sleep support and stress support. The site/app experience helps customers understand the brand, take a guided quiz, choose between single-bottle and subscription purchases, check out securely, and manage subscriptions with minimal friction.

Canonical PRD:

- `brands/dusk/PRD.md`

Current codebase:

- Next.js app in `app/`
- Product imagery in `public/images/`
- Exported deployable builds in `dusk-final-deploy/` and `dusk-static-deploy/`

### RepMint

RepMint is a browser-based real-time exercise form coach for a hackathon demo. The core experience uses webcam pose tracking to count squat reps and show simple form feedback.

Canonical PRD:

- `brands/repmint/PRD.md`

Current implementation status:

- Product plan and design docs are preserved in `brands/repmint/`.
- The active root app is DUSK, so RepMint build work should be isolated if requested.

## Operating Rules

- Use `AGENTS.md` to route the prompt before acting.
- Use the brand-specific PRD after routing.
- If a prompt asks for strategy only, do not edit files.
- If a prompt asks to build, inspect the routed brand's implementation files first.
- If a prompt names both brands, keep outputs separated by brand.
