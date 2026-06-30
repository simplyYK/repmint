# RepMint Design System: Kinetic Performance v1.0

## 1. Vision & Voice
RepMint is an AI-powered camera coach. The UI must feel like a **high-end training instrument**: precise, responsive, and performance-oriented.
- **Tone:** Direct, Calm, Supportive, Elite.
- **Visual Style:** Obsidian-based dark mode, high-contrast neon accents, technical typography, and spacious layouts.

## 2. Brand Identity
### Primary Logo: The Kinetic Bolt
The lightning bolt represents the "Minting" of a perfect rep and the energy of the athlete. 
- **Usage:** Replaces all camera-style icons in navigation and branding.
- **Color:** Always use `--accent` (#b7ff3c).

## 3. Color Palette (Semantic Tokens)
```css
:root {
  /* Surfaces */
  --bg-core: #080a0d;         /* True depth */
  --bg-surface: #141a22;      /* Default card/panel */
  --bg-surface-raised: #1c2430; /* Active states / elevated panels */
  
  /* Brand */
  --accent: #b7ff3c;          /* Electric Lime - Primary Actions */
  --accent-soft: rgba(183, 255, 60, 0.12);
  
  /* Status */
  --status-live: #48e5c2;     /* Tracking active */
  --status-warn: #ffb84d;     /* Form correction */
  --status-critical: #ff6b7f; /* Error/Limit */

  /* Text */
  --text-primary: #f4f7fb;    /* High readability */
  --text-muted: #8794a4;      /* Labels/Secondary info */
  --text-inverse: #10141b;    /* For use on --accent */
  
  /* Lines */
  --border-subtle: rgba(244, 247, 251, 0.08);
  --border-strong: rgba(183, 255, 60, 0.4); /* Used for active focus */
}
```

## 4. Typography
- **Display (Headings):** Satoshi or Geist. Bold/Black weight. `letter-spacing: -0.02em`.
- **UI & Body:** Geist or Inter. Regular for body, Medium for UI controls.
- **Metrics (Data):** JetBrains Mono or any tabular mono font. Used for Rep Counts, TUT scores, and Timers to prevent layout shift.

## 5. Components
### Primary Button
- **Style:** Background `--accent`, Text `--text-inverse`.
- **Shape:** `radius-lg` (16px) or pill.
- **Interaction:** `scale(0.96)` on press.

### Metric Cards
- **Structure:** Label (Muted, Small) -> Value (Primary, Metric-Large) -> Sub-label/Trend (Accent/Muted).
- **Background:** `--bg-surface` with subtle `--border-subtle`.

### Camera Stage & Overlay
- **Overlay Lines:** `--accent` at 1.5px width.
- **Joints:** 6px circles with inner glow.
- **Cues:** Large centered text overlay with `--bg-surface/80` backdrop blur.

## 6. Iconography
Replace standard generic icons with the RepMint Kinetic set:
- **Home/Train:** Fitness Center (Solid)
- **History:** Clock/Rewind
- **Coach:** Lightning Bolt (Brand Mark)
- **Profile:** User Circle

## 7. Motion & Transitions
- **Cues:** Fade in + Slide Up (200ms).
- **Status Chips:** Subtle pulse (2s duration) when recording.
- **Page Transitions:** Horizontal slide between hub and training modes.
