"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

export type SpeechNarration = { supported: boolean; speaking: boolean; speak: (text: string) => void; cancel: () => void };

export function useSpeechNarration(): SpeechNarration {
  const supported = typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
  const [speaking, setSpeaking] = useState(false);
  const cancel = useCallback(() => { try { if (supported) window.speechSynthesis.cancel(); } catch { /* browser speech must never block cooking */ } setSpeaking(false); }, [supported]);
  const speak = useCallback((text: string) => {
    if (!supported || !text.trim()) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "zh-CN";
      utterance.onstart = () => setSpeaking(true);
      utterance.onend = () => setSpeaking(false);
      utterance.onerror = () => setSpeaking(false);
      window.speechSynthesis.speak(utterance);
    } catch { setSpeaking(false); }
  }, [supported]);
  useEffect(() => () => { try { if (supported) window.speechSynthesis.cancel(); } catch { /* cleanup remains best effort */ } }, [supported]);
  return useMemo(() => ({ supported, speaking, speak, cancel }), [cancel, speak, speaking, supported]);
}
