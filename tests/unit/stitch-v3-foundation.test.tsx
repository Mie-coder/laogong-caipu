import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Button } from "@/components/ui/button";
import { BottomSheet } from "@/components/bottom-sheet";

describe("Stitch V3 foundation", () => {
  it("exposes the shadcn button with a 44px touch target", () => {
    render(<Button aria-label="收藏">收藏</Button>);
    expect(screen.getByRole("button", { name: "收藏" })).toHaveClass("min-h-11");
  });

  it("closes the Drawer wrapper and restores the trigger contract", () => {
    const onClose = vi.fn();
    render(<BottomSheet open title="导入菜谱" onClose={onClose}>内容</BottomSheet>);
    expect(screen.getByRole("dialog", { name: "导入菜谱" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "关闭" }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
