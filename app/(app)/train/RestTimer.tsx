"use client";

// Rest timer shown between sets. Counts down from the set's rest target with
// skip / extend controls. Calls onDone when it reaches zero or is skipped.

import { useEffect, useRef, useState } from "react";
import { formatClock } from "../../lib/format";

export function RestTimer({
  seconds,
  nextLabel,
  onDone,
}: {
  seconds: number;
  nextLabel: string;
  onDone: () => void;
}) {
  const [remaining, setRemaining] = useState(seconds);
  const [total, setTotal] = useState(seconds);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    setRemaining(seconds);
    setTotal(seconds);
  }, [seconds]);

  // Tick down with a pure updater; completion fires from an effect so React
  // Strict Mode's double-invoked updaters can't call onDone twice.
  useEffect(() => {
    const id = window.setInterval(() => {
      setRemaining((r) => Math.max(0, r - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [total]);

  const firedRef = useRef(false);
  useEffect(() => {
    if (remaining === 0 && total > 0 && !firedRef.current) {
      firedRef.current = true;
      doneRef.current();
    }
  }, [remaining, total]);

  const pct = total > 0 ? (remaining / total) * 100 : 0;

  return (
    <div className="rest-timer">
      <p className="eyebrow">Rest</p>
      <div className="rest-ring" role="timer" aria-live="polite">
        <svg viewBox="0 0 120 120" width="180" height="180">
          <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8" />
          <circle
            cx="60"
            cy="60"
            r="52"
            fill="none"
            stroke="var(--accent)"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={2 * Math.PI * 52}
            strokeDashoffset={2 * Math.PI * 52 * (1 - pct / 100)}
            transform="rotate(-90 60 60)"
            style={{ transition: "stroke-dashoffset 1s linear" }}
          />
          <text x="60" y="66" textAnchor="middle" fontSize="26" fontFamily="var(--font-mono)" fill="var(--text)" fontWeight="800">
            {formatClock(remaining)}
          </text>
        </svg>
      </div>
      <p className="rest-next">Up next: {nextLabel}</p>
      <div className="row-wrap rest-actions">
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => {
            setTotal((t) => t + 20);
            setRemaining((r) => r + 20);
          }}
        >
          +20s
        </button>
        <button className="btn btn-primary btn-sm" onClick={onDone}>
          Skip rest
        </button>
      </div>
    </div>
  );
}
