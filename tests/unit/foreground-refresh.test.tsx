import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useForegroundRefresh } from "@/hooks/use-foreground-refresh";

function Probe({ refresh, minIntervalMs }: { refresh: () => void; minIntervalMs?: number }) {
  useForegroundRefresh(refresh, { minIntervalMs });
  return null;
}

let visibilityState: DocumentVisibilityState;
let now: number;

beforeEach(() => {
  visibilityState = "visible";
  now = 10_000;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visibilityState);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useForegroundRefresh", () => {
  it("deduplicates a visibility and focus pair from the same foreground transition", () => {
    const refresh = vi.fn();
    render(<Probe refresh={refresh} />);

    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
      window.dispatchEvent(new Event("focus"));
    });

    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("refreshes again at the exact minimum interval boundary", () => {
    const refresh = vi.fn();
    render(<Probe refresh={refresh} minIntervalMs={1_000} />);

    act(() => document.dispatchEvent(new Event("visibilitychange")));
    now += 1_000;
    act(() => window.dispatchEvent(new Event("focus")));

    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("does not refresh while the document is hidden", () => {
    const refresh = vi.fn();
    render(<Probe refresh={refresh} />);
    visibilityState = "hidden";

    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
      window.dispatchEvent(new Event("focus"));
    });

    expect(refresh).not.toHaveBeenCalled();
  });

  it("uses the latest callback and removes both listeners on unmount", () => {
    const first = vi.fn();
    const latest = vi.fn();
    const { rerender, unmount } = render(<Probe refresh={first} />);
    rerender(<Probe refresh={latest} />);

    act(() => window.dispatchEvent(new Event("focus")));
    expect(first).not.toHaveBeenCalled();
    expect(latest).toHaveBeenCalledTimes(1);

    unmount();
    now += 1_001;
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
      window.dispatchEvent(new Event("focus"));
    });
    expect(latest).toHaveBeenCalledTimes(1);
  });
});
