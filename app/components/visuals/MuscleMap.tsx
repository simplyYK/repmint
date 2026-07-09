import type { MuscleGroup } from "../../lib/movements/types";

export type MuscleMapProps = {
  primary: MuscleGroup[];
  secondary: MuscleGroup[];
  className?: string;
};

const LABEL: Record<MuscleGroup, string> = {
  chest: "Chest",
  back: "Back",
  shoulders: "Shoulders",
  biceps: "Biceps",
  triceps: "Triceps",
  forearms: "Forearms",
  quads: "Quads",
  hamstrings: "Hamstrings",
  glutes: "Glutes",
  calves: "Calves",
  core: "Core",
  obliques: "Obliques",
  hip_flexors: "Hip flexors",
  adductors: "Inner thighs",
  abductors: "Outer hips",
  traps: "Traps",
  lats: "Lats",
  lower_back: "Lower back",
  full_body: "Full body",
};

/**
 * Muscles-worked panel: brand illustrations (one per muscle group, generated
 * in the app's dark/lime style, in public/images/muscles/) for up to two
 * primary movers, with the full primary/secondary breakdown as a caption.
 * `full_body` collapses to its single whole-body image.
 */
export function MuscleMap({ primary, secondary, className }: MuscleMapProps) {
  const shown: MuscleGroup[] = primary.includes("full_body") ? ["full_body"] : primary.slice(0, 2);
  const alsoWorks = secondary.filter((m) => !shown.includes(m));

  return (
    <div className={`rmviz-root rmviz-musclemap ${className ?? ""}`}>
      <div className={`rmviz-muscle-figs rmviz-muscle-figs-${shown.length}`}>
        {shown.map((m) => (
          <figure key={m} className="rmviz-muscle-fig">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/images/muscles/${m}.webp`}
              alt={`Body outline with the ${LABEL[m].toLowerCase()} highlighted`}
              loading="lazy"
            />
            <figcaption>{LABEL[m]}</figcaption>
          </figure>
        ))}
      </div>
      <p className="rmviz-muscle-caption">
        <strong>Primary:</strong> {primary.map((m) => LABEL[m]).join(", ")}
        {alsoWorks.length > 0 && (
          <>
            {" "}
            · <span>Also works: {alsoWorks.map((m) => LABEL[m]).join(", ")}</span>
          </>
        )}
      </p>
    </div>
  );
}

export default MuscleMap;
