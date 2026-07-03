import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const baseDir = path.join(root, "public/images/repmint-instagram/base");
const outDir = path.join(root, "public/images/repmint-instagram/ads");

const palette = {
  bg: "#080a0d",
  surface: "#141a22",
  surface2: "#1c2430",
  text: "#f4f7fb",
  soft: "#c8d2df",
  muted: "#8794a4",
  accent: "#b7ff3c",
  teal: "#48e5c2",
};

const photos = {
  pushup: "home-pushup.png",
  lunge: "home-lunge.png",
  mobility: "home-mobility.png",
  gym: "gym-hinge.png",
  saved: "saved-folder.png",
  product: "product-ui.png",
};

const ads = [
  {
    slug: "ad_01_form_coach_pocket",
    photo: photos.pushup,
    label: "CAMERA-BASED FORM COACH",
    headline: "Your form coach, in your pocket.",
    subhead: "Place your phone, start a set, and get clear feedback you can use on the next rep.",
    metric: "12 reps",
    cue: "Next focus: steady pace",
    movement: "Push-up profile",
    cta: "Start Training",
    align: "left",
  },
  {
    slug: "ad_02_stop_guessing_reps",
    photo: photos.lunge,
    label: "REP COUNTING + SET REVIEW",
    headline: "Stop guessing what changed mid-set.",
    subhead: "RepMint helps you see rep count, rhythm, and one practical cue after each set.",
    metric: "8 each side",
    cue: "Cue: match the rhythm",
    movement: "Lunge profile",
    cta: "Review Your Set",
    align: "left",
  },
  {
    slug: "ad_03_home_workouts_feedback",
    photo: photos.mobility,
    label: "HOME WORKOUTS",
    headline: "Home workouts need feedback too.",
    subhead: "Get trainer-style guidance for push-ups, lunges, hinges, planks, and mobility drills.",
    metric: "45 sec",
    cue: "Next focus: smooth range",
    movement: "Mobility profile",
    cta: "Try A Set",
    align: "left",
  },
  {
    slug: "ad_04_saved_workout_feedback",
    photo: photos.saved,
    label: "FOR SAVED WORKOUTS",
    headline: "Saved the workout? Practice it with feedback.",
    subhead: "Turn saved exercises into camera-guided sets with rep counts and simple set notes.",
    metric: "1 saved move",
    cue: "Choose. Move. Review.",
    movement: "Exercise library",
    cta: "Try One Move",
    align: "left",
  },
  {
    slug: "ad_05_gym_less_guesswork",
    photo: photos.gym,
    label: "GYM BEGINNERS + RETURNERS",
    headline: "Cleaner reps. Less guesswork.",
    subhead: "Run a set privately, see what RepMint noticed, and take one cue into the next round.",
    metric: "Demo set",
    cue: "Next focus: control",
    movement: "Hinge profile",
    cta: "See Set Review",
    align: "left",
  },
  {
    slug: "ad_06_one_cue_next_set",
    photo: photos.product,
    label: "ONE CUE AT A TIME",
    headline: "One clear cue for the next set.",
    subhead: "No noisy dashboard. Just rep count, movement feedback, and what to focus on next.",
    metric: "Sample output",
    cue: "Slow the return",
    movement: "Set summary",
    cta: "Start A Session",
    align: "left",
  },
  {
    slug: "ad_07_count_review_repeat",
    photo: photos.pushup,
    label: "SIMPLE TRAINING LOOP",
    headline: "Count. Review. Repeat with more awareness.",
    subhead: "RepMint keeps your set feedback practical so you can keep moving.",
    metric: "10 reps",
    cue: "Last reps sped up",
    movement: "Push-up profile",
    cta: "Check Your Set",
    align: "left",
  },
  {
    slug: "ad_08_broader_movement_coach",
    photo: photos.product,
    label: "MOVEMENT PROFILES",
    headline: "More than a rep counter.",
    subhead: "Build sessions across squats, lunges, push-ups, hinges, planks, and mobility drills.",
    metric: "6 profiles",
    cue: "Pick a movement",
    movement: "Movement library",
    cta: "Open Library",
    align: "left",
  },
  {
    slug: "ad_09_phone_camera_coach",
    photo: photos.lunge,
    label: "PHONE OR WEBCAM",
    headline: "Your camera can coach the set.",
    subhead: "RepMint uses camera-based feedback to count reps and surface practical coaching cues.",
    metric: "Live cue",
    cue: "Keep reps steady",
    movement: "Lunge profile",
    cta: "Run A Set",
    align: "left",
  },
  {
    slug: "ad_10_sample_summary",
    photo: photos.product,
    label: "SAMPLE SET OUTPUT",
    headline: "Know what to focus on next.",
    subhead: "After each set, review the reps, the cue, and a simple next focus.",
    metric: "Set complete",
    cue: "Next: steady tempo",
    movement: "Set review",
    cta: "See RepMint",
    align: "left",
  },
];

