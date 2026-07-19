import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CookingSessionSchema, cookingSessionReducer, createCookingSession, restoreCookingSession } from "@/lib/domain/cooking-session";
import { useCookingSession } from "@/hooks/use-cooking-session";

describe("cooking session", () => {
  afterEach(() => { vi.restoreAllMocks(); window.sessionStorage.clear(); });
  it("completes a tapped step, advances to the next incomplete step, and restores it on undo", () => {
    const initial = createCookingSession(7, [1, 2, 3]);
    const completed = cookingSessionReducer(initial, { type: "STEP_TOGGLED", order: 1, stepOrders: [1, 2, 3] });
    expect(completed.completedStepOrders).toEqual([1]);
    expect(completed.currentStepOrder).toBe(2);
    const undone = cookingSessionReducer(completed, { type: "STEP_TOGGLED", order: 1, stepOrders: [1, 2, 3] });

    expect(undone.completedStepOrders).toEqual([]);
    expect(undone.currentStepOrder).toBe(1);
  });

  it("chooses the next later incomplete step, then the first remaining one, and keeps the last completed step", () => {
    const initial = createCookingSession(7, [1, 2, 3]);
    const completedSecond = cookingSessionReducer(initial, { type: "STEP_TOGGLED", order: 2, stepOrders: [1, 2, 3] });
    expect(completedSecond.currentStepOrder).toBe(3);

    const completedThird = cookingSessionReducer(completedSecond, { type: "STEP_TOGGLED", order: 3, stepOrders: [1, 2, 3] });
    expect(completedThird.currentStepOrder).toBe(1);

    const completedAll = cookingSessionReducer(completedThird, { type: "STEP_TOGGLED", order: 1, stepOrders: [1, 2, 3] });
    expect(completedAll.completedStepOrders).toEqual([1, 2, 3]);
    expect(completedAll.currentStepOrder).toBe(1);
  });

  it("restores only a valid session for the requested recipe and resets corrupt or mismatched storage", () => {
    const storage = new Map<string, string>();
    const key = "cooking-session:7";
    const setItem = (value: string) => storage.set(key, value);
    const session = createCookingSession(7, [1, 2]);

    setItem(JSON.stringify({ ...session, completedStepOrders: [1] }));
    expect(restoreCookingSession(7, [1, 2], { getItem: (name) => storage.get(name) ?? null, removeItem: (name) => storage.delete(name) })).toMatchObject({ completedStepOrders: [1] });

    setItem("not-json");
    expect(restoreCookingSession(7, [1, 2], { getItem: (name) => storage.get(name) ?? null, removeItem: (name) => storage.delete(name) })).toEqual(session);
    expect(storage.has(key)).toBe(false);

    setItem(JSON.stringify({ ...session, recipeId: 8 }));
    expect(restoreCookingSession(7, [1, 2], { getItem: (name) => storage.get(name) ?? null, removeItem: (name) => storage.delete(name) })).toEqual(session);
  });

  it("returns a fresh session when reading or cleanup storage throws", () => {
    const fresh = createCookingSession(7, [1, 2]);
    expect(restoreCookingSession(7, [1, 2], { getItem: () => { throw new Error("storage unavailable"); }, removeItem: () => { throw new Error("storage unavailable"); } })).toEqual(fresh);
  });

  it("keeps the durable shape versioned and validates timer state", () => {
    expect(CookingSessionSchema.parse(createCookingSession(7, [1]))).toMatchObject({ version: 1, recipeId: 7, timer: { status: "idle", deadlineAt: null } });
  });

  it("keeps the in-memory session usable when browser storage rejects writes or removal", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("storage unavailable"); });
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => { throw new Error("storage unavailable"); });
    const { result } = renderHook(() => useCookingSession(7, [1, 2]));

    expect(() => act(() => result.current.toggleStep(1))).not.toThrow();
    expect(() => act(() => result.current.reset())).not.toThrow();
  });
});
