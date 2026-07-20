import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";

const motion = vi.hoisted(() => ({ reduced: false }));

vi.mock("framer-motion", async () => {
  const React = await import("react");
  return {
    animate: (value: { set: (next: number) => void }, target: number) => {
      value.set(target);
      return { stop: vi.fn() };
    },
    useMotionValue: (initial: number) => {
      const value = React.useRef({ current: initial });
      return React.useRef({ get: () => value.current.current, set: (next: number) => { value.current.current = next; } }).current;
    },
    useReducedMotion: () => motion.reduced
  };
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => { resolve = resolvePromise; });
  return { promise, resolve };
}

function Harness({ onRefresh, disabled = false, onEngage = vi.fn() }: {
  onRefresh: () => Promise<boolean>;
  disabled?: boolean;
  onEngage?: () => void;
}) {
  const pull = usePullToRefresh({ disabled, onRefresh, onEngage });
  return (
    <main ref={pull.containerRef} data-testid="pull-root" aria-busy={pull.refreshing} data-pull-y={pull.pullY.get()}>
      <span role="status">{pull.phase}</span>
      <button onClick={() => void pull.refresh()}>刷新</button>
    </main>
  );
}

function drag(fromY: number, toY: number, x = 120, endX = x) {
  const root = screen.getByTestId("pull-root");
  fireEvent.touchStart(root, { touches: [{ clientX: x, clientY: fromY }] });
  fireEvent.touchMove(root, { touches: [{ clientX: endX, clientY: toY }], cancelable: true });
  fireEvent.touchEnd(root, { changedTouches: [{ clientX: endX, clientY: toY }] });
}

beforeEach(() => {
  motion.reduced = false;
  Object.defineProperty(window, "scrollY", { configurable: true, value: 0 });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("usePullToRefresh", () => {
  it("rejects gestures that begin below the top", () => {
    Object.defineProperty(window, "scrollY", { configurable: true, value: 12 });
    const refresh = vi.fn().mockResolvedValue(true);
    render(<Harness onRefresh={refresh} />);
    drag(100, 190);
    expect(refresh).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("idle");
  });

  it("rejects pulls below the 64px commit threshold", () => {
    const refresh = vi.fn().mockResolvedValue(true);
    render(<Harness onRefresh={refresh} />);
    drag(100, 163);
    expect(refresh).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("idle");
  });

  it("rejects dominant horizontal gestures", () => {
    const refresh = vi.fn().mockResolvedValue(true);
    render(<Harness onRefresh={refresh} />);
    drag(100, 140, 100, 180);
    expect(refresh).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("idle");
  });

  it("ignores gestures while disabled", () => {
    const refresh = vi.fn().mockResolvedValue(true);
    render(<Harness onRefresh={refresh} disabled />);
    drag(100, 180);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("engages once, refreshes above 64px, and suppresses duplicate requests", async () => {
    const pending = deferred<boolean>();
    const refresh = vi.fn().mockReturnValue(pending.promise);
    const engage = vi.fn();
    render(<Harness onRefresh={refresh} onEngage={engage} />);
    drag(100, 180);
    expect(engage).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("pull-root")).toHaveAttribute("aria-busy", "true");
    fireEvent.click(screen.getByRole("button", { name: "刷新" }));
    expect(refresh).toHaveBeenCalledTimes(1);
    act(() => pending.resolve(true));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("success"));
  });

  it("cancels an above-threshold pull without refreshing", () => {
    const refresh = vi.fn().mockResolvedValue(true);
    render(<Harness onRefresh={refresh} />);
    const root = screen.getByTestId("pull-root");
    fireEvent.touchStart(root, { touches: [{ clientX: 120, clientY: 100 }] });
    fireEvent.touchMove(root, { touches: [{ clientX: 120, clientY: 180 }], cancelable: true });
    expect(root).not.toHaveAttribute("data-pull-y", "0");
    fireEvent.touchCancel(root, { changedTouches: [{ clientX: 120, clientY: 180 }] });
    expect(refresh).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("idle");
    expect(root).toHaveAttribute("data-pull-y", "0");
  });

  it("shows an error acknowledgement when refresh returns false", async () => {
    vi.useFakeTimers();
    render(<Harness onRefresh={vi.fn().mockResolvedValue(false)} />);
    fireEvent.click(screen.getByRole("button", { name: "刷新" }));
    await act(async () => {});
    expect(screen.getByRole("status")).toHaveTextContent("error");
    await act(async () => { await vi.advanceTimersByTimeAsync(450); });
    expect(screen.getByRole("status")).toHaveTextContent("idle");
  });

  it("removes native overscroll suppression on unmount", () => {
    const view = render(<Harness onRefresh={vi.fn().mockResolvedValue(true)} />);
    expect(document.documentElement).toHaveClass("has-pull-to-refresh");
    view.unmount();
    expect(document.documentElement).not.toHaveClass("has-pull-to-refresh");
  });

  it("keeps pullY at zero with reduced motion", async () => {
    vi.useFakeTimers();
    motion.reduced = true;
    render(<Harness onRefresh={vi.fn().mockResolvedValue(true)} />);
    drag(100, 180);
    expect(screen.getByTestId("pull-root")).toHaveAttribute("data-pull-y", "0");
    await act(async () => {});
    await act(async () => { await vi.advanceTimersByTimeAsync(450); });
  });
});
