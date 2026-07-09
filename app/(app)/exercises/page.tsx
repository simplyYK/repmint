"use client";

import "./exercises.css";

// /exercises — the full 115-exercise library. Reads synchronously from the TS
// registry via listMeta() (no DB round-trip), so search and filtering are
// instant and work offline / pre-seed. Every card links to /exercises/[slug].

import { useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader, Chip, Button } from "../../components/ui/primitives";
import { MovementGlyph } from "../../components/visuals";
import {
  listMeta,
  matchesQuery,
  glyphCategory,
  MUSCLE_LABEL,
  ALL_MUSCLES,
  ALL_EQUIPMENT,
  equipmentLabel,
  TIER_INFO,
} from "../../lib/library";
import type { ExerciseMeta, MuscleGroup, TrackingTier } from "../../lib/movements/types";

type Difficulty = ExerciseMeta["difficulty"];

const DIFFICULTIES: Difficulty[] = ["beginner", "intermediate", "advanced"];
const TIERS: TrackingTier[] = [1, 2, 3];

// Tier accent dot: tier1=mint accent, tier2=teal accent-2, tier3=muted.
function tierDotClass(tier: TrackingTier): string {
  if (tier === 1) return "ex-tier-dot ex-tier-dot-1";
  if (tier === 2) return "ex-tier-dot ex-tier-dot-2";
  return "ex-tier-dot ex-tier-dot-3";
}

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export default function ExercisesPage() {
  const all = useMemo(() => listMeta(), []);

  const [query, setQuery] = useState("");
  const [muscles, setMuscles] = useState<MuscleGroup[]>([]);
  const [equipment, setEquipment] = useState<string[]>([]);
  const [difficulties, setDifficulties] = useState<Difficulty[]>([]);
  const [tiers, setTiers] = useState<TrackingTier[]>([]);

  const hasFilters =
    query.trim().length > 0 ||
    muscles.length > 0 ||
    equipment.length > 0 ||
    difficulties.length > 0 ||
    tiers.length > 0;

  const results = useMemo(() => {
    return all.filter((meta) => {
      if (!matchesQuery(meta, query)) return false;
      if (muscles.length > 0) {
        const hit = muscles.some(
          (m) => meta.primaryMuscles.includes(m) || meta.secondaryMuscles.includes(m),
        );
        if (!hit) return false;
      }
      if (equipment.length > 0) {
        if (!equipment.some((eq) => meta.equipment.includes(eq as ExerciseMeta["equipment"][number])))
          return false;
      }
      if (difficulties.length > 0 && !difficulties.includes(meta.difficulty)) return false;
      if (tiers.length > 0 && !tiers.includes(meta.tier)) return false;
      return true;
    });
  }, [all, query, muscles, equipment, difficulties, tiers]);

  function clearFilters() {
    setQuery("");
    setMuscles([]);
    setEquipment([]);
    setDifficulties([]);
    setTiers([]);
  }

  return (
    <div className="stack">
      <PageHeader
        eyebrow="Exercise library"
        title="Browse every movement"
        subtitle="Search 115 exercises, filter by muscle, gear, difficulty and how the camera coaches each one."
      />

      <div className="ex-search">
        <input
          type="search"
          className="ex-search-input"
          placeholder="Search by name, alias or muscle…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search exercises"
        />
      </div>

      <div className="ex-filters">
        <fieldset className="ex-filter-group">
          <legend className="ex-filter-legend">Muscle</legend>
          <div className="ex-chip-row">
            {ALL_MUSCLES.map((m) => (
              <Chip key={m} active={muscles.includes(m)} onClick={() => setMuscles((cur) => toggle(cur, m))}>
                {MUSCLE_LABEL[m]}
              </Chip>
            ))}
          </div>
        </fieldset>

        <fieldset className="ex-filter-group">
          <legend className="ex-filter-legend">Equipment</legend>
          <div className="ex-chip-row">
            {ALL_EQUIPMENT.map((eq) => (
              <Chip
                key={eq}
                active={equipment.includes(eq)}
                onClick={() => setEquipment((cur) => toggle(cur, eq))}
              >
                {equipmentLabel(eq)}
              </Chip>
            ))}
          </div>
        </fieldset>

        <fieldset className="ex-filter-group">
          <legend className="ex-filter-legend">Difficulty</legend>
          <div className="ex-chip-row">
            {DIFFICULTIES.map((d) => (
              <Chip
                key={d}
                active={difficulties.includes(d)}
                onClick={() => setDifficulties((cur) => toggle(cur, d))}
              >
                {d[0].toUpperCase() + d.slice(1)}
              </Chip>
            ))}
          </div>
        </fieldset>

        <fieldset className="ex-filter-group">
          <legend className="ex-filter-legend">Coaching</legend>
          <div className="ex-chip-row">
            {TIERS.map((t) => (
              <Chip
                key={t}
                active={tiers.includes(t)}
                tone={t === 1 ? "accent" : t === 2 ? "live" : "neutral"}
                onClick={() => setTiers((cur) => toggle(cur, t))}
              >
                {TIER_INFO[t].label}
              </Chip>
            ))}
          </div>
        </fieldset>
      </div>

      <div className="ex-resultbar">
        <p className="ex-count">
          {results.length} {results.length === 1 ? "exercise" : "exercises"}
        </p>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Clear filters
          </Button>
        )}
      </div>

      {results.length === 0 ? (
        <div className="ex-empty">
          <p>No exercises match those filters yet.</p>
          <Button variant="secondary" size="sm" onClick={clearFilters}>
            Reset filters
          </Button>
        </div>
      ) : (
        <ul className="ex-grid">
          {results.map((meta) => (
            <li key={meta.slug}>
              <Link href={`/exercises/${meta.slug}`} className="ex-card card">
                <div className="ex-card-glyph">
                  <MovementGlyph category={glyphCategory(meta)} />
                </div>
                <div className="ex-card-body">
                  <strong className="ex-card-name">{meta.name}</strong>
                  <span className="ex-card-muscles">
                    {meta.primaryMuscles.map((m) => MUSCLE_LABEL[m]).join(" · ")}
                  </span>
                  <div className="ex-card-meta">
                    <span className="ex-tier-badge">
                      <span className={tierDotClass(meta.tier)} aria-hidden />
                      {TIER_INFO[meta.tier].short}
                    </span>
                    <span className="ex-diff">{meta.difficulty}</span>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
