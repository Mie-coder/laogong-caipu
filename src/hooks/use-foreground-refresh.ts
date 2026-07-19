"use client";

import { useEffect, useRef } from "react";

export function useForegroundRefresh(refresh: () => void, options: { minIntervalMs?: number } = {}): void {
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  const minIntervalMs = options.minIntervalMs ?? 1_000;

  useEffect(() => {
    let lastRunAt = Number.NEGATIVE_INFINITY;

    const refreshWhenVisible = () => {
      if (document.visibilityState !== "visible") return;
      const now = performance.now();
      if (now - lastRunAt < minIntervalMs) return;
      lastRunAt = now;
      refreshRef.current();
    };

    document.addEventListener("visibilitychange", refreshWhenVisible);
    window.addEventListener("focus", refreshWhenVisible);
    return () => {
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      window.removeEventListener("focus", refreshWhenVisible);
    };
  }, [minIntervalMs]);
}
