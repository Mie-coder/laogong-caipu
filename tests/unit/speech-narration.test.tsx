import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useSpeechNarration } from "@/hooks/use-speech-narration";

describe("useSpeechNarration", () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it("speaks only when called, uses zh-CN, replaces prior narration, and cancels on unmount", () => {
    const cancel = vi.fn(); const speak = vi.fn();
    class MockUtterance { lang = ""; onstart: (() => void) | null = null; onend: (() => void) | null = null; onerror: (() => void) | null = null; constructor(public text: string) {} }
    vi.stubGlobal("speechSynthesis", { cancel, speak });
    vi.stubGlobal("SpeechSynthesisUtterance", MockUtterance);
    const { result, unmount } = renderHook(() => useSpeechNarration());

    expect(result.current.supported).toBe(true);
    act(() => result.current.speak("第一步"));
    expect(cancel).toHaveBeenCalledTimes(1);
    expect((speak.mock.calls[0]?.[0] as MockUtterance).lang).toBe("zh-CN");
    act(() => result.current.speak("第二步"));
    expect(cancel).toHaveBeenCalledTimes(2);
    unmount();
    expect(cancel).toHaveBeenCalledTimes(3);
  });

  it("degrades without blocking when browser speech is unavailable", () => {
    const { result } = renderHook(() => useSpeechNarration());
    expect(result.current.supported).toBe(false);
    expect(() => result.current.speak("第一步")).not.toThrow();
  });

  it("does not surface synchronous browser speech failures to the interaction", () => {
    const cancel = vi.fn(); const speak = vi.fn(() => { throw new TypeError("speech failed"); });
    class MockUtterance { lang = ""; onstart: (() => void) | null = null; onend: (() => void) | null = null; onerror: (() => void) | null = null; constructor(public text: string) {} }
    vi.stubGlobal("speechSynthesis", { cancel, speak });
    vi.stubGlobal("SpeechSynthesisUtterance", MockUtterance);
    const { result } = renderHook(() => useSpeechNarration());

    expect(() => act(() => result.current.speak("第一步"))).not.toThrow();
    expect(result.current.speaking).toBe(false);
  });
});
