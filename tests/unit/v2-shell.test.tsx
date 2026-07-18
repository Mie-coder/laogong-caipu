import { forwardRef } from "react";
import fs from "node:fs";
import path from "node:path";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { BottomSheet } from "@/components/bottom-sheet";
import { BottomNav } from "@/components/bottom-nav";
import { Toast } from "@/components/toast";
import { PageTransition } from "@/components/page-transition";

const mockState = vi.hoisted(() => ({
  pathname: "/",
  reducedMotion: false as boolean | null,
  reducedMotionCalls: 0,
  toast: vi.fn()
}));

vi.mock("sonner", () => ({ toast: mockState.toast }));

vi.mock("next/navigation", () => ({
  usePathname: () => mockState.pathname
}));

vi.mock("framer-motion", async () => {
  const React = await import("react");

  const createMotion = (tag: "div" | "section") =>
    forwardRef<HTMLElement, Record<string, unknown>>(({ children, initial, animate, exit, transition, layoutId, ...props }, ref) =>
      React.createElement(
        tag,
        {
          ...props,
          ref,
          "data-initial": JSON.stringify(initial),
          "data-animate": JSON.stringify(animate),
          "data-exit": JSON.stringify(exit),
          "data-transition": JSON.stringify(transition)
        },
        children
      )
    );

  return {
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    motion: {
      div: createMotion("div"),
      section: createMotion("section")
    },
    useReducedMotion: () => { mockState.reducedMotionCalls += 1; return mockState.reducedMotion; }
  };
});

beforeEach(() => {
  mockState.pathname = "/";
  mockState.reducedMotion = false;
  mockState.reducedMotionCalls = 0;
  mockState.toast.mockReset();
});

