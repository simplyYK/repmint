import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const baseDir = path.join(root, "public/images/repmint-instagram/base");
const outDir = path.join(root, "public/images/repmint-instagram/final");

const palette = {
  bg: "#080a0d",
  surface: "#141a22",
  surface2: "#1c2430",
  text: "#f4f7fb",
  soft: "#c8d2df",
  muted: "#8794a4",
  accent: "#b7ff3c",
  teal: "#48e5c2",
  warn: "#ffb84d",
};

const bg = {
  pushup: "home-pushup.png",
  lunge: "home-lunge.png",
  mobility: "home-mobility.png",
  gym: "gym-hinge.png",
  saved: "saved-folder.png",
  product: "product-ui.png",
};

const assets = [
  ["solo_start_camera_check", "Reel cover", "Start With Camera Check", "Home workout", bg.pushup, "Sample preview", "Camera locked", "Try your first set"],
  ["solo_10_min_form_flow", "Carousel", "10 Min Form Flow", "Lunges + hinges", bg.lunge, "Demo set", "Timer + reps", "Save for tonight"],
  ["solo_pushup_setup", "Static post", "Push-Up Setup", "Push-up profile", bg.pushup, "Sample setup", "Shoulders + hips", "Check your setup"],
  ["solo_lunge_first_set", "Reel cover", "First Lunge Set", "Lunge profile", bg.lunge, "Sample output", "8 reps each side", "Start a set"],
  ["solo_hinge_practice", "Carousel", "Practice Your Hinge", "Hinge profile", bg.lunge, "Demo set", "Tempo stayed steady", "Save this drill"],
  ["solo_plank_hold_review", "Static post", "Plank Hold Review", "Plank profile", bg.mobility, "Sample hold", "45 sec tracked", "Review your hold"],
  ["solo_mobility_reset", "Story", "Quick Mobility Reset", "Mobility drill", bg.mobility, "Sample timer", "Range arc visible", "Add to warmup"],
  ["solo_small_space_workout", "Carousel", "Small Space Session", "Home movement mix", bg.lunge, "Demo session", "3 profiles ready", "Build a session"],
  ["solo_rep_count_demo", "Reel cover", "Reps Counted Clearly", "Push-ups + lunges", bg.pushup, "Sample set", "12 reps counted", "Count your reps"],
  ["solo_after_set_notes", "Static post", "Know What To Adjust", "Set review", bg.product, "Sample output", "Next focus ready", "Review the set"],

  ["gym_return_first_day", "Reel cover", "Back To The Gym", "Gym returner", bg.gym, "Local session", "Movement picker", "Ease back in"],
  ["gym_beginner_lunge_lane", "Static post", "Lunge Lane Check", "Gym lunge", bg.gym, "Sample cue", "Keep rhythm steady", "Try one set"],
  ["gym_pushup_bench", "Carousel", "Bench Push-Up Start", "Beginner push-up", bg.gym, "Demo set", "Level + reps", "Pick your level"],
  ["gym_hinge_with_dumbbell", "Reel cover", "Hinge With Control", "Dumbbell hinge", bg.gym, "Sample output", "Tempo bar active", "Practice the hinge"],
  ["gym_form_cues_not_noise", "Static post", "Cues Without Noise", "Gym set notes", bg.gym, "Live cue", "One focus only", "Get clear feedback"],
  ["gym_first_program_card", "Carousel", "Beginner Movement Mix", "Gym circuit", bg.product, "Exercise library", "Lunge, push-up, plank", "Save the mix"],
  ["gym_confidence_return", "Story", "Return With A Plan", "Gym checklist", bg.gym, "Session plan", "3 simple steps", "Start simple"],
  ["gym_set_review_locker", "Static post", "Review Before You Leave", "Post-set notes", bg.product, "Sample summary", "Focus saved", "Keep the notes"],
  ["gym_mobility_before_lift", "Carousel", "Warm Up With Feedback", "Gym mobility", bg.mobility, "Sample timer", "Range + pace", "Use before lifts"],
  ["gym_camera_position", "Reel cover", "Better Camera Angle", "Camera setup", bg.gym, "Frame guide", "Full body visible", "Frame your set"],

  ["saver_5_cues", "Carousel", "5 Cues Worth Saving", "Saved cues", bg.saved, "Cue cards", "Range, pace, control", "Save this post"],
  ["saver_rep_count_templates", "Static post", "Rep Count Templates", "App mockup", bg.product, "Sample output", "Counter + set notes", "Save the template"],
  ["saver_movement_library", "Carousel", "Movement Library Ideas", "Exercise library", bg.product, "Profile tiles", "Squat, lunge, push-up", "Save your list"],
  ["saver_phone_setup_map", "Static post", "Phone Setup Map", "Camera zones", bg.saved, "Setup guide", "Mat + camera frame", "Save the setup"],
  ["saver_form_review_prompts", "Carousel", "Post-Set Review Prompts", "Workout notes", bg.product, "Prompt chips", "What changed?", "Save for later"],
  ["saver_warmup_stack", "Reel cover", "Warmup Stack", "Mobility montage", bg.mobility, "Demo stack", "4 moves queued", "Save your warmup"],
  ["saver_common_mistakes_soft", "Carousel", "Fix The Next Rep", "Next cue", bg.lunge, "Sample cue", "Try slower rhythm", "Save the cues"],
  ["saver_session_summary", "Static post", "Sample Set Summary", "Set summary", bg.product, "Sample output", "Reps, tempo, focus", "Save the example"],
  ["saver_beginner_week", "Carousel", "Beginner Week Builder", "Weekly mix", bg.product, "Movement balance", "6 profiles", "Save the week"],
  ["saver_camera_overlay_pack", "Static post", "Camera Overlay Pack", "Camera UI", bg.product, "Overlay pack", "Pose frame + reps", "Save the look"],
];

