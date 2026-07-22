import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RecipeCard } from "@/components/recipe-card";

describe("RecipeCard", () => {
  it("renders compact Stitch V3 metadata with wife rating priority", () => {
    const { container } = render(
      <RecipeCard
        recipe={{
          id: 1,
          name: "丝瓜炒蛋",
          mainCategory: "家常菜",
          coverImageUrl: "https://example.com/cover.jpg",
          cookedCount: 2,
          cookTimeMinutes: 30,
          difficulty: "easy",
          tags: ["下饭", "快手"],
          latestWifeFeedback: "好吃",
          wifeRating: 4
        }}
      />
    );

    expect(container.textContent).toContain("丝瓜炒蛋");
    expect(screen.getByText("30 分钟 · 老婆评分 4.0")).toBeInTheDocument();
    expect(container.querySelector(".v3-recipe-image")).toBeInTheDocument();
    expect(container.textContent).not.toContain("家常菜");
    expect(container.textContent).not.toContain("简单");
    expect(container.textContent).not.toContain("做过 2 次");
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
    expect(screen.getByText("时间未定 · 做过 0 次")).toBeInTheDocument();
  });

  it("replaces a rejected remote cover with the bundled fallback", () => {
    const { container } = render(
      <RecipeCard
        fallbackImageUrl="/stitch-v3/stitch-image-15.jpg"
        recipe={{
          id: 3,
          name: "潮汕牛肉汤",
          mainCategory: "汤羹",
          coverImageUrl: "https://sns-webpic-qc.xhscdn.com/expired.jpg",
          cookedCount: 0,
          difficulty: "easy",
          tags: [],
          latestWifeFeedback: "",
          wifeRating: 0
        }}
      />
    );

    const image = container.querySelector(".v3-recipe-image img");
    expect(image).not.toBeNull();
    expect(image).toHaveAttribute("src", "https://sns-webpic-qc.xhscdn.com/expired.jpg");
    fireEvent.error(image);
    expect(image).toHaveAttribute("src", "/stitch-v3/stitch-image-15.jpg");
  });
});
