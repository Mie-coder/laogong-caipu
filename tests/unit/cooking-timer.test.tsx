import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CookingTimerState } from "@/lib/domain/cooking-session";
import { useCookingTimer } from "@/hooks/use-cooking-timer";

describe("useCookingTimer", () => {
  afterEach(() => vi.useRealTimers());

  it("derives running time from the absolute deadline and creates a new deadline on resume", () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-07-19T12:00:00Z"));
    let timer: CookingTimerState = { status: "idle", durationMs: 300_000, remainingMs: 300_000, deadlineAt: null };
    const onChange = vi.fn((next: CookingTimerState) => { timer = next; rerender(); });
    const { result, rerender } = renderHook(() => useCookingTimer(timer, onChange));

    act(() => result.current.start());
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ status: "running", deadlineAt: Date.now() + 300_000 }));
    act(() => vi.advanceTimersByTime(30_000));
    expect(result.current.remainingMs).toBe(270_000);
    act(() => result.current.pause());
    expect(timer).toMatchObject({ status: "paused", remainingMs: 270_000, deadlineAt: null });
    act(() => result.current.resume());
    expect(timer).toMatchObject({ status: "running", deadlineAt: Date.now() + 270_000 });
  });

  it("recalibrates after visibility changes and clamps finish to zero", () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-07-19T12:00:00Z"));
    const timer: CookingTimerState = { status: "running", durationMs: 60_000, remainingMs: 60_000, deadlineAt: Date.now() + 60_000 };
    const onChange = vi.fn();
    const { result, unmount } = renderHook(() => useCookingTimer(timer, onChange));

    act(() => vi.advanceTimersByTime(75_000));
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(result.current.remainingMs).toBe(0);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ status: "finished", remainingMs: 0, deadlineAt: null }));
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
