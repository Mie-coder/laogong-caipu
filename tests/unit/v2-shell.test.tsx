import { forwardRef } from "react";
import fs from "node:fs";
import path from "node:path";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { BottomSheet } from "@/components/bottom-sheet";
import { BottomNav } from "@/components/bottom-nav";
import { Toast } from "@/components/toast";

const mockState = vi.hoisted(() => ({
  pathname: "/",
  reducedMotion: false
}));

vi.mock("next/navigation", () => ({
  usePathname: () => mockState.pathname
}));

vi.mock("framer-motion", async () => {
  const React = await import("react");

  const createMotion = (tag: "div" | "section") =>
    forwardRef<HTMLElement, Record<string, unknown>>(({ children, initial, animate, exit, transition, ...props }, ref) =>
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
    useReducedMotion: () => mockState.reducedMotion
  };
});

beforeEach(() => {
  mockState.pathname = "/";
  mockState.reducedMotion = false;
});

describe("v2 application shell", () => {
  it("keeps the home import row full-width with its arrow aligned right", () => {
    const css = fs.readFileSync(path.join(process.cwd(), "src/app/globals.css"), "utf8");
    const importRowRule = css.match(/\.home-import-row\s*\{[^}]+\}/)?.[0] ?? "";
    const importArrowRule = css.match(/\.home-import-arrow\s*\{[^}]+\}/)?.[0] ?? "";

    expect(importRowRule).toContain("width: calc(100% - (var(--page-x) * 2));");
    expect(importArrowRule).toContain("justify-self: end;");
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

  it("renders an accessible close button when the bottom sheet is open", () => {
    render(
      <BottomSheet open title="筛选图片" onClose={vi.fn()}>
        <div>内容</div>
      </BottomSheet>
    );

    expect(screen.getByRole("button", { name: "关闭" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "关闭弹层" })).toBeInTheDocument();
  });

  it("calls onClose when Escape is pressed", () => {
    const onClose = vi.fn();

    render(
      <BottomSheet open title="筛选图片" onClose={onClose}>
        <div>内容</div>
      </BottomSheet>
    );

    fireEvent.keyDown(window, { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("removes positional animation and duration for bottom sheet and toast under reduced motion", async () => {
    mockState.reducedMotion = true;

    render(
      <>
        <BottomSheet open title="筛选图片" onClose={vi.fn()}>
          <div>内容</div>
        </BottomSheet>
        <Toast message="保存成功" />
      </>
    );

    const dialog = screen.getByRole("dialog");
    const toast = await screen.findByText("保存成功");

    expect(dialog).toHaveAttribute("data-initial", JSON.stringify({ y: 0, opacity: 0 }));
    expect(dialog).toHaveAttribute("data-exit", JSON.stringify({ y: 0, opacity: 0 }));
    expect(dialog).toHaveAttribute("data-transition", JSON.stringify({ duration: 0 }));
    expect(toast).toHaveAttribute("data-initial", JSON.stringify({ opacity: 0, y: 0 }));
    expect(toast).toHaveAttribute("data-exit", JSON.stringify({ opacity: 0, y: 0 }));
    expect(toast).toHaveAttribute("data-transition", JSON.stringify({ duration: 0 }));
  });

  it("keeps motion when reduced motion is not requested", async () => {
    render(
      <>
        <BottomSheet open title="筛选图片" onClose={vi.fn()}>
          <div>内容</div>
        </BottomSheet>
        <Toast message="保存成功" />
      </>
    );

    await waitFor(() => expect(screen.getByText("保存成功")).toBeInTheDocument());

    expect(screen.getByRole("dialog")).toHaveAttribute("data-initial", JSON.stringify({ y: 24, opacity: 0 }));
    expect(screen.getByText("保存成功")).toHaveAttribute("data-initial", JSON.stringify({ opacity: 0, y: -8 }));
  });
});
