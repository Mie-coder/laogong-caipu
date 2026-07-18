"use client";

import { useEffect, useReducer } from "react";
import { cookingSessionKey, cookingSessionReducer, createCookingSession, restoreCookingSession, type CookingSessionState, type CookingTimerState } from "@/lib/domain/cooking-session";

function availableStorage() { try { return window.sessionStorage; } catch { return null; } }

export function useCookingSession(recipeId: number, stepOrders: number[]) {
  const [state, dispatch] = useReducer(cookingSessionReducer, undefined, () => { const storage = typeof window === "undefined" ? null : availableStorage(); return storage ? restoreCookingSession(recipeId, stepOrders, storage) : createCookingSession(recipeId, stepOrders); });
  const key = cookingSessionKey(recipeId);

  useEffect(() => { const storage = availableStorage(); try { storage?.setItem(key, JSON.stringify(state)); } catch { /* private-mode storage must not block cooking */ } }, [key, state]);

  return {
    state,
    toggleStep: (order: number) => dispatch({ type: "STEP_TOGGLED", order }),
    setCurrentStep: (order: number) => dispatch({ type: "CURRENT_STEP_SET", order }),
    setTimer: (timer: CookingTimerState) => dispatch({ type: "TIMER_SET", timer }),
    setSpeechEnabled: (enabled: boolean) => dispatch({ type: "SPEECH_SET", enabled }),
    reset: () => { const storage = availableStorage(); try { storage?.removeItem(key); } catch { /* storage remains optional */ } dispatch({ type: "RESET", state: createCookingSession(recipeId, stepOrders) }); }
  } as { state: CookingSessionState; toggleStep: (order: number) => void; setCurrentStep: (order: number) => void; setTimer: (timer: CookingTimerState) => void; setSpeechEnabled: (enabled: boolean) => void; reset: () => void };
}
