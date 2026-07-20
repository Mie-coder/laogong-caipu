"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { animate, useMotionValue, useReducedMotion, type MotionValue } from "framer-motion";

const HYSTERESIS = 10;
const COMMIT_THRESHOLD = 64;
const MAX_PULL = 96;
const HOLD_Y = 44;
const RUBBER_BAND = 0.55;
const ACK_MS = 450;

export type PullRefreshPhase = "idle" | "pulling" | "ready" | "refreshing" | "success" | "error";

export type UsePullToRefreshResult = {
  containerRef: React.RefObject<HTMLElement>;
  pullY: MotionValue<number>;
  phase: PullRefreshPhase;
  refreshing: boolean;
  refresh: () => Promise<void>;
};

function rubberBand(raw: number, viewport: number) {
  const distance = (raw * viewport * RUBBER_BAND) /
    (viewport + RUBBER_BAND * Math.abs(raw));
  return Math.min(MAX_PULL, Math.max(0, distance));
}

export function usePullToRefresh(options: {
  disabled: boolean;
  onRefresh: () => Promise<boolean>;
  onEngage?: () => void;
}): UsePullToRefreshResult {
  const containerRef = useRef<HTMLElement>(null);
  const pullY = useMotionValue(0);
  const reducedMotion = useReducedMotion();
  const [phase, setPhase] = useState<PullRefreshPhase>("idle");
  const [refreshing, setRefreshing] = useState(false);
  const phaseRef = useRef<PullRefreshPhase>("idle");
  const disabledRef = useRef(options.disabled);
  const onRefreshRef = useRef(options.onRefresh);
  const onEngageRef = useRef(options.onEngage);
  const reducedMotionRef = useRef(Boolean(reducedMotion));
  const inFlight = useRef(false);
  const unmounted = useRef(false);
  const animation = useRef<ReturnType<typeof animate> | null>(null);
  const acknowledgement = useRef<ReturnType<typeof setTimeout> | null>(null);

  disabledRef.current = options.disabled;
  onRefreshRef.current = options.onRefresh;
  onEngageRef.current = options.onEngage;
  reducedMotionRef.current = Boolean(reducedMotion);

  const setCurrentPhase = useCallback((next: PullRefreshPhase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const stopAnimation = useCallback(() => {
    animation.current?.stop();
    animation.current = null;
  }, []);

  const springToZero = useCallback(() => {
    stopAnimation();
    if (reducedMotionRef.current) {
      pullY.set(0);
      return;
    }
    animation.current = animate(pullY, 0, { type: "spring", bounce: 0, duration: 0.35 });
  }, [pullY, stopAnimation]);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    if (acknowledgement.current) clearTimeout(acknowledgement.current);
    acknowledgement.current = null;
    setRefreshing(true);
    setCurrentPhase("refreshing");
    stopAnimation();
    if (reducedMotionRef.current) pullY.set(0);
    else animation.current = animate(pullY, HOLD_Y, { type: "spring", bounce: 0, duration: 0.35 });

    let succeeded = false;
    try {
      succeeded = await onRefreshRef.current();
    } catch {
      succeeded = false;
    }
    if (unmounted.current) {
      inFlight.current = false;
      return;
    }

    setRefreshing(false);
    setCurrentPhase(succeeded ? "success" : "error");
    acknowledgement.current = setTimeout(() => {
      acknowledgement.current = null;
      inFlight.current = false;
      if (unmounted.current) return;
      setCurrentPhase("idle");
      springToZero();
    }, ACK_MS);
  }, [pullY, setCurrentPhase, springToZero, stopAnimation]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    unmounted.current = false;
    document.documentElement.classList.add("has-pull-to-refresh");

    let startX = 0;
    let startY = 0;
    let rawDistance = 0;
    let intent: "pending" | "down" | "rejected" = "rejected";

    const resetGesture = () => {
      rawDistance = 0;
      intent = "rejected";
    };

    const atTop = () => window.scrollY <= 0 && document.documentElement.scrollTop <= 0 && document.body.scrollTop <= 0;

    const onTouchStart = (event: TouchEvent) => {
      if (disabledRef.current || phaseRef.current !== "idle" || !atTop()) return;
      const touch = event.touches[0];
      if (!touch) return;
      startX = touch.clientX;
      startY = touch.clientY;
      rawDistance = 0;
      intent = "pending";
    };

    const onTouchMove = (event: TouchEvent) => {
      if (intent === "rejected") return;
      const touch = event.touches[0];
      if (!touch) return;
      const deltaX = touch.clientX - startX;
      const deltaY = touch.clientY - startY;
      if (intent === "pending") {
        if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) <= HYSTERESIS) return;
        if (deltaY <= 0 || Math.abs(deltaX) >= deltaY) {
          intent = "rejected";
          return;
        }
        intent = "down";
        onEngageRef.current?.();
        stopAnimation();
      }
      if (intent !== "down") return;
      rawDistance = Math.max(0, deltaY);
      event.preventDefault();
      if (!reducedMotionRef.current) pullY.set(rubberBand(rawDistance, window.innerHeight || 1));
      setCurrentPhase(rawDistance >= COMMIT_THRESHOLD ? "ready" : "pulling");
    };

    const finishGesture = () => {
      const shouldRefresh = intent === "down" && rawDistance >= COMMIT_THRESHOLD;
      resetGesture();
      if (shouldRefresh) {
        void refresh();
      } else if (phaseRef.current === "pulling" || phaseRef.current === "ready") {
        setCurrentPhase("idle");
        springToZero();
      }
    };

    const cancelGesture = () => {
      resetGesture();
      if (phaseRef.current === "pulling" || phaseRef.current === "ready") {
        setCurrentPhase("idle");
        springToZero();
      }
    };

    element.addEventListener("touchstart", onTouchStart);
    element.addEventListener("touchmove", onTouchMove, { passive: false });
    element.addEventListener("touchend", finishGesture);
    element.addEventListener("touchcancel", cancelGesture);
    return () => {
      unmounted.current = true;
      element.removeEventListener("touchstart", onTouchStart);
      element.removeEventListener("touchmove", onTouchMove);
      element.removeEventListener("touchend", finishGesture);
      element.removeEventListener("touchcancel", cancelGesture);
      document.documentElement.classList.remove("has-pull-to-refresh");
      if (acknowledgement.current) clearTimeout(acknowledgement.current);
      acknowledgement.current = null;
      stopAnimation();
    };
  }, [pullY, refresh, setCurrentPhase, springToZero, stopAnimation]);

  return { containerRef, pullY, phase, refreshing, refresh };
}