function esc(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function wrap(text, maxChars) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 3);
}

function textLines(lines, x, y, size, color, weight = 700, lineGap = 1.12) {
  return lines
    .map((line, i) => `<text x="${x}" y="${y + i * size * lineGap}" fill="${color}" font-size="${size}" font-weight="${weight}" font-family="Inter, Geist, Arial, sans-serif">${esc(line)}</text>`)
    .join("");
}

function pill(x, y, w, h, label, fill = "rgba(20,26,34,.82)", stroke = "rgba(244,247,251,.18)", color = palette.soft) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="${fill}" stroke="${stroke}"/>
  <text x="${x + 20}" y="${y + h / 2 + 8}" fill="${color}" font-size="24" font-weight="700" font-family="Inter, Geist, Arial, sans-serif">${esc(label)}</text>`;
}

function phonePanel(x, y, w, h, a) {
  const rows = [
    ["MOVEMENT", a.movement],
    [a.sample, a.metric],
    ["NEXT FOCUS", a.cta],
  ];
  return `<g>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="34" fill="rgba(8,10,13,.78)" stroke="rgba(244,247,251,.20)" stroke-width="2"/>
    <rect x="${x + 22}" y="${y + 22}" width="${w - 44}" height="${h - 44}" rx="24" fill="rgba(20,26,34,.72)"/>
    <circle cx="${x + w - 54}" cy="${y + 54}" r="17" fill="${palette.accent}"/>
    <text x="${x + 32}" y="${y + 58}" fill="${palette.text}" font-size="31" font-weight="800" font-family="Inter, Geist, Arial, sans-serif">RepMint</text>
    ${rows.map((r, i) => {
      const yy = y + 112 + i * 88;
      return `<rect x="${x + 32}" y="${yy}" width="${w - 64}" height="62" rx="16" fill="rgba(28,36,48,.90)" stroke="rgba(244,247,251,.11)"/>
      <text x="${x + 52}" y="${yy + 24}" fill="${palette.muted}" font-size="16" font-weight="800" font-family="JetBrains Mono, Menlo, monospace">${esc(r[0].toUpperCase())}</text>
      <text x="${x + 52}" y="${yy + 49}" fill="${i === 1 ? palette.accent : palette.text}" font-size="22" font-weight="800" font-family="Inter, Geist, Arial, sans-serif">${esc(r[1])}</text>`;
    }).join("")}
  </g>`;
}

function overlaySvg(asset, w, h) {
  const [slug, type, headline, movement, file, sample, metric, cta] = asset;
  const isStory = type === "Story";
  const titleLines = wrap(headline, isStory ? 13 : 16);
  const titleSize = isStory ? 78 : 70;
  const titleY = isStory ? 180 : 150;
  const panelY = isStory ? h - 600 : h - 440;
  const panelW = isStory ? 640 : 590;
  const panelX = 56;
  const cueX = isStory ? 56 : 610;
  const cueY = isStory ? h - 300 : h - 310;
  const darkStop = isStory ? 0.78 : 0.70;

  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="fade" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${palette.bg}" stop-opacity="${darkStop}"/>
        <stop offset=".47" stop-color="${palette.bg}" stop-opacity=".24"/>
        <stop offset="1" stop-color="${palette.bg}" stop-opacity=".86"/>
      </linearGradient>
      <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="18" stdDeviation="18" flood-color="#000" flood-opacity=".42"/>
      </filter>
    </defs>
    <rect width="${w}" height="${h}" fill="url(#fade)"/>
    <rect x="34" y="34" width="${w - 68}" height="${h - 68}" rx="38" fill="none" stroke="rgba(244,247,251,.14)" stroke-width="2"/>
    <path d="M72 100 H202 M72 100 V230 M${w - 72} 100 H${w - 202} M${w - 72} 100 V230" stroke="${palette.accent}" stroke-width="4" stroke-linecap="round" opacity=".9"/>
    ${pill(58, 58, 192, 52, "LOCAL SESSION", "rgba(8,10,13,.72)", "rgba(183,255,60,.34)", palette.accent)}
    ${pill(w - 308, 58, 250, 52, type.toUpperCase(), "rgba(8,10,13,.68)", "rgba(72,229,194,.28)", palette.teal)}
    ${textLines(titleLines, 58, titleY, titleSize, palette.text, 850)}
    <text x="62" y="${titleY + titleLines.length * titleSize * 1.12 + 46}" fill="${palette.soft}" font-size="30" font-weight="700" font-family="Inter, Geist, Arial, sans-serif">${esc(movement)}</text>
    <g opacity=".82">
      <circle cx="${w - 260}" cy="${h * 0.46}" r="12" fill="${palette.accent}"/>
      <circle cx="${w - 190}" cy="${h * 0.54}" r="10" fill="${palette.accent}"/>
      <circle cx="${w - 332}" cy="${h * 0.56}" r="10" fill="${palette.teal}"/>
      <path d="M${w - 260} ${h * 0.46} L${w - 190} ${h * 0.54} L${w - 332} ${h * 0.56}" stroke="${palette.accent}" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M${w - 402} ${h * 0.61} C${w - 326} ${h * 0.58}, ${w - 240} ${h * 0.62}, ${w - 170} ${h * 0.58}" stroke="${palette.teal}" stroke-width="5" fill="none" stroke-linecap="round" opacity=".75"/>
    </g>
    <g filter="url(#softShadow)">${phonePanel(panelX, panelY, panelW, 340, { movement, sample, metric, cta })}</g>
    <g filter="url(#softShadow)">
      <rect x="${cueX}" y="${cueY}" width="${isStory ? 690 : 410}" height="144" rx="28" fill="rgba(8,10,13,.78)" stroke="rgba(183,255,60,.30)" stroke-width="2"/>
      <text x="${cueX + 28}" y="${cueY + 42}" fill="${palette.muted}" font-size="18" font-weight="900" font-family="JetBrains Mono, Menlo, monospace">SAMPLE OUTPUT</text>
      <text x="${cueX + 28}" y="${cueY + 83}" fill="${palette.accent}" font-size="31" font-weight="850" font-family="Inter, Geist, Arial, sans-serif">${esc(metric)}</text>
      <text x="${cueX + 28}" y="${cueY + 120}" fill="${palette.text}" font-size="26" font-weight="760" font-family="Inter, Geist, Arial, sans-serif">${esc(cta)}</text>
    </g>
    <rect x="58" y="${h - 96}" width="${w - 116}" height="48" rx="24" fill="rgba(183,255,60,.96)"/>
    <text x="${w / 2}" y="${h - 64}" text-anchor="middle" fill="#0b0e12" font-size="24" font-weight="900" font-family="Inter, Geist, Arial, sans-serif">${esc(cta.toUpperCase())}</text>
  </svg>`;
}

async function render(asset) {
  const [slug, type, headline, movement, file] = asset;
  const w = 1080;
  const h = type === "Story" ? 1920 : 1350;
  const src = path.join(baseDir, file);
  const svg = Buffer.from(overlaySvg(asset, w, h));
  await sharp(src)
    .resize(w, h, { fit: "cover", position: "center" })
    .modulate({ saturation: 0.86, brightness: 0.86 })
    .composite([{ input: svg, top: 0, left: 0 }])
    .png({ compressionLevel: 8, adaptiveFiltering: true })
    .toFile(path.join(outDir, `${slug}.png`));
  return { slug, type, headline, movement };
}

await fs.mkdir(outDir, { recursive: true });
const manifest = [];
for (const asset of assets) manifest.push(await render(asset));
await fs.writeFile(path.join(outDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Rendered ${manifest.length} RepMint Instagram assets to ${outDir}`);
