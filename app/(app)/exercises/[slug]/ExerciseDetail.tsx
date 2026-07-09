"use client";

import "./detail.css";

// Detail view for a single exercise. Metadata is read synchronously from the TS
// registry via getMeta(). Tier 1/2 movements route into the camera coach; tier 3
// movements get a quick manual log sheet that writes a single-exercise session.

import { useState } from "react";
import Link from "next/link";
import {
  PageHeader,
  Card,
  Button,
  LinkButton,
  Chip,
  InlineNotice,
  SectionTitle,
} from "../../../components/ui/primitives";
import { MuscleMap } from "../../../components/visuals";
import { getMeta, equipmentLabel, TIER_INFO } from "../../../lib/library";
import { saveSession, getProfile } from "../../../lib/db";

type Units = "kg" | "lb";

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

export default function ExerciseDetail({ slug }: { slug: string }) {
  const meta = getMeta(slug);

  // Manual-log sheet state (tier 3).
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sets, setSets] = useState(3);
  const [reps, setReps] = useState(10);
  const [weight, setWeight] = useState(0);
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!meta) {
    return (
      <div className="stack">
        <PageHeader eyebrow="Exercise library" title="Exercise not found" />
        <Card>
          <p>We couldn&apos;t find that exercise in the library.</p>
          <LinkButton href="/exercises" variant="secondary">
            Back to library
          </LinkButton>
        </Card>
      </div>
    );
  }

  const tier = TIER_INFO[meta.tier];
  const isBodyweight = meta.loadType === "bodyweight";

  async function handleSave() {
    if (!meta) return;
    setSaving(true);
    setError(null);
    try {
      const profile = await getProfile().catch(() => null);
      const units: Units = (profile?.units as Units) ?? "kg";
      const now = new Date().toISOString();
      const rows = Array.from({ length: sets }, (_, i) => ({
        exerciseSlug: meta.slug,
        setIndex: i,
        reps,
        weight: isBodyweight ? null : weight,
        weightUnit: units,
        isBodyweight,
      }));
      const id = await saveSession(
        {
          title: meta.name,
          startedAt: now,
          endedAt: now,
          status: "completed",
        },
        rows,
      );
      setSavedId(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save your log. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="stack">
      <PageHeader
        eyebrow="Exercise library"
        title={meta.name}
        subtitle={meta.aliases.length ? `Also known as ${meta.aliases.join(", ")}` : undefined}
        actions={
          <Link href="/exercises" className="chip">
            ← Library
          </Link>
        }
      />

      <div className="ed-top">
        <Card className="ed-map-card">
          <MuscleMap primary={meta.primaryMuscles} secondary={meta.secondaryMuscles} />
        </Card>

        <Card className="ed-summary">
          <div className="ed-badges">
            <span className="ed-diff">{meta.difficulty}</span>
            <span className="ed-tier">
              <span className={`ed-tier-dot ed-tier-dot-${meta.tier}`} aria-hidden />
              {tier.label}
            </span>
          </div>
          <p className="ed-tier-blurb">{tier.blurb}</p>

          <div className="ed-chip-row">
            {meta.equipment.map((eq) => (
              <Chip key={eq}>{equipmentLabel(eq)}</Chip>
            ))}
          </div>

          <dl className="ed-facts">
            <div>
              <dt>Range of motion</dt>
              <dd>{meta.romGuideline}</dd>
            </div>
            {meta.tutTarget && (
              <div>
                <dt>Time under tension</dt>
                <dd>
                  {meta.tutTarget[0]}s–{meta.tutTarget[1]}s per rep
                </dd>
              </div>
            )}
          </dl>

          <div className="ed-cta">
            {meta.tier === 1 || meta.tier === 2 ? (
              <LinkButton href={`/train?slug=${meta.slug}`} full size="lg">
                Train with camera
              </LinkButton>
            ) : savedId ? (
              <InlineNotice tone="info">
                Logged {sets} × {reps}
                {!isBodyweight && weight > 0 ? ` at ${weight}` : ""}.{" "}
                <Link href="/history">View in history →</Link>
              </InlineNotice>
            ) : (
              <Button full size="lg" onClick={() => setSheetOpen((v) => !v)}>
                {sheetOpen ? "Hide log" : "Log manually"}
              </Button>
            )}
          </div>

          {meta.tier === 3 && sheetOpen && !savedId && (
            <div className="ed-sheet">
              <Stepper
                label="Sets"
                value={sets}
                onChange={(v) => setSets(clamp(v, 1, 20))}
                min={1}
                max={20}
              />
              <Stepper
                label="Reps"
                value={reps}
                onChange={(v) => setReps(clamp(v, 1, 100))}
                min={1}
                max={100}
              />
              {!isBodyweight && (
                <Stepper
                  label="Weight"
                  value={weight}
                  onChange={(v) => setWeight(clamp(v, 0, 999))}
                  min={0}
                  max={999}
                  step={2.5}
                />
              )}
              {error && <InlineNotice tone="danger">{error}</InlineNotice>}
              <Button full onClick={handleSave} disabled={saving}>
                {saving ? "Saving…" : "Save log"}
              </Button>
            </div>
          )}
        </Card>
      </div>

      <Card>
        <SectionTitle>How to do it</SectionTitle>
        <ol className="ed-steps">
          {meta.instructions.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>
      </Card>

      <div className="ed-grid">
        <Card>
          <SectionTitle>Focus points</SectionTitle>
          <ul className="ed-list">
            {meta.formPoints.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </Card>

        <Card>
          <SectionTitle>Common mistakes</SectionTitle>
          <ul className="ed-list ed-list-warn">
            {meta.commonMistakes.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        </Card>
      </div>

      {meta.safetyNote && (
        <InlineNotice tone="info">{meta.safetyNote}</InlineNotice>
      )}
    </div>
  );
}

function Stepper({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
}) {
  return (
    <div className="ed-stepper">
      <span className="ed-stepper-label">{label}</span>
      <div className="ed-stepper-controls">
        <button
          type="button"
          className="ed-stepper-btn"
          onClick={() => onChange(value - step)}
          disabled={value <= min}
          aria-label={`Decrease ${label.toLowerCase()}`}
        >
          −
        </button>
        <span className="ed-stepper-value">{value}</span>
        <button
          type="button"
          className="ed-stepper-btn"
          onClick={() => onChange(value + step)}
          disabled={value >= max}
          aria-label={`Increase ${label.toLowerCase()}`}
        >
          +
        </button>
      </div>
    </div>
  );
}