describe("v2 application shell", () => {
  it("keeps the home import row full-width with its arrow aligned right", () => {
    const css = fs.readFileSync(path.join(process.cwd(), "src/app/globals.css"), "utf8");
    const importRowRule = css.match(/\.home-import-row\s*\{[^}]+\}/)?.[0] ?? "";
    const importArrowRule = css.match(/\.home-import-arrow\s*\{[^}]+\}/)?.[0] ?? "";

    expect(importRowRule).toContain("width: calc(100% - (var(--page-x) * 2));");
    expect(importArrowRule).toContain("justify-self: end;");
  });

  it("uses scoped V3 controls so Tailwind's rounded utility cannot flatten the Stitch shapes", () => {
    const css = fs.readFileSync(path.join(process.cwd(), "src/app/globals.css"), "utf8");

    expect(css).toMatch(/\.v3-home \.v3-import-action\s*\{[^}]*border-radius: 999px;/);
    expect(css).toMatch(/\.v3-home \.v3-history\s*\{[^}]*border-radius: 999px;/);
    expect(css).toMatch(/\.v3-home \.v3-history\s*\{[^}]*width: 44px;[^}]*height: 44px;/);
    expect(css).toMatch(/\.v3-list-header-actions \.v3-list-header-button\s*\{[^}]*border-radius: 999px;/);
    expect(css).toMatch(/\.v3-list \.v3-segmented button\s*\{[^}]*border-radius: 8px;/);
    expect(css).toMatch(/\.v3-list \.v3-list-fab\s*\{[^}]*position: fixed;[^}]*bottom: calc\(112px \+ var\(--safe-bottom\)\);[^}]*width: 56px;[^}]*height: 56px;/);
  });

  it("renders two restrained navigation items with an accessible active state", () => {
    render(<BottomNav />);

    const links = screen.getAllByRole("link");

    expect(links).toHaveLength(2);
    expect(links.map((link) => link.textContent)).toEqual(["导入", "菜谱"]);
    expect(screen.getByRole("link", { name: "导入" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "导入" }).className).not.toContain("btn-primary");
    expect(screen.getByRole("navigation").className).not.toContain("glass-nav");
    expect(screen.queryByText("分类")).not.toBeInTheDocument();
    expect(document.querySelector(".v3-bottom-nav-indicator")).toBeInTheDocument();
  });

  it("marks the recipes route as active and treats categories as part of the recipe section", () => {
    mockState.pathname = "/recipes";
    const { rerender } = render(<BottomNav />);

    expect(screen.getByRole("link", { name: "菜谱" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "导入" })).not.toHaveAttribute("aria-current");

    mockState.pathname = "/categories";
    rerender(<BottomNav />);

    expect(screen.getByRole("link", { name: "菜谱" })).toHaveAttribute("aria-current", "page");
  });

  it("hides the bottom nav on dynamic recipe detail routes", () => {
    mockState.pathname = "/recipes/1";

    render(<BottomNav />);

    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });

  it("keeps hook order stable across list-detail-list rerenders", () => {
    const { rerender } = render(<BottomNav />);
    mockState.pathname = "/recipes/1";
    expect(() => rerender(<BottomNav />)).not.toThrow();
    expect(mockState.reducedMotionCalls).toBe(2);
    mockState.pathname = "/recipes";
    expect(() => rerender(<BottomNav />)).not.toThrow();
  });

  it("renders an accessible close button when the bottom sheet is open", () => {
    render(
      <BottomSheet open title="筛选图片" onClose={vi.fn()}>
        <div>内容</div>
      </BottomSheet>
    );

    expect(screen.getByRole("button", { name: "关闭" })).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "筛选图片" })).toBeInTheDocument();
  });

  it("calls onClose from the Drawer close control", () => {
    const onClose = vi.fn();

    render(
      <BottomSheet open title="筛选图片" onClose={onClose}>
        <div>内容</div>
      </BottomSheet>
    );

    fireEvent.click(screen.getByRole("button", { name: "关闭" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when Escape closes the modal Drawer", () => {
    const onClose = vi.fn();

    render(
      <BottomSheet open title="筛选图片" onClose={onClose}>
        <div>内容</div>
      </BottomSheet>
    );

    fireEvent.keyDown(document, { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it.each([true, null] as const)("suppresses Drawer slide and page spatial motion when reduced motion is %s", (reducedMotion) => {
    mockState.reducedMotion = reducedMotion;

    render(
      <>
        <BottomSheet open title="筛选图片" onClose={vi.fn()}>
          <div>内容</div>
        </BottomSheet>
        <PageTransition><span>页面内容</span></PageTransition>
      </>
    );

    expect(screen.getByRole("dialog", { name: "筛选图片" })).toHaveAttribute("data-reduced-motion", "true");
    expect(screen.getByText("页面内容").parentElement).toHaveAttribute("data-initial", JSON.stringify({ opacity: 0, y: 0 }));
    expect(screen.getByText("页面内容").parentElement).toHaveAttribute("data-transition", JSON.stringify({ duration: 0.01 }));

    const css = fs.readFileSync(path.join(process.cwd(), "src/app/globals.css"), "utf8");
    expect(css).toContain('[data-reduced-motion="true"][data-vaul-drawer]');
    expect(css).toContain('[data-reduced-motion="true"][data-vaul-overlay]');
    expect(css).toContain("animation-duration: 0.01ms !important;");
    expect(css).toContain("transition-duration: 0.01ms !important;");
    expect(css).not.toContain('data-reduced-motion="true"][data-vaul-drawer] {\n  transform:');
  });

  it("keeps a hydration-stable page fade when reduced motion is explicitly false", () => {
    render(
      <>
        <BottomSheet open title="筛选图片" onClose={vi.fn()}><div>内容</div></BottomSheet>
        <PageTransition><span>页面内容</span></PageTransition>
      </>
    );

    expect(screen.getByRole("dialog", { name: "筛选图片" })).not.toHaveAttribute("data-reduced-motion");
    expect(screen.getByText("页面内容").parentElement).toHaveAttribute("data-initial", JSON.stringify({ opacity: 0, y: 0 }));
    expect(screen.getByText("页面内容").parentElement).toHaveAttribute("data-transition", JSON.stringify({ duration: 0.16, ease: "easeOut" }));
  });

  it("does not duplicate unchanged Sonner messages after rerender", async () => {
    const { rerender } = render(<Toast message="保存成功" />);

    await waitFor(() => expect(mockState.toast).toHaveBeenCalledTimes(1));
    rerender(<Toast message="保存成功" />);
    expect(mockState.toast).toHaveBeenCalledTimes(1);
  });
});
