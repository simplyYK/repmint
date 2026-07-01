import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const baseDir = path.join(root, "public/images/repmint-instagram/poster-ads/base");
const outDir = path.join(root, "public/images/repmint-instagram/poster-ads/final");

const palette = {
  bg: "#080a0d",
  text: "#f4f7fb",
  soft: "#c8d2df",
  muted: "#8794a4",
  accent: "#b7ff3c",
  teal: "#48e5c2",
};

const ads = [
  {
    slug: "repmint_ad_training_alone",
    image: "poster-base-1.png",
    eyebrow: "REPMINT FORM COACH",
    headline: "Training alone? Stop guessing your reps.",
    body: "Camera-based feedback, rep counting, and one practical cue for the next set.",
    proof: "Push-ups • Lunges • Hinges • Planks",
    cta: "Try RepMint",
  },
  {
    slug: "repmint_ad_back_to_gym",
    image: "poster-base-2.png",
    eyebrow: "FOR GYM BEGINNERS + RETURNERS",
    headline: "Back at the gym? Bring one clear cue.",
    body: "Review your set privately without posting it or asking someone nearby.",
    proof: "Set review • Movement cues • Rep count",
    cta: "See Set Review",
  },
  {
    slug: "repmint_ad_saved_workout",
    image: "poster-base-3.png",
    eyebrow: "FOR SAVED WORKOUTS",
    headline: "Saved the workout. Now practice it.",
    body: "Turn saved exercises into guided sets with feedback you can use.",
    proof: "Choose a move • Start a set • Review the cue",
    cta: "Start With One Move",
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

function textLines(lines, x, y, size, fill, weight = 800, gap = 1.08) {
  return lines.map((line, i) => {
    return `<text x="${x}" y="${y + i * size * gap}" fill="${fill}" font-size="${size}" font-weight="${weight}" font-family="Inter, Geist, Arial, sans-serif">${esc(line)}</text>`;
  }).join("");
}

function overlay(ad) {
  const w = 1080;
  const h = 1350;
  const headlineLines = wrap(ad.headline, 15).slice(0, 4);
  const bodyLines = wrap(ad.body, 34).slice(0, 3);
  const headlineSize = headlineLines.length > 3 ? 72 : 82;
  const bodyY = 294 + headlineLines.length * headlineSize * 1.08 + 42;

  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="leftShade" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="${palette.bg}" stop-opacity=".94"/>
        <stop offset=".58" stop-color="${palette.bg}" stop-opacity=".48"/>
        <stop offset="1" stop-color="${palette.bg}" stop-opacity=".10"/>
      </linearGradient>
      <linearGradient id="bottomShade" x1="0" y1=".45" x2="0" y2="1">
        <stop offset="0" stop-color="${palette.bg}" stop-opacity="0"/>
        <stop offset="1" stop-color="${palette.bg}" stop-opacity=".82"/>
      </linearGradient>
      <filter id="shadow">
        <feDropShadow dx="0" dy="12" stdDeviation="18" flood-color="#000" flood-opacity=".45"/>
      </filter>
    </defs>
    <rect width="${w}" height="${h}" fill="url(#leftShade)"/>
    <rect width="${w}" height="${h}" fill="url(#bottomShade)"/>
    <rect x="52" y="52" width="${w - 104}" height="${h - 104}" rx="40" fill="none" stroke="rgba(244,247,251,.13)" stroke-width="2"/>
    <path d="M84 100 H198" stroke="${palette.accent}" stroke-width="5" stroke-linecap="round"/>
    <text x="84" y="148" fill="${palette.accent}" font-size="21" font-weight="950" font-family="JetBrains Mono, Menlo, monospace">${esc(ad.eyebrow)}</text>
    <text x="84" y="214" fill="${palette.text}" font-size="34" font-weight="900" font-family="Inter, Geist, Arial, sans-serif">RepMint</text>
    ${textLines(headlineLines, 84, 294, headlineSize, palette.text, 920, 1.08)}
    ${textLines(bodyLines, 88, bodyY, 34, palette.soft, 720, 1.24)}
    <g filter="url(#shadow)">
      <rect x="84" y="${h - 270}" width="620" height="78" rx="39" fill="rgba(8,10,13,.66)" stroke="rgba(244,247,251,.15)"/>
      <text x="118" y="${h - 221}" fill="${palette.soft}" font-size="25" font-weight="780" font-family="Inter, Geist, Arial, sans-serif">${esc(ad.proof)}</text>
      <rect x="84" y="${h - 162}" width="360" height="78" rx="39" fill="${palette.accent}"/>
      <text x="264" y="${h - 112}" text-anchor="middle" fill="#0b0e12" font-size="30" font-weight="950" font-family="Inter, Geist, Arial, sans-serif">${esc(ad.cta)}</text>
    </g>
    <text x="${w - 92}" y="${h - 86}" text-anchor="end" fill="${palette.muted}" font-size="22" font-weight="800" font-family="Inter, Geist, Arial, sans-serif">camera-based movement feedback</text>
  </svg>`;
}

await fs.mkdir(outDir, { recursive: true });
const manifest = [];
for (const ad of ads) {
  const output = path.join(outDir, `${ad.slug}.png`);
  await sharp(path.join(baseDir, ad.image))
    .resize(1080, 1350, { fit: "cover", position: "center" })
    .modulate({ brightness: 0.92, saturation: 0.9 })
    .composite([{ input: Buffer.from(overlay(ad)), top: 0, left: 0 }])
    .png({ compressionLevel: 8, adaptiveFiltering: true })
    .toFile(output);
  manifest.push({ file: `${ad.slug}.png`, headline: ad.headline, cta: ad.cta, size: "1080x1350" });
}
await fs.writeFile(path.join(outDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Rendered ${manifest.length} premium poster ads to ${outDir}`);
