// Calendar export for training plans. Pure client-side: builds a VCALENDAR
// string (one weekly-recurring VEVENT per non-rest plan day) and triggers a
// Blob download. No dependencies — the iCalendar subset here is deliberately
// small and Apple/Google/Outlook-safe.

import type { DbPlan, DbPlanDay } from "./types";
import type { TemplateWithExercises } from "./db";
import { getMeta } from "./library";

const CRLF = "\r\n";

/** Default start time for a training session when the plan has no times. */
const DEFAULT_HOUR = 18;
/** Fallback session length when the template has no estimate. */
const DEFAULT_MINUTES = 60;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Floating local date-time (no TZ suffix) — calendars show it in local time. */
function formatLocal(d: Date): string {
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `T${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  );
}

/** UTC timestamp for DTSTAMP. */
function formatUtc(d: Date): string {
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

/** Escape TEXT values per RFC 5545 §3.3.11. */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** Fold long content lines at ~73 chars with a leading space (RFC 5545 §3.1). */
function foldLine(line: string): string {
  if (line.length <= 73) return line;
  const parts: string[] = [];
  let rest = line;
  parts.push(rest.slice(0, 73));
  rest = rest.slice(73);
  while (rest.length > 0) {
    parts.push(` ${rest.slice(0, 72)}`);
    rest = rest.slice(72);
  }
  return parts.join(CRLF);
}

/** Next occurrence of `weekday` (0 = Sunday) at DEFAULT_HOUR, from now. */
function nextOccurrence(weekday: number, from: Date): Date {
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate(), DEFAULT_HOUR, 0, 0);
  let delta = (weekday - start.getDay() + 7) % 7;
  if (delta === 0 && from.getTime() >= start.getTime()) delta = 7;
  start.setDate(start.getDate() + delta);
  return start;
}

function exerciseLines(template: TemplateWithExercises | undefined): string {
  if (!template || template.exercises.length === 0) return "Open RepMint to run this session.";
  return template.exercises
    .map((ex) => {
      const name = getMeta(ex.exercise_slug)?.name ?? ex.exercise_slug;
      const target =
        ex.target_reps != null
          ? `${ex.sets}×${ex.target_reps}`
          : ex.target_seconds != null
            ? `${ex.sets}×${ex.target_seconds}s`
            : `${ex.sets} sets`;
      return `${target} ${name}`;
    })
    .join("\n");
}

/**
 * Builds a VCALENDAR for an active plan: one weekly-recurring VEVENT per
 * non-rest day (deduped by weekday), DTSTART on the next occurrence of that
 * weekday, COUNT capped to the plan length, and a 30-minute display alarm.
 */
export function generatePlanIcs(
  plan: DbPlan,
  days: DbPlanDay[],
  templates: TemplateWithExercises[],
): string {
  const byId = new Map(templates.map((t) => [t.id, t]));
  const now = new Date();
  const stamp = formatUtc(now);
  const seenWeekdays = new Set<number>();
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//RepMint//Training Plan//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(plan.title)}`,
  ];

  for (const day of days) {
    if (day.is_rest) continue;
    const weekday = day.weekday ?? day.day_index % 7;
    if (seenWeekdays.has(weekday)) continue;
    seenWeekdays.add(weekday);

    const template = day.template_id ? byId.get(day.template_id) : undefined;
    const summary = day.title || day.focus || template?.title || "Training day";
    const start = nextOccurrence(weekday, now);
    const minutes = template?.est_duration_min ?? DEFAULT_MINUTES;
    const end = new Date(start.getTime() + minutes * 60_000);
    const count = Math.max(1, plan.weeks);

    lines.push(
      "BEGIN:VEVENT",
      `UID:${plan.id}-day${weekday}@repmint`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${formatLocal(start)}`,
      `DTEND:${formatLocal(end)}`,
      `RRULE:FREQ=WEEKLY;COUNT=${count}`,
      `SUMMARY:${escapeText(summary)}`,
      `DESCRIPTION:${escapeText(exerciseLines(template))}`,
      "BEGIN:VALARM",
      "TRIGGER:-PT30M",
      "ACTION:DISPLAY",
      `DESCRIPTION:${escapeText(`Up next: ${summary}`)}`,
      "END:VALARM",
      "END:VEVENT",
    );
  }

  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join(CRLF) + CRLF;
}

/** Triggers a browser download of `text` as an .ics file. */
export function downloadIcs(filename: string, text: string): void {
  const blob = new Blob([text], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".ics") ? filename : `${filename}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
