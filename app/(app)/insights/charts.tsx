"use client";

// Hand-rolled, dependency-free SVG chart primitives for /insights. Every chart
// is typed, responsive (viewBox + preserveAspectRatio), and animates in with
// transform/opacity only — disabled under prefers-reduced-motion via CSS
// (see insights.css). No chart library.

import { useEffect, useState } from "react";

/** Respects prefers-reduced-motion; returns true once mount animation may run. */
function useMountAnim(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setOn(true);
      return;
    }
    const id = window.requestAnimationFrame(() => setOn(true));
    return () => window.cancelAnimationFrame(id);
  }, []);
  return on;
}

export type BarDatum = { label: string; value: number; sub?: string };

/** Vertical bar chart. Bars grow from the baseline on mount. */
export function BarChart({
  data,
  height = 150,
  accent = "var(--accent)",
  valueFormat = (v) => String(Math.round(v)),
}: {
  data: BarDatum[];
  height?: number;
  accent?: string;
  valueFormat?: (v: number) => string;
}) {
  const mounted = useMountAnim();
  const width = 320;
  const pad = { top: 14, bottom: 26, left: 6, right: 6 };
  const max = Math.max(1, ...data.map((d) => d.value));
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const n = Math.max(1, data.length);
  const slot = innerW / n;
  const barW = Math.min(30, slot * 0.62);

  return (
    <svg className="rm-chart" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Bar chart">
      <line className="rm-axis" x1={pad.left} y1={pad.top + innerH} x2={width - pad.right} y2={pad.top + innerH} />
      {data.map((d, i) => {
        const h = (d.value / max) * innerH;
        const x = pad.left + slot * i + (slot - barW) / 2;
        const y = pad.top + innerH - h;
        return (
          <g key={i}>
            <rect
              className={`rm-bar${mounted ? " in" : ""}`}
              x={x}
              y={y}
              width={barW}
              height={Math.max(0, h)}
              rx={4}
              fill={accent}
              style={{ transformOrigin: `${x + barW / 2}px ${pad.top + innerH}px`, transitionDelay: `${i * 40}ms` }}
            />
            {d.value > 0 && (
              <text className="rm-bar-value" x={x + barW / 2} y={y - 4} textAnchor="middle">
                {valueFormat(d.value)}
              </text>
            )}
            <text className="rm-axis-label" x={x + barW / 2} y={height - 8} textAnchor="middle">
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export type LinePoint = { label: string; value: number | null };

/** Line chart with a mount reveal (stroke wipe via dashoffset). */
export function LineChart({
  data,
  height = 150,
  accent = "var(--accent)",
  valueFormat = (v) => String(Math.round(v)),
}: {
  data: LinePoint[];
  height?: number;
  accent?: string;
  valueFormat?: (v: number) => string;
}) {
  const mounted = useMountAnim();
  const width = 320;
  const pad = { top: 16, bottom: 26, left: 8, right: 8 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const vals = data.map((d) => d.value).filter((v): v is number => v != null);
  const max = Math.max(1, ...vals);
  const min = Math.min(0, ...vals);
  const range = max - min || 1;
  const n = Math.max(1, data.length - 1);

  const xy = data.map((d, i) => {
    const x = pad.left + (innerW / n) * i;
    const y = d.value == null ? null : pad.top + innerH - ((d.value - min) / range) * innerH;
    return { x, y, d };
  });
  const drawn = xy.filter((p): p is { x: number; y: number; d: LinePoint } => p.y != null);
  const path = drawn.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const areaPath =
    drawn.length > 1
      ? `${path} L${drawn[drawn.length - 1].x.toFixed(1)} ${pad.top + innerH} L${drawn[0].x.toFixed(1)} ${pad.top + innerH} Z`
      : "";

  return (
    <svg className="rm-chart" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Line chart">
      <line className="rm-axis" x1={pad.left} y1={pad.top + innerH} x2={width - pad.right} y2={pad.top + innerH} />
      {areaPath && <path className={`rm-line-area${mounted ? " in" : ""}`} d={areaPath} fill={accent} />}
      {path && (
        <path
          className={`rm-line${mounted ? " in" : ""}`}
          d={path}
          fill="none"
          stroke={accent}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      {drawn.map((p, i) => (
        <circle key={i} className={`rm-line-dot${mounted ? " in" : ""}`} cx={p.x} cy={p.y} r={3} fill={accent} style={{ transitionDelay: `${300 + i * 30}ms` }} />
      ))}
      {drawn.length > 0 && (
        <text className="rm-bar-value" x={drawn[drawn.length - 1].x} y={drawn[drawn.length - 1].y - 7} textAnchor="end">
          {valueFormat(drawn[drawn.length - 1].d.value as number)}
        </text>
      )}
      {data.map((d, i) => {
        if (i % 2 !== 0 && data.length > 8) return null;
        const x = pad.left + (innerW / n) * i;
        return (
          <text key={`l-${i}`} className="rm-axis-label" x={x} y={height - 8} textAnchor="middle">
            {d.label}
          </text>
        );
      })}
    </svg>
  );
}

/** Compact sparkline (no axes/labels) for per-exercise cards. */
export function Sparkline({ values, accent = "var(--accent-2)" }: { values: number[]; accent?: string }) {
  const mounted = useMountAnim();
  const width = 120;
  const height = 40;
  const pad = 4;
  if (values.length === 0) return null;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const n = Math.max(1, values.length - 1);
  const pts = values.map((v, i) => ({
    x: pad + ((width - pad * 2) / n) * i,
    y: pad + (height - pad * 2) - ((v - min) / range) * (height - pad * 2),
  }));
  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const last = pts[pts.length - 1];
  return (
    <svg className="rm-spark" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label="Trend sparkline">
      <path className={`rm-line${mounted ? " in" : ""}`} d={path} fill="none" stroke={accent} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle className={`rm-line-dot${mounted ? " in" : ""}`} cx={last.x} cy={last.y} r={2.5} fill={accent} style={{ transitionDelay: "260ms" }} />
    </svg>
  );
}

export type HeatCell = { level: number; label: string };

/** GitHub-style consistency heatmap: weeks (columns) × 7 days (rows). */
export function Heatmap({ weeks }: { weeks: HeatCell[][] }) {
  const mounted = useMountAnim();
  const cell = 15;
  const gap = 4;
  const rows = 7;
  const cols = weeks.length;
  const width = cols * (cell + gap);
  const height = rows * (cell + gap);
  const dayLabels = ["M", "", "W", "", "F", "", "S"];
  return (
    <svg
      className="rm-heat"
      viewBox={`0 0 ${width + 16} ${height}`}
      preserveAspectRatio="xMinYMid meet"
      role="img"
      aria-label="Training consistency over the last weeks"
    >
      {dayLabels.map((d, r) =>
        d ? (
          <text key={`d-${r}`} className="rm-heat-daylabel" x={0} y={r * (cell + gap) + cell - 3}>
            {d}
          </text>
        ) : null,
      )}
      <g transform="translate(16,0)">
        {weeks.map((col, ci) =>
          col.map((c, ri) => (
            <rect
              key={`${ci}-${ri}`}
              className={`rm-heat-cell rm-heat-l${c.level}${mounted ? " in" : ""}`}
              x={ci * (cell + gap)}
              y={ri * (cell + gap)}
              width={cell}
              height={cell}
              rx={3}
              style={{ transitionDelay: `${(ci * 7 + ri) * 4}ms` }}
            >
              <title>{c.label}</title>
            </rect>
          )),
        )}
      </g>
    </svg>
  );
}
