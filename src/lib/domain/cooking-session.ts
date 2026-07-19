import { z } from "zod";

export const CookingTimerSchema = z.object({
  status: z.enum(["idle", "running", "paused", "finished"]),
  durationMs: z.number().int().nonnegative(),
  remainingMs: z.number().int().nonnegative(),
  deadlineAt: z.number().int().nullable()
});

export const CookingSessionSchema = z.object({
  version: z.literal(1),
  recipeId: z.number().int().positive(),
  currentStepOrder: z.number().int().positive(),
  completedStepOrders: z.array(z.number().int().positive()),
  timer: CookingTimerSchema,
  speechEnabled: z.boolean()
});

export type CookingTimerState = z.infer<typeof CookingTimerSchema>;
export type CookingSessionState = z.infer<typeof CookingSessionSchema>;
export type CookingSessionEvent =
  | { type: "STEP_TOGGLED"; order: number; stepOrders: number[] }
  | { type: "CURRENT_STEP_SET"; order: number }
  | { type: "TIMER_SET"; timer: CookingTimerState }
  | { type: "SPEECH_SET"; enabled: boolean }
  | { type: "RESET"; state: CookingSessionState };

export type SessionStorage = Pick<Storage, "getItem" | "removeItem">;

export function createCookingSession(recipeId: number, stepOrders: number[]): CookingSessionState {
  const currentStepOrder = stepOrders[0] ?? 1;
  return { version: 1, recipeId, currentStepOrder, completedStepOrders: [], timer: { status: "idle", durationMs: 300_000, remainingMs: 300_000, deadlineAt: null }, speechEnabled: false };
}

export function cookingSessionReducer(state: CookingSessionState, event: CookingSessionEvent): CookingSessionState {
  if (event.type === "STEP_TOGGLED") {
    if (state.completedStepOrders.includes(event.order)) {
      return { ...state, completedStepOrders: state.completedStepOrders.filter((order) => order !== event.order), currentStepOrder: event.order };
    }
    const completedStepOrders = [...state.completedStepOrders, event.order].sort((left, right) => left - right);
    const laterIncomplete = event.stepOrders.find((candidate) => candidate > event.order && !completedStepOrders.includes(candidate));
    const anyIncomplete = event.stepOrders.find((candidate) => !completedStepOrders.includes(candidate));
    return { ...state, completedStepOrders, currentStepOrder: laterIncomplete ?? anyIncomplete ?? event.order };
  }
  if (event.type === "CURRENT_STEP_SET") return { ...state, currentStepOrder: event.order };
  if (event.type === "TIMER_SET") return { ...state, timer: event.timer };
  if (event.type === "SPEECH_SET") return { ...state, speechEnabled: event.enabled };
  return event.state;
}

export function cookingSessionKey(recipeId: number) { return `cooking-session:${recipeId}`; }

export function restoreCookingSession(recipeId: number, stepOrders: number[], storage: SessionStorage): CookingSessionState {
  const fresh = createCookingSession(recipeId, stepOrders);
  const key = cookingSessionKey(recipeId);
  try {
    const raw = storage.getItem(key);
    if (!raw) return fresh;
    const parsed = CookingSessionSchema.parse(JSON.parse(raw));
    if (parsed.recipeId !== recipeId || !stepOrders.includes(parsed.currentStepOrder)) throw new Error("wrong recipe session");
    return { ...parsed, completedStepOrders: [...new Set(parsed.completedStepOrders.filter((order) => stepOrders.includes(order)))].sort((left, right) => left - right) };
  } catch {
    try { storage.removeItem(key); } catch { /* storage is optional */ }
    return fresh;
  }
}
