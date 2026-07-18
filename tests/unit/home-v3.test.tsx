import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HomeScreen } from "@/components/home/home-screen";
import { ImportFlow } from "@/components/import-flow";
import { RecipeSummary } from "@/lib/domain/recipe-api";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() })
}));

vi.mock("@/lib/http/api-client", () => ({
  listRecipesApi: vi.fn().mockResolvedValue({ recipes: [] }),
  parseImportApi: vi.fn(),
  filterImages: vi.fn(),
  saveRecipeWithImages: vi.fn()
}));

const recipe: RecipeSummary = {
  id: 1, name: "番茄炖牛腩", mainCategory: "家常菜", coverImageUrl: null,
  cookedCount: 3, cookTimeMinutes: 45, difficulty: "medium", tags: [],
  latestWifeFeedback: "", wifeRating: 4.8, isFavorite: false
};

describe("Stitch V3 home", () => {
  it("shows the editorial home and opens import from its sole primary entry", () => {
    const onImport = vi.fn();
    render(<HomeScreen recent={{ status: "ready", data: [recipe] }} onImport={onImport} onRetry={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "老公菜谱" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "查看历史" })).toHaveAttribute("href", "/recipes?recent=cooked");
    fireEvent.click(screen.getByRole("button", { name: "导入新菜谱" }));
    expect(onImport).toHaveBeenCalledOnce();
    expect(screen.getByText("番茄炖牛腩")).toBeInTheDocument();
  });

  it("uses the Stitch10 hero stage and a white pill import action", () => {
    render(<HomeScreen recent={{ status: "ready", data: [recipe] }} onImport={vi.fn()} onRetry={vi.fn()} />);
    expect(screen.getByTestId("home-hero-stage")).toHaveClass("v3-hero-stage");
    expect(screen.getByTestId("home-hero-plate")).toHaveClass("v3-hero-plate");
    const importAction = screen.getByRole("button", { name: "导入新菜谱" });
    expect(importAction).toHaveClass("v3-import-action");
    expect(importAction).not.toHaveClass("bg-primary");
  });

  it("opens the accessible import dialog from ImportFlow", async () => {
    render(<ImportFlow />);
    fireEvent.click(await screen.findByRole("button", { name: "导入新菜谱" }));
    expect(await screen.findByRole("dialog", { name: "导入菜谱" })).toBeInTheDocument();
  });

  it("has distinct loading, error, empty and retry states for recent cooking", () => {
    const onRetry = vi.fn();
    const { rerender } = render(<HomeScreen recent={{ status: "loading" }} onImport={vi.fn()} onRetry={onRetry} />);
    expect(screen.getAllByLabelText("最近做过加载中")).toHaveLength(2);
    rerender(<HomeScreen recent={{ status: "error", message: "网络开小差了" }} onImport={vi.fn()} onRetry={onRetry} />);
    fireEvent.click(screen.getByRole("button", { name: "重试" }));
    expect(onRetry).toHaveBeenCalledOnce();
    rerender(<HomeScreen recent={{ status: "ready", data: [] }} onImport={vi.fn()} onRetry={onRetry} />);
    expect(screen.getByText("还没有做过的菜谱")).toBeInTheDocument();
  });
});
