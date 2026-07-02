import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BottomSheet } from "@/components/bottom-sheet";
import { BottomNav } from "@/components/bottom-nav";

vi.mock("next/navigation", () => ({
  usePathname: () => "/"
}));

describe("v2 application shell", () => {
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

  it("renders an accessible close button when the bottom sheet is open", () => {
    render(
      <BottomSheet open title="筛选图片" onClose={vi.fn()}>
        <div>内容</div>
      </BottomSheet>
    );

    expect(screen.getByRole("button", { name: "关闭" })).toBeInTheDocument();
  });
});
