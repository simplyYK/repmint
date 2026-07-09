"use client";

// Per-set weight quick-log: numeric stepper, kg/lb from settings, bodyweight
// toggle, remembers last weight per exercise. Values stay editable afterwards.

import { useEffect, useState } from "react";

export function WeightLogger({
  unit,
  loadType,
  initialWeight,
  initialBodyweight,
  onChange,
  compact,
}: {
  unit: "kg" | "lb";
  loadType: "bodyweight" | "external" | "both";
  initialWeight: number | null;
  initialBodyweight: boolean;
  onChange: (weight: number | null, isBodyweight: boolean) => void;
  compact?: boolean;
}) {
  const [bodyweight, setBodyweight] = useState(initialBodyweight);
  const [weight, setWeight] = useState<number>(initialWeight ?? 0);
  const step = unit === "kg" ? 2.5 : 5;

  useEffect(() => {
    onChange(bodyweight ? null : weight, bodyweight);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bodyweight, weight]);

  const canBodyweight = loadType !== "external";
  const showWeight = !bodyweight;

  const bump = (delta: number) => setWeight((w) => Math.max(0, Math.round((w + delta) * 10) / 10));

  return (
    <div className={`weight-logger${compact ? " compact" : ""}`}>
      {canBodyweight && (
        <div className="seg weight-mode">
          <button type="button" className={bodyweight ? "active" : ""} onClick={() => setBodyweight(true)}>
            Bodyweight
          </button>
          <button type="button" className={!bodyweight ? "active" : ""} onClick={() => setBodyweight(false)}>
            Weighted
          </button>
        </div>
      )}
      {showWeight && (
        <div className="weight-stepper">
          <button type="button" aria-label="Decrease weight" onClick={() => bump(-step)} className="stepper-btn">
            −
          </button>
          <div className="weight-value">
            <input
              type="number"
              inputMode="decimal"
              value={weight}
              min={0}
              step={step}
              onChange={(e) => setWeight(Math.max(0, Number(e.target.value) || 0))}
              aria-label={`Weight in ${unit}`}
            />
            <span>{unit}</span>
          </div>
          <button type="button" aria-label="Increase weight" onClick={() => bump(step)} className="stepper-btn">
            +
          </button>
        </div>
      )}
    </div>
  );
}
