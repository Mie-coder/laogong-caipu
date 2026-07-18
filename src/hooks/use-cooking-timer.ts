"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CookingTimerState } from "@/lib/domain/cooking-session";

function remaining(timer: CookingTimerState, now = Date.now()) { return timer.status === "running" && timer.deadlineAt !== null ? Math.max(0, timer.deadlineAt - now) : timer.remainingMs; }

export function useCookingTimer(timer: CookingTimerState, onChange: (timer: CookingTimerState) => void) {
  const [remainingMs, setRemainingMs] = useState(() => remaining(timer));
  const reconcile = useCallback(() => {
    const next = remaining(timer);
    setRemainingMs(next);
    if (timer.status === "running" && next === 0) onChange({ ...timer, status: "finished", remainingMs: 0, deadlineAt: null });
  }, [onChange, timer]);

  useEffect(() => { reconcile(); }, [reconcile]);
  useEffect(() => {
    if (timer.status !== "running") return;
    const interval = window.setInterval(reconcile, 250);
    const onVisibility = () => reconcile();
    document.addEventListener("visibilitychange", onVisibility);
    return () => { window.clearInterval(interval); document.removeEventListener("visibilitychange", onVisibility); };
  }, [reconcile, timer.status]);

  const changeRunning = useCallback((nextRemaining: number) => onChange({ ...timer, status: "running", remainingMs: nextRemaining, deadlineAt: Date.now() + nextRemaining }), [onChange, timer]);
  return useMemo(() => ({
    remainingMs,
    start: () => { const next = timer.remainingMs || timer.durationMs; changeRunning(next); },
    pause: () => { const next = remaining(timer); onChange({ ...timer, status: "paused", remainingMs: next, deadlineAt: null }); },
    resume: () => changeRunning(timer.remainingMs),
    finish: () => onChange({ ...timer, status: "finished", remainingMs: 0, deadlineAt: null }),
    adjust: (deltaMs: number) => { const next = Math.max(0, remaining(timer) + deltaMs); if (timer.status === "running") changeRunning(next); else onChange({ ...timer, remainingMs: next, durationMs: Math.max(timer.durationMs, next), status: next === 0 ? "finished" : timer.status }); }
  }), [changeRunning, onChange, remainingMs, timer]);
}