function esc(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function wrap(text, max) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > max && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function linesSvg(lines, x, y, size, fill, weight = 800, gap = 1.08, width = 0) {
  return lines
    .map((line, i) => {
      const yy = y + i * size * gap;
      return `<text x="${x}" y="${yy}" ${width ? `textLength="${width}" lengthAdjust="spacingAndGlyphs"` : ""} fill="${fill}" font-size="${size}" font-weight="${weight}" font-family="Inter, Geist, Arial, sans-serif">${esc(line)}</text>`;
    })
    .join("");
}

function productCard(x, y, w, ad) {
  return `<g filter="url(#shadow)">
    <rect x="${x}" y="${y}" width="${w}" height="316" rx="34" fill="rgba(8,10,13,.82)" stroke="rgba(244,247,251,.20)" stroke-width="2"/>
    <rect x="${x + 24}" y="${y + 24}" width="${w - 48}" height="76" rx="22" fill="rgba(28,36,48,.86)"/>
    <text x="${x + 48}" y="${y + 58}" fill="${palette.muted}" font-size="18" font-weight="900" font-family="JetBrains Mono, Menlo, monospace">REPMINT</text>
    <text x="${x + 48}" y="${y + 88}" fill="${palette.text}" font-size="24" font-weight="800" font-family="Inter, Geist, Arial, sans-serif">${esc(ad.movement)}</text>
    <circle cx="${x + w - 62}" cy="${y + 62}" r="18" fill="${palette.accent}"/>
    <rect x="${x + 24}" y="${y + 124}" width="${w - 48}" height="82" rx="22" fill="rgba(183,255,60,.96)"/>
    <text x="${x + 48}" y="${y + 157}" fill="#0b0e12" font-size="18" font-weight="950" font-family="JetBrains Mono, Menlo, monospace">SAMPLE OUTPUT</text>
    <text x="${x + 48}" y="${y + 190}" fill="#0b0e12" font-size="34" font-weight="950" font-family="Inter, Geist, Arial, sans-serif">${esc(ad.metric)}</text>
    <rect x="${x + 24}" y="${y + 226}" width="${w - 48}" height="66" rx="20" fill="rgba(20,26,34,.94)" stroke="rgba(72,229,194,.22)"/>
    <text x="${x + 48}" y="${y + 268}" fill="${palette.text}" font-size="28" font-weight="850" font-family="Inter, Geist, Arial, sans-serif">${esc(ad.cue)}</text>
  </g>`;
}

function overlaySvg(ad) {
  const w = 1080;
  const h = 1350;
  const headlineLines = wrap(ad.headline, 18).slice(0, 3);
  const subLines = wrap(ad.subhead, 42).slice(0, 3);
  const titleSize = headlineLines.length > 2 ? 72 : 82;
  const cardY = headlineLines.length > 2 ? 800 : 820;

  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="shade" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${palette.bg}" stop-opacity=".88"/>
        <stop offset=".42" stop-color="${palette.bg}" stop-opacity=".42"/>
        <stop offset="1" stop-color="${palette.bg}" stop-opacity=".92"/>
      </linearGradient>
      <linearGradient id="bottom" x1="0" y1=".3" x2="0" y2="1">
        <stop offset="0" stop-color="${palette.bg}" stop-opacity="0"/>
        <stop offset="1" stop-color="${palette.bg}" stop-opacity=".96"/>
      </linearGradient>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="22" stdDeviation="24" flood-color="#000" flood-opacity=".5"/>
      </filter>
    </defs>
    <rect width="${w}" height="${h}" fill="url(#shade)"/>
    <rect y="${h - 620}" width="${w}" height="620" fill="url(#bottom)"/>
    <rect x="44" y="44" width="${w - 88}" height="${h - 88}" rx="42" fill="none" stroke="rgba(244,247,251,.13)" stroke-width="2"/>
    <path d="M76 104 H214 M76 104 V242 M${w - 76} 104 H${w - 214} M${w - 76} 104 V242" stroke="${palette.accent}" stroke-width="5" stroke-linecap="round"/>
    <rect x="64" y="64" width="260" height="50" rx="25" fill="rgba(8,10,13,.70)" stroke="rgba(183,255,60,.35)"/>
    <text x="86" y="97" fill="${palette.accent}" font-size="20" font-weight="950" font-family="JetBrains Mono, Menlo, monospace">${esc(ad.label)}</text>
    <text x="64" y="186" fill="${palette.text}" font-size="34" font-weight="900" font-family="Inter, Geist, Arial, sans-serif">RepMint</text>
    ${linesSvg(headlineLines, 64, 298, titleSize, palette.text, 920, 1.04)}
    ${linesSvg(subLines, 66, 298 + headlineLines.length * titleSize * 1.04 + 62, 34, palette.soft, 720, 1.22)}
    <g opacity=".85">
      <circle cx="850" cy="520" r="13" fill="${palette.accent}"/>
      <circle cx="918" cy="603" r="11" fill="${palette.accent}"/>
      <circle cx="770" cy="620" r="11" fill="${palette.teal}"/>
      <path d="M850 520 L918 603 L770 620" stroke="${palette.accent}" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M702 692 C782 648, 858 675, 952 638" stroke="${palette.teal}" stroke-width="5" fill="none" stroke-linecap="round"/>
    </g>
    ${productCard(64, cardY, 520, ad)}
    <g filter="url(#shadow)">
      <rect x="64" y="${h - 140}" width="${w - 128}" height="78" rx="39" fill="${palette.accent}"/>
      <text x="${w / 2}" y="${h - 90}" text-anchor="middle" fill="#0b0e12" font-size="30" font-weight="950" font-family="Inter, Geist, Arial, sans-serif">${esc(ad.cta.toUpperCase())}</text>
    </g>
  </svg>`;
}

async function render(ad) {
  const input = path.join(baseDir, ad.photo);
  const output = path.join(outDir, `${ad.slug}.png`);
  await sharp(input)
    .resize(1080, 1350, { fit: "cover", position: "center" })
    .modulate({ brightness: 0.84, saturation: 0.82 })
    .composite([{ input: Buffer.from(overlaySvg(ad)), top: 0, left: 0 }])
    .png({ compressionLevel: 8, adaptiveFiltering: true })
    .toFile(output);
  return {
    file: `${ad.slug}.png`,
    headline: ad.headline,
    cta: ad.cta,
    size: "1080x1350",
  };
}

await fs.mkdir(outDir, { recursive: true });
const manifest = [];
for (const ad of ads) manifest.push(await render(ad));
await fs.writeFile(path.join(outDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Rendered ${manifest.length} Instagram-ready RepMint ads to ${outDir}`);
