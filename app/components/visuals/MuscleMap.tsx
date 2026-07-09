import type { MuscleGroup } from "../../lib/movements/types";

export type MuscleMapProps = {
  primary: MuscleGroup[];
  secondary: MuscleGroup[];
  className?: string;
};

type RegionState = "primary" | "secondary" | "none";

function stateOf(
  group: MuscleGroup,
  primary: MuscleGroup[],
  secondary: MuscleGroup[]
): RegionState {
  if (primary.includes(group) || primary.includes("full_body")) return "primary";
  if (secondary.includes(group) || secondary.includes("full_body")) return "secondary";
  return "none";
}

function regionClass(state: RegionState): string {
  if (state === "primary") return "rmviz-region rmviz-region-primary";
  if (state === "secondary") return "rmviz-region rmviz-region-secondary";
  return "rmviz-region";
}

/**
 * Anatomical front + back silhouette pair. Each <path> is tagged with a
 * MuscleGroup via the `group` param and gets primary/secondary/neutral fill
 * based on props. `full_body` lights every region at the secondary tier (or
 * primary tier if passed as primary) as a soft full-highlight.
 */
export function MuscleMap({ primary, secondary, className }: MuscleMapProps) {
  const s = (group: MuscleGroup) => stateOf(group, primary, secondary);
  const cls = (group: MuscleGroup) => regionClass(s(group));

  return (
    <div className={`rmviz-root rmviz-musclemap ${className ?? ""}`}>
      <div className="rmviz-musclemap-figures">
        {/* ---------------------------- FRONT VIEW ---------------------------- */}
        <svg
          viewBox="0 0 120 260"
          role="img"
          aria-label="Front body view highlighting targeted muscles"
          style={{ width: "100%", maxWidth: 220, height: "auto" }}
        >
          <text x="60" y="12" textAnchor="middle" className="rmviz-musclemap-figure-label">
            Front
          </text>

          <g transform="translate(0,14)">
            {/* base silhouette (outline only, non-interactive) */}
            <path
              className="rmviz-body-outline"
              d="M60 4
                 c8 0 14 6 14 14 c0 6 -3 10 -3 10
                 c10 3 18 10 20 20 l4 26 c1 6 -3 10 -7 10 l-3 20
                 c6 4 9 12 9 20 l2 46 c1 8 -2 14 -8 15 l1 40 c0 6 -4 10 -9 10
                 l-2 -46 -3 -34 -3 34 -1 46 c-1 6 -6 9 -10 8
                 c-4 1 -9 -2 -10 -8 l-1 -46 -3 -34 -3 34 -2 46
                 c-1 6 -6 9 -10 8 c-5 -1 -9 -5 -8 -11 l1 -40
                 c-6 -1 -9 -7 -8 -15 l2 -46 c0 -8 3 -16 9 -20 l-3 -20
                 c-4 0 -8 -4 -7 -10 l4 -26 c2 -10 10 -17 20 -20
                 c0 0 -3 -4 -3 -10 c0 -8 6 -14 14 -14 z"
            />

            {/* neck */}
            <rect className="rmviz-body-detail" x="54" y="16" width="12" height="10" rx="3" />

            {/* SHOULDERS (deltoids) - front caps */}
            <path
              className={cls("shoulders")}
              d="M38 46 c-8 2 -15 8 -17 16 l3 10 c4 -2 9 -8 12 -12 c3 -4 4 -10 2 -14 z"
            />
            <path
              className={cls("shoulders")}
              d="M82 46 c8 2 15 8 17 16 l-3 10 c-4 -2 -9 -8 -12 -12 c-3 -4 -4 -10 -2 -14 z"
            />

            {/* CHEST (pecs) */}
            <path
              className={cls("chest")}
              d="M60 48 c-8 0 -15 4 -17 12 c-1 6 1 13 6 16 c4 2 8 1 11 -2 l0 -26 z"
            />
            <path
              className={cls("chest")}
              d="M60 48 c8 0 15 4 17 12 c1 6 -1 13 -6 16 c-4 2 -8 1 -11 -2 l0 -26 z"
            />

            {/* BICEPS */}
            <path
              className={cls("biceps")}
              d="M22 64 c-3 6 -5 14 -5 22 l7 2 c1 -8 2 -16 4 -22 z"
            />
            <path
              className={cls("biceps")}
              d="M98 64 c3 6 5 14 5 22 l-7 2 c-1 -8 -2 -16 -4 -22 z"
            />

            {/* FOREARMS */}
            <path
              className={cls("forearms")}
              d="M17 90 c-1 8 -1 16 1 23 l7 -1 c-1 -7 -1 -15 0 -21 z"
            />
            <path
              className={cls("forearms")}
              d="M103 90 c1 8 1 16 -1 23 l-7 -1 c1 -7 1 -15 0 -21 z"
            />

            {/* CORE (abs) */}
            <path
              className={cls("core")}
              d="M49 76 h22 l1 34 c-4 3 -8 4 -12 4 c-4 0 -8 -1 -12 -4 z"
            />

            {/* OBLIQUES */}
            <path className={cls("obliques")} d="M40 78 c-3 8 -3 20 -1 30 l8 2 c-2 -11 -2 -22 0 -32 z" />
            <path className={cls("obliques")} d="M80 78 c3 8 3 20 1 30 l-8 2 c2 -11 2 -22 0 -32 z" />

            {/* HIP FLEXORS */}
            <path className={cls("hip_flexors")} d="M46 112 c-4 4 -6 9 -6 14 l9 1 c0 -5 1 -10 3 -14 z" />
            <path className={cls("hip_flexors")} d="M74 112 c4 4 6 9 6 14 l-9 1 c0 -5 -1 -10 -3 -14 z" />

            {/* QUADS */}
            <path
              className={cls("quads")}
              d="M43 118 c-5 4 -8 11 -8 20 l1 30 c3 3 7 4 11 3 l2 -50 z"
            />
            <path
              className={cls("quads")}
              d="M77 118 c5 4 8 11 8 20 l-1 30 c-3 3 -7 4 -11 3 l-2 -50 z"
            />

            {/* ADDUCTORS (inner thigh) */}
            <path className={cls("adductors")} d="M55 120 l-2 46 h7 l2 -46 z" />
            <path className={cls("adductors")} d="M65 120 l2 46 h-7 l-2 -46 z" />

            {/* ABDUCTORS (outer hip) */}
            <path className={cls("abductors")} d="M38 116 c-3 6 -4 12 -3 18 l6 0 c0 -6 1 -12 3 -17 z" />
            <path className={cls("abductors")} d="M82 116 c3 6 4 12 3 18 l-6 0 c0 -6 -1 -12 -3 -17 z" />

            {/* CALVES (front = shin/lower leg, lighter tone) */}
            <path className={cls("calves")} d="M46 172 c-2 8 -3 18 -2 28 l7 1 c0 -10 0 -20 1 -29 z" />
            <path className={cls("calves")} d="M74 172 c2 8 3 18 2 28 l-7 1 c0 -10 0 -20 -1 -29 z" />
          </g>
        </svg>

        {/* ---------------------------- BACK VIEW ---------------------------- */}
        <svg
          viewBox="0 0 120 260"
          role="img"
          aria-label="Back body view highlighting targeted muscles"
          style={{ width: "100%", maxWidth: 220, height: "auto" }}
        >
          <text x="60" y="12" textAnchor="middle" className="rmviz-musclemap-figure-label">
            Back
          </text>

          <g transform="translate(0,14)">
            <path
              className="rmviz-body-outline"
              d="M60 4
                 c8 0 14 6 14 14 c0 6 -3 10 -3 10
                 c10 3 18 10 20 20 l4 26 c1 6 -3 10 -7 10 l-3 20
                 c6 4 9 12 9 20 l2 46 c1 8 -2 14 -8 15 l1 40 c0 6 -4 10 -9 10
                 l-2 -46 -3 -34 -3 34 -1 46 c-1 6 -6 9 -10 8
                 c-4 1 -9 -2 -10 -8 l-1 -46 -3 -34 -3 34 -2 46
                 c-1 6 -6 9 -10 8 c-5 -1 -9 -5 -8 -11 l1 -40
                 c-6 -1 -9 -7 -8 -15 l2 -46 c0 -8 3 -16 9 -20 l-3 -20
                 c-4 0 -8 -4 -7 -10 l4 -26 c2 -10 10 -17 20 -20
                 c0 0 -3 -4 -3 -10 c0 -8 6 -14 14 -14 z"
            />

            <rect className="rmviz-body-detail" x="54" y="16" width="12" height="10" rx="3" />

            {/* TRAPS */}
            <path
              className={cls("traps")}
              d="M60 42 l-16 10 c4 6 10 10 16 10 c6 0 12 -4 16 -10 z"
            />

            {/* SHOULDERS (rear delts) */}
            <path className={cls("shoulders")} d="M38 46 c-8 2 -15 8 -17 16 l3 10 c4 -2 9 -8 12 -12 c3 -4 4 -10 2 -14 z" />
            <path className={cls("shoulders")} d="M82 46 c8 2 15 8 17 16 l-3 10 c-4 -2 -9 -8 -12 -12 c-3 -4 -4 -10 -2 -14 z" />

            {/* BACK / LATS */}
            <path
              className={cls("back")}
              d="M60 58 c-10 0 -18 4 -20 12 l-2 20 c-1 6 2 10 6 11 c5 1 9 -2 10 -6 l3 -20 z"
            />
            <path
              className={cls("back")}
              d="M60 58 c10 0 18 4 20 12 l2 20 c1 6 -2 10 -6 11 c-5 1 -9 -2 -10 -6 l-3 -20 z"
            />

            <path
              className={cls("lats")}
              d="M40 80 c-2 8 -2 18 0 26 l8 2 c-2 -10 -2 -20 0 -30 z"
            />
            <path
              className={cls("lats")}
              d="M80 80 c2 8 2 18 0 26 l-8 2 c2 -10 2 -20 0 -30 z"
            />

            {/* LOWER BACK */}
            <path className={cls("lower_back")} d="M49 100 h22 l1 18 c-4 3 -8 4 -12 4 c-4 0 -8 -1 -12 -4 z" />

            {/* BICEPS (rear arm mass not shown separately — triceps dominate rear) */}
            <path className={cls("triceps")} d="M22 64 c-3 6 -5 14 -5 22 l7 2 c1 -8 2 -16 4 -22 z" />
            <path className={cls("triceps")} d="M98 64 c3 6 5 14 5 22 l-7 2 c-1 -8 -2 -16 -4 -22 z" />

            {/* FOREARMS */}
            <path className={cls("forearms")} d="M17 90 c-1 8 -1 16 1 23 l7 -1 c-1 -7 -1 -15 0 -21 z" />
            <path className={cls("forearms")} d="M103 90 c1 8 1 16 -1 23 l-7 -1 c1 -7 1 -15 0 -21 z" />

            {/* GLUTES */}
            <path
              className={cls("glutes")}
              d="M42 118 c-4 4 -6 10 -6 16 c0 6 4 10 10 11 c4 1 9 -1 12 -4 l1 -20 c-6 -2 -12 -3 -17 -3 z"
            />
            <path
              className={cls("glutes")}
              d="M78 118 c4 4 6 10 6 16 c0 6 -4 10 -10 11 c-4 1 -9 -1 -12 -4 l-1 -20 c6 -2 12 -3 17 -3 z"
            />

            {/* HAMSTRINGS */}
            <path
              className={cls("hamstrings")}
              d="M45 148 c-4 4 -6 10 -6 17 l1 22 c3 3 7 4 11 3 l1 -41 z"
            />
            <path
              className={cls("hamstrings")}
              d="M75 148 c4 4 6 10 6 17 l-1 22 c-3 3 -7 4 -11 3 l-1 -41 z"
            />

            {/* ADDUCTORS */}
            <path className={cls("adductors")} d="M55 150 l-1 40 h6 l1 -40 z" />
            <path className={cls("adductors")} d="M65 150 l1 40 h-6 l-1 -40 z" />

            {/* CALVES */}
            <path className={cls("calves")} d="M46 190 c-2 8 -3 18 -2 28 l7 1 c0 -10 0 -20 1 -29 z" />
            <path className={cls("calves")} d="M74 190 c2 8 3 18 2 28 l-7 1 c0 -10 0 -20 -1 -29 z" />
          </g>
        </svg>
      </div>
    </div>
  );
}

export default MuscleMap;
