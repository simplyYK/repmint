---
name: Kinetic Performance
colors:
  surface: '#141a22'
  surface-dim: '#111317'
  surface-bright: '#37393d'
  surface-container-lowest: '#0c0e11'
  surface-container-low: '#1a1c1f'
  surface-container: '#1e2023'
  surface-container-high: '#282a2d'
  surface-container-highest: '#333538'
  on-surface: '#e2e2e6'
  on-surface-variant: '#c2caaf'
  inverse-surface: '#e2e2e6'
  inverse-on-surface: '#2f3034'
  outline: '#8c947b'
  outline-variant: '#424935'
  surface-tint: '#96da06'
  primary: '#ffffff'
  on-primary: '#223600'
  primary-container: '#b0f734'
  on-primary-container: '#4a6f00'
  inverse-primary: '#456800'
  secondary: '#42e1be'
  on-secondary: '#00382d'
  secondary-container: '#00c4a3'
  on-secondary-container: '#004b3d'
  tertiary: '#ffffff'
  on-tertiary: '#452b00'
  tertiary-container: '#ffddb3'
  on-tertiary-container: '#8a5a00'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#b0f734'
  primary-fixed-dim: '#96da06'
  on-primary-fixed: '#121f00'
  on-primary-fixed-variant: '#334f00'
  secondary-fixed: '#63fbd7'
  secondary-fixed-dim: '#3edebb'
  on-secondary-fixed: '#002019'
  on-secondary-fixed-variant: '#005142'
  tertiary-fixed: '#ffddb3'
  tertiary-fixed-dim: '#ffb951'
  on-tertiary-fixed: '#291800'
  on-tertiary-fixed-variant: '#633f00'
  background: '#111317'
  on-background: '#e2e2e6'
  surface-variant: '#333538'
  bg-raised: '#0e1319'
  surface-raised: '#1c2430'
  surface-strong: '#263342'
  text-soft: '#c8d2df'
  text-muted: '#8794a4'
  text-inverse: '#10141b'
  critical: '#ff6b7f'
  camera-bg: '#05070a'
  overlay-line: rgba(183, 255, 60, 0.92)
typography:
  display-title:
    fontFamily: Satoshi
    fontSize: 48px
    fontWeight: '850'
    lineHeight: '0.92'
  section-heading:
    fontFamily: Satoshi
    fontSize: 32px
    fontWeight: '800'
    lineHeight: '0.98'
  body-base:
    fontFamily: Geist
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.62'
  body-bold:
    fontFamily: Geist
    fontSize: 16px
    fontWeight: '780'
    lineHeight: '1.62'
  label-mono:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '850'
    lineHeight: '1.0'
    letterSpacing: 0.12em
  metric-lg:
    fontFamily: JetBrains Mono
    fontSize: 88px
    fontWeight: '850'
    lineHeight: '0.95'
  metric-lg-mobile:
    fontFamily: JetBrains Mono
    fontSize: 48px
    fontWeight: '850'
    lineHeight: '0.95'
  cue-text:
    fontFamily: Geist
    fontSize: 40px
    fontWeight: '850'
    lineHeight: '1.2'
  cue-text-mobile:
    fontFamily: Geist
    fontSize: 22px
    fontWeight: '850'
    lineHeight: '1.2'
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  gutter: 16px
  margin-mobile: 16px
  margin-desktop: 30px
---

## Brand & Style

The design system embodies a high-performance, athletic aesthetic designed for focus and physical movement. It is a "premium dark fitness-tech coach" that feels more like a professional training studio than a clinical medical tool. 

The visual style is **Corporate Modern with Tactile Glassmorphism**. It utilizes a deep charcoal foundation to eliminate distractions, punctuated by high-visibility "Electric Lime" accents that signify kinetic energy and active states. Surfaces use semi-transparent layers and subtle inner glows to create depth, ensuring the UI feels cutting-edge and responsive. The tone is direct, calm, and supportive—the digital equivalent of an expert trainer standing a few feet away.

## Colors

The palette is optimized for high contrast in low-light or high-exertion environments. 

- **Primary (Electric Lime):** Reserved for the hero moments—primary CTAs, the active pose skeleton, and the most critical metric values (like Rep Counts).
- **Secondary (Mint Teal):** Strictly for "Live" status indicators and secondary tracking confirmations.
- **Tertiary (Warning Amber):** Used for fixable coaching cues. It signals a need for adjustment without being alarming.
- **Neutral (Deep Charcoal):** A tiered system of grays starting from `#080a0d` to provide a low-glare canvas that allows the vibrant accents to pop.

