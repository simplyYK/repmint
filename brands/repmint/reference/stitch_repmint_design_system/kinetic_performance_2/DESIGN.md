---
name: Kinetic Performance
colors:
  surface: '#111317'
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
  secondary: '#c1c7d2'
  on-secondary: '#2b3139'
  secondary-container: '#464c55'
  on-secondary-container: '#b6bcc7'
  tertiary: '#ffffff'
  on-tertiary: '#29313d'
  tertiary-container: '#dbe3f3'
  on-tertiary-container: '#5d6573'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#b0f734'
  primary-fixed-dim: '#96da06'
  on-primary-fixed: '#121f00'
  on-primary-fixed-variant: '#334f00'
  secondary-fixed: '#dde3ee'
  secondary-fixed-dim: '#c1c7d2'
  on-secondary-fixed: '#161c24'
  on-secondary-fixed-variant: '#414750'
  tertiary-fixed: '#dbe3f3'
  tertiary-fixed-dim: '#bfc7d7'
  on-tertiary-fixed: '#141c28'
  on-tertiary-fixed-variant: '#3f4754'
  background: '#111317'
  on-background: '#e2e2e6'
  surface-variant: '#333538'
  obsidian-core: '#080a0d'
  electric-lime: '#b7ff3c'
  surface-raised: '#1c2430'
  status-live: '#48e5c2'
  status-warn: '#ffb84d'
  status-critical: '#ff6b7f'
  text-primary: '#f4f7fb'
  text-muted: '#8794a4'
  accent-soft: rgba(183, 255, 60, 0.12)
typography:
  display-lg:
    fontFamily: Geist
    fontSize: 48px
    fontWeight: '800'
    lineHeight: '1.1'
    letterSpacing: -0.04em
  headline-lg:
    fontFamily: Geist
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Geist
    fontSize: 24px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  metric-xl:
    fontFamily: JetBrains Mono
    fontSize: 40px
    fontWeight: '700'
    lineHeight: '1'
    letterSpacing: -0.05em
  metric-md:
    fontFamily: JetBrains Mono
    fontSize: 20px
    fontWeight: '500'
    lineHeight: '1.2'
    letterSpacing: 0em
  body-lg:
    fontFamily: Geist
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Geist
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  label-caps:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '600'
    lineHeight: '1'
    letterSpacing: 0.08em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  grid-margin: 24px
  gutter: 16px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 32px
  metric-gap: 4px
---

## Brand & Style

The design system is engineered for elite athletic performance, positioning the interface as a high-precision telemetry instrument rather than a standard consumer app. The brand personality is aggressive, technical, and high-energy, centered around the "Kinetic Bolt" identity. 

The visual style is **Corporate / Modern** with a **High-Contrast** edge, utilizing an "Obsidian" dark-mode foundation to reduce eye strain in gym environments while using "Electric Lime" to signify active energy and coaching insights. The aesthetic is inspired by luxury automotive dashboards and professional sports data visualizations—clean, fast, and uncompromisingly functional.

## Colors

The palette is strictly anchored in a high-contrast dark mode. **Obsidian (#080a0d)** serves as the "True Depth" layer, providing a void-like background that makes data pop. **Electric Lime (#b7ff3c)** is the primary action color, used exclusively for CTA fills, the lightning bolt brand mark, and active focus states.

Functional status colors are high-saturation to ensure immediate recognition during high-intensity training. Secondary surfaces use subtle shifts in the Obsidian value to create hierarchy without relying on traditional shadows. All text is optimized for legibility against dark backgrounds, using off-whites and muted grays to manage visual weight.

## Typography

Typography is categorized by utility. **Geist** is used for all narrative and structural UI elements, with heavy weights for headlines to project strength. **JetBrains Mono** is reserved strictly for performance data, metrics (reps, sets, timers), and technical labels. The monospaced nature of JetBrains Mono is critical for preventing layout shift during rapid real-time data updates.

Headline scales use tight letter-spacing for a modern, aggressive look. For mobile views, display sizes are aggressively stepped down to maintain a "glanceable" information density that works at arm's length during a workout.

## Layout & Spacing

This design system employs a **fixed grid** philosophy for desktop (12 columns) and a fluid 4-column grid for mobile. Layouts are intentionally spacious to ensure touch targets are easily accessible with sweaty hands and data is legible from a distance.

A strict 8px base unit drives the spacing rhythm. Gutters are fixed at 16px to maintain high information density in metric cards, while margins are generous (24px+) to prevent the UI from feeling claustrophobic. In training mode, the layout prioritizes the "Camera Stage," which occupies the central viewport with UI overlays pinned to the safe-area peripheries.

## Elevation & Depth

Depth is achieved through **tonal layering** and **glassmorphism**, avoiding traditional soft shadows which can appear muddy on near-black backgrounds.

1.  **Base Layer:** `--bg-core` (#080a0d) for the primary application canvas.
2.  **Surface Layer:** `--bg-surface` (#141a22) for containerized content like cards and navigation bars.
3.  **Raised Layer:** `--bg-surface-raised` (#1c2430) for active states or floating modals.
4.  **Overlays:** High-intensity backdrop blurs (20px radius) are used for camera stage overlays to ensure metric legibility over live video feeds.

Stroke-based depth is used for interactivity; an Electric Lime border (`1.5px`) indicates the active focus or recording state.

## Shapes

The shape language balances modern approachability with technical precision. Standard containers and cards use a **Rounded** (0.5rem) radius. High-action elements like primary buttons and status chips utilize **Pill-shaped** (full round) geometries to differentiate them from the structural grid.

Joint indicators in the skeletal tracking view are perfect `6px` circles with a subtle inner glow, ensuring they remain visible but do not obscure the user's form.

## Components

### Buttons & Inputs
- **Primary Action:** Pill-shaped, Electric Lime fill with Obsidian text. On press, `scale(0.96)` micro-interaction.
- **Secondary Action:** Ghost style with a `--border-subtle` and white text.
- **Inputs:** Dark fills (`--bg-surface-raised`) with `1.5px` borders that turn Electric Lime on focus.

### Metric Cards
- Designed for "glanceability." Top-aligned label in `label-caps` (JetBrains Mono) and large-scale centered data. 
- Backgrounds use `--bg-surface` with a `1px` subtle border.

### Status Indicators
- **Live/Recording:** A chip featuring a pulsing (2s duration) dot in `--status-live`.
- **Form Correction:** High-visibility banners using `--status-warn` or `--status-critical` anchored to the top of the viewport.

### The Kinetic Bolt
- The lightning bolt mark replaces all standard "coach" or "camera" icons. It should be used at `24px` for standard UI navigation and `48px+` for brand moments.

### Skeletal Overlay
- Camera lines must be exactly `1.5px` solid. 
- Tracking nodes use the `6px` circular joint indicators with a `rgba(183, 255, 60, 0.4)` outer glow.