// Maps a workout's title/focus/description to the most relevant athlete
// photo in public/images/athletes/, so a "Chest & Triceps" hero doesn't show
// a deadlift. Falls back to the generic focus shot.

const RULES: Array<[RegExp, string]> = [
  [/(push|chest|tricep|bench|press-up|push-up|pushup)/i, "/images/athletes/pushup.jpg"],
  [/(pull|back\b|row|deadlift|hinge|lat\b)/i, "/images/athletes/deadlift.jpg"],
  [/(leg|squat|glute|lower|lunge)/i, "/images/athletes/squat-rack.jpg"],
  [/(kettlebell|conditioning|swing|cardio|hiit|full.?body|explosive)/i, "/images/athletes/kettlebell.jpg"],
  [/(room|home|bodyweight|core|minimum|plank|mobility|stretch)/i, "/images/athletes/home-training.jpg"],
  [/(shoulder|overhead|arm|curl)/i, "/images/athletes/kettlebell.jpg"],
];

export function athleteImageFor(...hints: Array<string | null | undefined>): string {
  const text = hints.filter(Boolean).join(" ");
  for (const [re, img] of RULES) {
    if (re.test(text)) return img;
  }
  return "/images/athletes/focus.jpg";
}
