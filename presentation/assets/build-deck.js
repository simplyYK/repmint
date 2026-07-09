// RepMint — AI MVP Challenge pitch deck generator.
// Dark athletic brand: bg 0A0D10, cards 141920, lime B7FF3C, teal 48E5C2.
// Fonts: Arial (safe) + Courier New micro-labels (safe).

const pptxgen = require("pptxgenjs");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");
const QRCode = require("qrcode");
const {
  FaEye, FaVolumeUp, FaBrain, FaUsers, FaLock, FaBolt, FaChartLine,
  FaDumbbell, FaMobileAlt, FaServer, FaDatabase, FaCloud, FaCheckCircle,
  FaExclamationTriangle, FaRoute, FaTrophy, FaCameraRetro, FaMicrophone,
} = require("react-icons/fa");

const REPO = "/Users/yk/Desktop/RepMint AI Personal Trainer";
const OUT = REPO + "/presentation/RepMint-MVP-Deck.pptx";
const IMG = REPO + "/public/images/athletes";

// ---- palette ---------------------------------------------------------------
const BG = "0A0D10";
const CARD = "151A21";
const CARD2 = "1B222B";
const TEXT = "F2F5F2";
const MUTED = "97A29D";
const LIME = "B7FF3C";
const TEAL = "48E5C2";
const DIM = "5A6660";

const shadow = () => ({ type: "outer", color: "000000", blur: 10, offset: 3, angle: 45, opacity: 0.35 });

async function icon(Comp, color, size = 256) {
  const svg = ReactDOMServer.renderToStaticMarkup(React.createElement(Comp, { color, size: String(size) }));
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return "image/png;base64," + png.toString("base64");
}