**Color Rules:**
- Never use pure black or pure white.
- Use `--text-inverse` on top of Electric Lime backgrounds to ensure WCAG AA compliance.
- Status must always be communicated via color *and* text.

## Typography

Typography is the primary tool for glanceability. We use a three-family system to separate intent:

1.  **Satoshi (Display):** Used for high-impact titles and brand moments. It is tight, athletic, and heavy.
2.  **Geist (UI & Cues):** Used for coaching cues and body text. Its high legibility ensures instructions can be read while in motion.
3.  **JetBrains Mono (Metrics):** Used for rep counts and timers. Monospaced characters prevent layout shifting as numbers increment rapidly.

**Guidelines:**
- All numbers in metrics must use tabular/monospaced figures.
- Cue text should be limited to 7 words.
- Use uppercase and tracking (0.12em) only for small labels to improve readability at a distance.

## Layout & Spacing

This design system uses a **Fluid Hybrid Grid** that prioritizes the camera stage as the primary surface.

- **Desktop (1101px+):** A 1320px max-width container. Uses a split layout where the Camera Stage occupies the left (approx. 65%) and the Metrics/Controls occupy a sidebar on the right. 
- **Mobile (Up to 760px):** Single-column vertical stack. The Camera Stage is pinned to the top, followed immediately by the Live Cue Panel and a grid of metrics.
- **Rhythm:** An 8px base unit drives all spacing.
- **Constraints:** Horizontal scrolling is strictly prohibited down to 360px. Touch targets must be a minimum of 44px, though 52px is preferred for primary workout controls to accommodate shaky or sweaty hands.

## Elevation & Depth

Hierarchy is established through **Tonal Layering** and **Glassmorphism**.

- **Surfaces:** Use `var(--surface)` for standard cards and `var(--surface-raised)` for nested elements.
- **Glass Effects:** The Live Cue Panel and status overlays use semi-transparent backgrounds (`rgba(20, 26, 34, 0.88)`) with backdrop blurs to maintain context with the video feed behind them.
- **Borders:** Instead of heavy shadows, use low-contrast 1px outlines (`rgba(244, 247, 251, 0.12)`) to define containers.
- **Glows:** Active metrics or "Featured" cards use subtle interior radial gradients of `--accent-soft` to pull the element forward and signal its active tracking status.
- **Vignettes:** A subtle edge-to-center dark gradient is applied to the camera stage to ensure overlaid text and the pose skeleton remain legible regardless of the background environment.

## Shapes

The shape language is **Rounded and Athletic**. 

- **Containers:** Standard cards use `rounded-lg` (1rem / 16px) or `rounded-xl` (1.5rem / 24px) for a modern, friendly-yet-technical feel.
- **Action Elements:** All buttons and status chips use a **full pill shape** (`rounded-pill`). This provides a clear affordance for interactivity and distinguishes them from informational cards.
- **Camera Viewport:** Should maintain consistent rounding with the primary container cards to feel integrated into the app shell.

## Components

### Buttons
- **Primary:** Electric Lime background, `--text-inverse` typography. Pill-shaped. On press, apply a `scale(0.98)` and a downward `1px` translation.
- **Secondary:** Outline-only using `--line-strong`, with white text.

### Camera Stage
- **Aspect Ratio:** 16:10 (Desktop), 3:4 (Mobile).
- **Pose Overlay:** Joints are 7px circles with a 3px `--accent` border. Bones are 2px wide. Hide joints with low tracking confidence to avoid "jitter."

### Metrics Cards
- **Featured (Reps):** Large card with an Electric Lime border and a subtle internal glow. Metrics must be center-aligned and use monospaced fonts.
- **Secondary:** Smaller, flat cards using `--surface` with `--text-soft` for labels.

### Status Chips
- Floating pill-shaped indicators in the top corners of the camera stage.
- **Tracking:** Pulsing Electric Lime dot.
- **Warning:** Static Amber for "No Person" or "Out of Frame."

### Live Cue Panel
- A wide, floating container at the bottom center of the camera stage. 
- Uses high-contrast `--cue-text` for maximum reading distance. 
- Updates should be throttled to once every 1.5s to prevent visual fatigue.

### Movement Picker
- Horizontal snap-list of capsules. The active movement is highlighted with an Electric Lime border and a subtle scale increase.