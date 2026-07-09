"use client";

// Keeps the screen awake during a live training set where supported. No-ops
// silently on browsers without the Wake Lock API.

import { useCallback, useEffect, useRef } from "react";

type WakeLockSentinelLike = { release: () => Promise<void> };

export function useWakeLock() {
  const ref = useRef<WakeLockSentinelLike | null>(null);

  const request = useCallback(async () => {
    try {
      const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<WakeLockSentinelLike> } };
      if (nav.wakeLock?.request) {
        ref.current = await nav.wakeLock.request("screen");
      }
    } catch {
      /* not supported / denied — fine */
    }
  }, []);

  const release = useCallback(async () => {
    try {
      await ref.current?.release();
    } catch {
      /* ignore */
    }
    ref.current = null;
  }, []);

  useEffect(() => {
    return () => {
      void release();
    };
  }, [release]);

  return { request, release };
}
