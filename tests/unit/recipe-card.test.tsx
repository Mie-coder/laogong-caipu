import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RecipeCard } from "@/components/recipe-card";

describe("RecipeCard", () => {
  it("renders metadata in the required order without legacy styling", () => {
    const { container } = render(
      <RecipeCard
        recipe={{
          id: 1,
          name: "丝瓜炒蛋",
          mainCategory: "家常菜",
          coverImageUrl: "https://example.com/cover.jpg",
          cookedCount: 2,
          difficulty: "easy",
          tags: ["下饭", "快手"],
          latestWifeFeedback: "好吃",
          wifeRating: 4
        }}
      />
    );

    expect(container.textContent).toContain("丝瓜炒蛋");
    expect(screen.getByText("家常菜")).toBeInTheDocument();
    expect(screen.getByLabelText("难度：简单")).toBeInTheDocument();
    expect(screen.getByText("做过 2 次")).toBeInTheDocument();
    expect(screen.getByText("评分 4.0")).toBeInTheDocument();

    const metadata = screen.getByText("家常菜").parentElement;
    expect(metadata?.textContent).toContain("家常菜");
    expect(metadata?.textContent).toContain("简单");
    expect(metadata?.textContent).toContain("做过 2 次");
    expect(metadata?.textContent).toContain("评分 4.0");
    expect(container.textContent).not.toContain("👨‍🍳");
    expect(container.textContent).not.toContain("🍳");
    expect(container.textContent).not.toContain("⭐");
    expect(container.querySelector(".glass-card")).toBeNull();
    expect(container.querySelector(".rounded-pill")).toBeNull();
  });

  it("uses a neutral no-image fallback", () => {
    render(
      <RecipeCard
        disableLink
        recipe={{
          id: 2,
          name: "番茄牛腩",
          mainCategory: "炖菜",
          coverImageUrl: null,
          cookedCount: 0,
          difficulty: "medium",
          tags: [],
          latestWifeFeedback: "",
          wifeRating: 0
        }}
      />
    );

    expect(screen.getByText("无图")).toBeInTheDocument();
    expect(screen.getByText("评分 --")).toBeInTheDocument();
  });
});