(async () => {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_16x9";
  pres.author = "Team RepMint";
  pres.title = "RepMint — AI MVP Challenge";

  const W = 10, H = 5.625;

  const ic = {
    eye: await icon(FaEye, "#" + LIME),
    voice: await icon(FaVolumeUp, "#" + LIME),
    brain: await icon(FaBrain, "#" + LIME),
    users: await icon(FaUsers, "#" + LIME),
    lock: await icon(FaLock, "#" + LIME),
    bolt: await icon(FaBolt, "#0A0D10"),
    boltLime: await icon(FaBolt, "#" + LIME),
    chart: await icon(FaChartLine, "#" + LIME),
    dumbbell: await icon(FaDumbbell, "#" + LIME),
    mobile: await icon(FaMobileAlt, "#" + TEAL),
    server: await icon(FaServer, "#" + TEAL),
    db: await icon(FaDatabase, "#" + TEAL),
    cloud: await icon(FaCloud, "#" + TEAL),
    check: await icon(FaCheckCircle, "#" + LIME),
    warn: await icon(FaExclamationTriangle, "#" + TEAL),
    route: await icon(FaRoute, "#" + LIME),
    trophy: await icon(FaTrophy, "#" + LIME),
    camera: await icon(FaCameraRetro, "#" + LIME),
    mic: await icon(FaMicrophone, "#" + LIME),
  };

  const qr = await QRCode.toDataURL("https://repmint.vercel.app", {
    margin: 1, width: 512,
    color: { dark: "0A0D10", light: "B7FF3C" },
  });

  // helpers ------------------------------------------------------------------
  function base(slide) {
    slide.background = { color: BG };
  }
  function eyebrow(slide, text, x, y, w = 4, color = LIME) {
    slide.addText(text.toUpperCase(), {
      x, y, w, h: 0.3, fontFace: "Courier New", fontSize: 11, color, charSpacing: 3, margin: 0,
    });
  }
  function pageno(slide, n) {
    slide.addText(String(n), { x: W - 0.55, y: H - 0.42, w: 0.35, h: 0.3, fontFace: "Courier New", fontSize: 9, color: DIM, align: "right", margin: 0 });
    slide.addText("RepMint", { x: 0.5, y: H - 0.42, w: 1.5, h: 0.3, fontFace: "Courier New", fontSize: 9, color: DIM, margin: 0 });
  }
  function card(slide, x, y, w, h, fill = CARD) {
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, fill: { color: fill }, rectRadius: 0.08, line: { color: "232B33", width: 0.75 }, shadow: shadow() });
  }

  // ---- 1. TITLE --------------------------------------------------------------
  {
    const s = pres.addSlide();
    base(s);
    // full-bleed photo right
    s.addImage({ path: "" + REPO + "/presentation/assets/title-hero.jpg", x: 5.6, y: 0, w: 4.4, h: H, sizing: { type: "cover", w: 4.4, h: H } });
    s.addShape(pres.shapes.RECTANGLE, { x: 5.6, y: 0, w: 4.4, h: H, fill: { color: BG, transparency: 78 } });
    // logo chip
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.55, y: 0.55, w: 0.62, h: 0.62, fill: { color: LIME }, rectRadius: 0.16 });
    s.addImage({ data: ic.bolt, x: 0.68, y: 0.67, w: 0.37, h: 0.37 });
    s.addText("RepMint", { x: 1.3, y: 0.55, w: 3, h: 0.62, fontFace: "Arial", fontSize: 26, bold: true, italic: true, color: TEXT, valign: "middle", margin: 0 });

    s.addText("A personal trainer,\nliving in your camera.", {
      x: 0.55, y: 1.85, w: 5.2, h: 1.75, fontFace: "Arial", fontSize: 40, bold: true, color: TEXT, lineSpacing: 46, margin: 0,
    });
    s.addText("Real-time rep counting, spoken form coaching, and AI training plans — using nothing but a phone.", {
      x: 0.55, y: 3.75, w: 4.7, h: 0.85, fontFace: "Arial", fontSize: 15, color: MUTED, lineSpacing: 21, margin: 0,
    });
    eyebrow(s, "AI MVP Challenge · Team RepMint", 0.55, 4.9, 4.9);
    s.addNotes("SPEAKER 1 — 45s. Hook: ask the room who has ever recorded themselves at the gym to check their form. Then: 'We built the coach that watches instead.' One sentence per team member intro, then straight into the problem.");
  }

  // ---- 2. PROBLEM --------------------------------------------------------------
  {
    const s = pres.addSlide();
    base(s);
    eyebrow(s, "Problem", 0.55, 0.5);
    s.addText("Training alone is guesswork.", { x: 0.55, y: 0.85, w: 8.5, h: 0.7, fontFace: "Arial", fontSize: 32, bold: true, color: TEXT, margin: 0 });

    s.addImage({ path: "" + REPO + "/presentation/assets/problem-solo.jpg", x: 6.7, y: 1.8, w: 2.75, h: 3.2, sizing: { type: "cover", w: 2.75, h: 3.2 } });
    s.addShape(pres.shapes.RECTANGLE, { x: 6.7, y: 1.8, w: 2.75, h: 3.2, fill: { color: BG, transparency: 85 } });

    const stats = [
      { big: "€50–80", small: "per personal-training session — out of reach for most students and young professionals" },
      { big: "4 in 5", small: "gym-goers train with no feedback at all: no rep quality, no form check, no plan logic" },
      { big: "0", small: "fitness apps that can actually SEE you — they log what you type, not what you do" },
    ];
    stats.forEach((st, i) => {
      const y = 1.8 + i * 1.1;
      card(s, 0.55, y, 5.8, 0.95);
      s.addText(st.big, { x: 0.8, y: y + 0.08, w: 1.55, h: 0.8, fontFace: "Arial", fontSize: 28, bold: true, color: LIME, valign: "middle", margin: 0 });
      s.addText(st.small, { x: 2.45, y: y + 0.08, w: 3.8, h: 0.8, fontFace: "Arial", fontSize: 11.5, color: TEXT, valign: "middle", lineSpacing: 15, margin: 0 });
    });
    pageno(s, 2);
    s.addNotes("SPEAKER 1 — 60s. The pain is concrete: coaching is expensive, mirrors cost 2000 euros, and every app is blind — it trusts whatever you type. Bad form means plateaus and dropouts. The moment of pain: mid-set, no one watching, 'was that rep even right?'");
  }

  // ---- 3. NABC --------------------------------------------------------------
  {
    const s = pres.addSlide();
    base(s);
    eyebrow(s, "NABC", 0.55, 0.5);
    s.addText("Need · Approach · Benefits · Competition", { x: 0.55, y: 0.85, w: 9, h: 0.6, fontFace: "Arial", fontSize: 28, bold: true, color: TEXT, margin: 0 });

    const quads = [
      { t: "Need", c: LIME, body: "Affordable, real-time form guidance for people who train without a coach — feedback in the set, not after it." },
      { t: "Approach", c: TEAL, body: "33-point pose AI runs on-device in the browser. Honest rep counting, spoken cues, AI plans, and social accountability — no hardware, no install." },
      { t: "Benefits", c: LIME, body: "A coach that sees, speaks, plans, and remembers — for the price of a coffee, not a PT. Video never leaves the phone." },
      { t: "Competition", c: TEAL, body: "Freeletics & Fitbod plan but can't see you. Tempo/Tonal mirrors see you for €2,000+ of hardware. PTs see you but don't scale. We're the only camera-native software coach." },
    ];
    quads.forEach((q, i) => {
      const x = 0.55 + (i % 2) * 4.6, y = 1.7 + Math.floor(i / 2) * 1.75;
      card(s, x, y, 4.4, 1.6, i % 2 ? CARD : CARD2);
      s.addText(q.t, { x: x + 0.25, y: y + 0.14, w: 3.9, h: 0.35, fontFace: "Arial", fontSize: 15, bold: true, color: q.c, margin: 0 });
      s.addText(q.body, { x: x + 0.25, y: y + 0.5, w: 3.95, h: 1.0, fontFace: "Arial", fontSize: 10.5, color: TEXT, lineSpacing: 14, valign: "top", margin: 0 });
    });
    pageno(s, 3);
    s.addNotes("SPEAKER 1 — 60s. Walk N-A-B-C clockwise. Land the competition line hard: apps are blind, mirrors are expensive, trainers don't scale — we are the only one that is camera-native AND software-only.");
  }

  // ---- 4. PERSONAS --------------------------------------------------------------
  {
    const s = pres.addSlide();
    base(s);
    eyebrow(s, "Personas", 0.55, 0.5);
    s.addText("Three people, one missing coach.", { x: 0.55, y: 0.85, w: 9, h: 0.6, fontFace: "Arial", fontSize: 28, bold: true, color: TEXT, margin: 0 });

    const personas = [
      { img: "" + REPO + "/presentation/assets/persona-mateo.jpg", name: "Mateo, 26 — the optimizer", pain: "Trains in fixed 45–75 min windows between classes. Abandons anything with more than two decisions.", gets: "Est. duration on everything, a sanctioned 20-min short version, week-over-week data." },
      { img: "" + REPO + "/presentation/assets/persona-priya.jpg", name: "Priya, 22 — the home beginner", pain: "Dorm room, no equipment, would never build a workout from a blank screen. Afraid of doing it wrong.", gets: "Ready-made room workouts, plain-language cues, on-device camera privacy, 'you did it right' feedback." },
      { img: "" + REPO + "/presentation/assets/persona-lukas.jpg", name: "Lukas, 29 — the streak-keeper", pain: "Ex-athlete, checks his streak every morning. Busy weeks kill momentum and the habit with it.", gets: "A legit 15-min minimum session, one calendar for everything, weekly competitions with friends." },
    ];
    personas.forEach((p, i) => {
      const x = 0.55 + i * 3.08;
      card(s, x, 1.7, 2.88, 3.45);
      s.addImage({ path: p.img, x: x + 0.12, y: 1.82, w: 2.64, h: 1.15, sizing: { type: "cover", w: 2.64, h: 1.15 } });
      s.addText(p.name, { x: x + 0.16, y: 3.05, w: 2.6, h: 0.42, fontFace: "Arial", fontSize: 12.5, bold: true, color: LIME, margin: 0 });
      s.addText(p.pain, { x: x + 0.16, y: 3.48, w: 2.6, h: 0.8, fontFace: "Arial", fontSize: 9.5, color: MUTED, lineSpacing: 12.5, margin: 0 });
      s.addText(p.gets, { x: x + 0.16, y: 4.3, w: 2.6, h: 0.75, fontFace: "Arial", fontSize: 9.5, color: TEXT, lineSpacing: 12.5, margin: 0 });
    });
    pageno(s, 4);
    s.addNotes("SPEAKER 2 — 50s. Real personas from our UX sprint. One line each: Mateo wants efficiency, Priya wants safety and privacy, Lukas wants accountability. Every feature in the demo maps back to one of these three.");
  }

  // ---- 5. JUMP START --------------------------------------------------------------
  {
    const s = pres.addSlide();
    base(s);
    eyebrow(s, "Jump start", 0.55, 0.5);
    s.addText("Idea to deployed product in three weeks.", { x: 0.55, y: 0.85, w: 9, h: 0.6, fontFace: "Arial", fontSize: 28, bold: true, color: TEXT, margin: 0 });

    const weeks = [
      { t: "Week 1 — See", body: "Camera engine: 33-landmark pose tracking in the browser, honest rep counting, per-rep quality scoring, 115-exercise registry with per-movement form checks." },
      { t: "Week 2 — Think", body: "Full platform: AI weekly plans + one-off day workouts, coach chat with long-term memory, history, insights, workout builder — Supabase backend with RLS on every table." },
      { t: "Week 3 — Feel", body: "Realtime voice coaching, community (friends, shared workouts, weekly competitions), design system, hardening pass — deployed on Vercel." },
    ];
    weeks.forEach((wk, i) => {
      const x = 0.55 + i * 3.08;
      card(s, x, 1.75, 2.88, 2.5, i === 2 ? CARD2 : CARD);
      s.addText(wk.t, { x: x + 0.2, y: 1.95, w: 2.5, h: 0.4, fontFace: "Arial", fontSize: 14, bold: true, color: LIME, margin: 0 });
      s.addText(wk.body, { x: x + 0.2, y: 2.4, w: 2.5, h: 1.7, fontFace: "Arial", fontSize: 10, color: TEXT, lineSpacing: 13.5, margin: 0 });
    });
    // proof strip
    card(s, 0.55, 4.5, 8.94, 0.62, CARD2);
    s.addText([
      { text: "Shipped: ", options: { bold: true, color: LIME } },
      { text: "45+ production deployments · 13 database migrations · 115 exercises with custom AI-illustrated muscle maps · live at repmint.vercel.app", options: { color: TEXT } },
    ], { x: 0.8, y: 4.56, w: 8.5, h: 0.5, fontFace: "Arial", fontSize: 11.5, valign: "middle", margin: 0 });
    pageno(s, 5);
    s.addNotes("SPEAKER 2 — 45s. The jump start: we didn't spend three weeks on slides. See-Think-Feel arc. Point at the proof strip: forty-plus deployments, eleven migrations — this is a real product, and you can open it right now.");
  }

  // ---- 6. SOLUTION --------------------------------------------------------------
  {
    const s = pres.addSlide();
    base(s);
    eyebrow(s, "Solution", 0.55, 0.5);
    s.addText("One coach. Five superpowers.", { x: 0.55, y: 0.85, w: 9, h: 0.6, fontFace: "Arial", fontSize: 28, bold: true, color: TEXT, margin: 0 });

    const pillars = [
      { icon: ic.eye, t: "It sees", body: "On-device pose AI at 30fps. Only full range-of-motion reps count — half-reps don't fool it. Depth, tempo, time-under-tension, velocity-loss fatigue." },
      { icon: ic.voice, t: "It speaks", body: "A natural realtime voice in your ear during the set: one cue at a time, human trainer energy, ~300ms latency. Silent when it should be." },
      { icon: ic.brain, t: "It thinks", body: "AI weekly plans around your real life, one-off day workouts on demand, and a chat coach grounded in your actual training data." },
      { icon: ic.users, t: "It connects", body: "Friends, shared workouts, and week-long competitions on reps, sets, sessions, or minutes — accountability built in." },
      { icon: ic.lock, t: "It protects", body: "Video never leaves the device. Pose runs in the browser; only your numbers sync. Privacy is architecture, not a policy page." },
    ];
    pillars.forEach((p, i) => {
      const row = Math.floor(i / 3), col = i % 3;
      // Top row: 3 cards ending at x=9.59; bottom row: 2 wider cards, same edges.
      const w = row === 1 ? 4.42 : 2.88;
      const xx = row === 1 ? 0.55 + col * 4.62 : 0.55 + col * 3.08;
      const y = 1.7 + row * 1.8;
      card(s, xx, y, w, 1.62);
      s.addImage({ data: p.icon, x: xx + 0.22, y: y + 0.2, w: 0.34, h: 0.34 });
      s.addText(p.t, { x: xx + 0.66, y: y + 0.16, w: w - 0.8, h: 0.4, fontFace: "Arial", fontSize: 14.5, bold: true, color: TEXT, valign: "middle", margin: 0 });
      s.addText(p.body, { x: xx + 0.22, y: y + 0.58, w: w - 0.45, h: 0.95, fontFace: "Arial", fontSize: 9.5, color: MUTED, lineSpacing: 12.5, valign: "top", margin: 0 });
    });
    pageno(s, 6);
    s.addNotes("SPEAKER 2 — 60s. Five verbs: sees, speaks, thinks, connects, protects. The AI is NOT decorative (professor's canvas question 4): without the vision model there is no product — a form can't count your reps.");
  }

  // ---- 7. DEMO --------------------------------------------------------------
  {
    const s = pres.addSlide();
    base(s);
    eyebrow(s, "Live demo", 0.55, 0.5);
    s.addText("Watch it count. Hear it coach.", { x: 0.55, y: 0.85, w: 8.5, h: 0.6, fontFace: "Arial", fontSize: 28, bold: true, color: TEXT, margin: 0 });

    const steps = [
      "Prop the phone, raise a hand — 3·2·1, the set starts hands-free",
      "Squats live on stage: honest reps, depth %, one spoken cue at a time",
      "Ask the AI for a workout: \"chest and triceps, 30 minutes\" — saved in seconds",
      "Coach chat: \"did the pause trick work?\" — answers from real session data",
      "Community: live leaderboard in this week's competition",
    ];
    card(s, 0.55, 1.7, 5.55, 3.35);
    steps.forEach((t, i) => {
      s.addText(String(i + 1), { x: 0.8, y: 1.92 + i * 0.62, w: 0.4, h: 0.4, fontFace: "Arial", fontSize: 17, bold: true, color: LIME, margin: 0 });
      s.addText(t, { x: 1.28, y: 1.9 + i * 0.62, w: 4.65, h: 0.55, fontFace: "Arial", fontSize: 11, color: TEXT, valign: "middle", lineSpacing: 13.5, margin: 0 });
    });

    // Demo-setup art + QR + URL block
    card(s, 6.4, 1.7, 3.05, 3.35, CARD2);
    s.addImage({ path: "" + REPO + "/presentation/assets/demo-setup.jpg", x: 6.55, y: 1.85, w: 2.75, h: 1.55, sizing: { type: "cover", w: 2.75, h: 1.55 } });
    s.addImage({ data: qr, x: 6.72, y: 3.52, w: 1.0, h: 1.0 });
    s.addText("Deployed & open —\ntry it during Q&A", { x: 7.82, y: 3.6, w: 1.55, h: 0.85, fontFace: "Arial", fontSize: 9.5, color: MUTED, valign: "middle", lineSpacing: 13, margin: 0 });
    s.addText("repmint.vercel.app", { x: 6.55, y: 4.62, w: 2.75, h: 0.32, fontFace: "Courier New", fontSize: 11.5, bold: true, color: LIME, align: "center", margin: 0 });
    pageno(s, 7);
    s.addNotes("SPEAKER 3 — 3.5 min LIVE DEMO. Backup video ready on desktop. Order: train flow first (biggest wow), then AI workout builder, then coach chat grounded answer, then competitions leaderboard. If wifi dies: switch to backup video without commentary break.");
  }

  // ---- 8. BUSINESS VALUE --------------------------------------------------------------
  {
    const s = pres.addSlide();
    base(s);
    eyebrow(s, "Business value", 0.55, 0.5);
    s.addText("The coach that scales like software.", { x: 0.55, y: 0.85, w: 9, h: 0.6, fontFace: "Arial", fontSize: 28, bold: true, color: TEXT, margin: 0 });

    // left: model
    card(s, 0.55, 1.7, 4.5, 3.4);
    s.addText("Freemium, camera-first", { x: 0.8, y: 1.88, w: 4, h: 0.35, fontFace: "Arial", fontSize: 14, bold: true, color: LIME, margin: 0 });
    const tiers = [
      ["Free", "Camera coach, rep counting, starter workouts — the hook that shows the magic in 30 seconds."],
      ["Premium · €9.99/mo", "AI plans & day workouts, realtime voice, insights & load trends, competitions."],
      ["Later · B2B", "White-label for gym chains and university sports programs — every member gets a coach."],
    ];
    tiers.forEach((t, i) => {
      const y = 2.3 + i * 0.92;
      s.addText(t[0], { x: 0.8, y, w: 3.9, h: 0.3, fontFace: "Arial", fontSize: 12, bold: true, color: TEXT, margin: 0 });
      s.addText(t[1], { x: 0.8, y: y + 0.29, w: 3.95, h: 0.6, fontFace: "Arial", fontSize: 9.5, color: MUTED, lineSpacing: 12.5, margin: 0 });
    });

    // right: numbers
    const nums = [
      { big: "$6.8B", small: "fitness app market, growing double-digit annually" },
      { big: "~€0.05", small: "our AI cost per active training day — 99% gross margin on €9.99" },
      { big: "K-factor", small: "competitions require friends — the product invites for us" },
    ];
    nums.forEach((n, i) => {
      const y = 1.7 + i * 1.17;
      card(s, 5.3, y, 4.15, 1.02, CARD2);
      s.addText(n.big, { x: 5.5, y: y + 0.1, w: 1.6, h: 0.82, fontFace: "Arial", fontSize: 24, bold: true, color: LIME, valign: "middle", margin: 0 });
      s.addText(n.small, { x: 7.15, y: y + 0.1, w: 2.2, h: 0.82, fontFace: "Arial", fontSize: 9.5, color: TEXT, valign: "middle", lineSpacing: 12.5, margin: 0 });
    });
    pageno(s, 8);
    s.addNotes("SPEAKER 4 — 60s. Business logic: free tier demonstrates magic instantly (camera counts your reps in 30 seconds), premium unlocks the brain and the voice. Unit economics: pose runs on the user's device = zero inference cost for the core loop; AI calls cost cents. Social layer is the acquisition engine.");
  }

  // ---- 9. ARCHITECTURE --------------------------------------------------------------
  {
    const s = pres.addSlide();
    base(s);
    eyebrow(s, "Architecture", 0.55, 0.5);
    s.addText("Heavy where it matters, light everywhere else.", { x: 0.55, y: 0.85, w: 9, h: 0.6, fontFace: "Arial", fontSize: 26, bold: true, color: TEXT, margin: 0 });

    // Device box
    card(s, 0.55, 1.75, 3.0, 3.3, CARD2);
    s.addImage({ data: ic.mobile, x: 0.8, y: 1.95, w: 0.32, h: 0.32 });
    s.addText("Phone / browser", { x: 1.2, y: 1.92, w: 2.3, h: 0.38, fontFace: "Arial", fontSize: 12.5, bold: true, color: TEXT, valign: "middle", margin: 0 });
    [
      "Next.js 15 static app (Vercel CDN)",
      "MediaPipe pose — 33 landmarks, 30fps, fully on-device",
      "Rep engine + form scoring (deterministic logic)",
      "WebRTC audio ← realtime voice",
      "Video NEVER uploaded",
    ].forEach((t, i) => {
      s.addText(t, { x: 0.8, y: 2.42 + i * 0.51, w: 2.6, h: 0.48, fontFace: "Arial", fontSize: 9, color: i === 4 ? LIME : MUTED, lineSpacing: 11.5, valign: "top", margin: 0, bold: i === 4 });
    });

    // Supabase box
    card(s, 3.95, 1.75, 2.85, 3.3);
    s.addImage({ data: ic.db, x: 4.2, y: 1.95, w: 0.32, h: 0.32 });
    s.addText("Supabase", { x: 4.6, y: 1.92, w: 2, h: 0.38, fontFace: "Arial", fontSize: 12.5, bold: true, color: TEXT, valign: "middle", margin: 0 });
    [
      "Postgres + row-level security on every table",
      "Auth (email + magic link)",
      "Edge functions: ai-coach, generate-plan, tts, realtime-token…",
      "Only numbers & text stored — never media",
    ].forEach((t, i) => {
      s.addText(t, { x: 4.2, y: 2.42 + i * 0.62, w: 2.45, h: 0.6, fontFace: "Arial", fontSize: 9, color: MUTED, lineSpacing: 11.5, margin: 0 });
    });

    // AI box
    card(s, 7.15, 1.75, 2.3, 3.3, CARD2);
    s.addImage({ data: ic.cloud, x: 7.4, y: 1.95, w: 0.32, h: 0.32 });
    s.addText("AI providers", { x: 7.8, y: 1.92, w: 1.6, h: 0.38, fontFace: "Arial", fontSize: 12.5, bold: true, color: TEXT, valign: "middle", margin: 0 });
    [
      "OpenRouter → any LLM (user-selectable model)",
      "Gemini fallback chain",
      "OpenAI Realtime — voice over WebRTC",
      "Keys live server-side only",
    ].forEach((t, i) => {
      s.addText(t, { x: 7.4, y: 2.42 + i * 0.62, w: 1.95, h: 0.6, fontFace: "Arial", fontSize: 9, color: MUTED, lineSpacing: 11.5, margin: 0 });
    });

    // arrows
    s.addShape(pres.shapes.LINE, { x: 3.55, y: 3.35, w: 0.4, h: 0, line: { color: LIME, width: 2.25, endArrowType: "triangle", beginArrowType: "triangle" } });
    s.addShape(pres.shapes.LINE, { x: 6.8, y: 3.35, w: 0.35, h: 0, line: { color: LIME, width: 2.25, endArrowType: "triangle", beginArrowType: "triangle" } });
    pageno(s, 9);
    s.addNotes("SPEAKER 4 — 45s. One architectural idea to remember: the heavy AI (vision) runs on the USER'S device — that's what makes it private AND free to scale. The cloud only does what must be shared: data, auth, and language models. Every table has row-level security.");
  }

  // ---- 10. RELIABILITY --------------------------------------------------------------
  {
    const s = pres.addSlide();
    base(s);
    eyebrow(s, "Reliability & controls", 0.55, 0.5);
    s.addText("Built to be trusted, not just demoed.", { x: 0.55, y: 0.85, w: 9, h: 0.6, fontFace: "Arial", fontSize: 28, bold: true, color: TEXT, margin: 0 });

    const rows = [
      ["Hallucinated exercises", "Plans validate against a 115-slug allowlist — the model cannot invent a movement; outputs are clamped and re-asked once on invalid JSON."],
      ["Provider outages", "Every AI call has a fallback chain: OpenRouter → Gemini; realtime voice → TTS → on-device speech. The workout never goes silent."],
      ["Data leakage", "Row-level security on every table; the leaderboard is a guarded aggregate function — raw sessions stay private even from friends."],
      ["Overreach", "Coach declines off-topic and medical questions; 'coaching guidance, not medical advice' on every chat; claim-safe copy throughout."],
      ["Runaway voice", "The realtime agent physically cannot self-trigger: no microphone attached, turn-detection off, speaks only queued cues, session closes after the final line."],
    ];
    rows.forEach((r, i) => {
      const y = 1.65 + i * 0.71;
      card(s, 0.55, y, 8.9, 0.62);
      s.addText(r[0], { x: 0.8, y: y + 0.06, w: 2.15, h: 0.5, fontFace: "Arial", fontSize: 11, bold: true, color: TEAL, valign: "middle", margin: 0 });
      s.addText(r[1], { x: 3.05, y: y + 0.06, w: 6.25, h: 0.5, fontFace: "Arial", fontSize: 9.5, color: TEXT, valign: "middle", lineSpacing: 12, margin: 0 });
    });
    pageno(s, 10);
    s.addNotes("SPEAKER 4 (or 5) — 45s. This is the professor's 'Reliability, Risk and Controls' block, answered concretely. Pick two rows to say out loud (hallucinated exercises + runaway voice) and let them read the rest.");
  }

  // ---- 11. FUTURE WORK --------------------------------------------------------------
  {
    const s = pres.addSlide();
    base(s);
    eyebrow(s, "Future work & conclusions", 0.55, 0.5);
    s.addText("What's next — and what we proved.", { x: 0.55, y: 0.85, w: 9, h: 0.6, fontFace: "Arial", fontSize: 28, bold: true, color: TEXT, margin: 0 });

    card(s, 0.55, 1.7, 4.5, 3.4);
    s.addText("Next", { x: 0.8, y: 1.88, w: 3, h: 0.35, fontFace: "Arial", fontSize: 14, bold: true, color: LIME, margin: 0 });
    s.addText([
      { text: "Wearables: Strava sync + heart-rate for effort-aware coaching", options: { bullet: { indent: 12 }, breakLine: true } },
      { text: "Exercise form video library + camera-position guides", options: { bullet: { indent: 12 }, breakLine: true } },
      { text: "Workout marketplace: creators publish, athletes follow", options: { bullet: { indent: 12 }, breakLine: true } },
      { text: "B2B pilots: gym chains & university sport programs", options: { bullet: { indent: 12 }, breakLine: true } },
      { text: "Native companion for Apple Watch", options: { bullet: { indent: 12 } } },
    ], { x: 0.8, y: 2.28, w: 4.0, h: 2.6, fontFace: "Arial", fontSize: 11, color: TEXT, paraSpaceAfter: 8, valign: "top", margin: 0 });

    card(s, 5.3, 1.7, 4.15, 3.4, CARD2);
    s.addText("What we proved", { x: 5.55, y: 1.88, w: 3, h: 0.35, fontFace: "Arial", fontSize: 14, bold: true, color: TEAL, margin: 0 });
    s.addText([
      { text: "AI is necessary here, not decorative — no camera, no product", options: { bullet: { indent: 12 }, breakLine: true } },
      { text: "The full loop works today: see → coach → plan → remember → compete", options: { bullet: { indent: 12 }, breakLine: true } },
      { text: "Deployed, secured, and demo-able by anyone in this room right now", options: { bullet: { indent: 12 } } },
    ], { x: 5.55, y: 2.28, w: 3.7, h: 2.0, fontFace: "Arial", fontSize: 11, color: TEXT, paraSpaceAfter: 10, valign: "top", margin: 0 });
    s.addText("A smaller working MVP with evidence\nbeats an ambitious fake demo.", { x: 5.55, y: 4.25, w: 3.7, h: 0.7, fontFace: "Arial", fontSize: 11, italic: true, color: MUTED, lineSpacing: 14, margin: 0 });
    pageno(s, 11);
    s.addNotes("SPEAKER 4 (or 5) — 40s. Close on the professor's own principle: a smaller working MVP with evidence beats an ambitious fake demo. Ours works — you just watched it.");
  }

  // ---- 12. CLOSE --------------------------------------------------------------
  {
    const s = pres.addSlide();
    base(s);
    s.addImage({ path: "" + REPO + "/presentation/assets/close-hero.jpg", x: 0, y: 0, w: W, h: H, sizing: { type: "cover", w: W, h: H } });
    s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: W, h: H, fill: { color: BG, transparency: 55 } });
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 3.34, y: 0.85, w: 0.62, h: 0.62, fill: { color: LIME }, rectRadius: 0.16 });
    s.addImage({ data: ic.bolt, x: 3.47, y: 0.97, w: 0.37, h: 0.37 });
    s.addText("RepMint", { x: 4.05, y: 0.85, w: 2.6, h: 0.62, fontFace: "Arial", fontSize: 26, bold: true, italic: true, color: TEXT, valign: "middle", margin: 0 });
    s.addText("Stop guessing. Start counting.", { x: 0.5, y: 1.9, w: 9, h: 0.8, fontFace: "Arial", fontSize: 36, bold: true, color: TEXT, align: "center", margin: 0 });
    s.addImage({ data: qr, x: 4.2, y: 2.85, w: 1.6, h: 1.6 });
    s.addText("repmint.vercel.app   ·   github.com/simplyYK/repmint", { x: 0.5, y: 4.6, w: 9, h: 0.4, fontFace: "Courier New", fontSize: 13, bold: true, color: LIME, align: "center", margin: 0 });
    s.addNotes("ALL — 10s. 'We're Team RepMint. Scan it, train with it, ask us anything.' Stand for Q&A.");
  }

  await pres.writeFile({ fileName: OUT });
  console.log("written:", OUT);
})();
