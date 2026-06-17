import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RecipeCard } from "@/components/recipe-card";

describe("RecipeCard", () => {
  it("renders recipe summary", () => {
    const { container } = render(
      <RecipeCard
        recipe={{
          id: 1,
          name: "丝瓜炒蛋",
          mainCategory: "家常菜",
          coverImageUrl: null,
          cookedCount: 2,
          difficulty: "easy",
          tags: ["下饭"],
          latestWifeFeedback: "好吃"
        }}
      />
    );

    expect(container.textContent).toContain("丝瓜炒蛋");
    expect(container.textContent).toContain("做过 2 次");
  });
});
