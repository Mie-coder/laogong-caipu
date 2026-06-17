import { describe, expect, it } from "vitest";
import { MockRecipeParser, parseRecipeFromContent } from "@/lib/ai/recipe-parser";

describe("parseRecipeFromContent", () => {
  it("returns a valid mock recipe draft", async () => {
    const draft = await parseRecipeFromContent(
      {
        sourcePlatform: "xiaohongshu",
        sourceUrl: "http://xhslink.com/o/smiaxnsR3c",
        shareText: "超级下饭的丝瓜炒蛋",
        crawledTitle: "",
        crawledText: "",
        crawledImageUrls: [],
        manualSupplement: ""
      },
      new MockRecipeParser()
    );

    expect(draft.name).toContain("丝瓜炒蛋");
    expect(draft.steps.length).toBeGreaterThan(0);
  });

  it("rejects invalid provider JSON", async () => {
    const badProvider = {
      parse: async () => ({
        name: "",
        mainCategory: "家常菜",
        tags: [],
        ingredients: [],
        seasonings: [],
        steps: [],
        cookTimeMinutes: null,
        difficulty: "easy",
        tips: "",
        confidence: 0.1,
        missingFields: []
      })
    };

    await expect(
      parseRecipeFromContent(
        {
          sourcePlatform: "manual",
          sourceUrl: "",
          shareText: "只有正文",
          crawledTitle: "",
          crawledText: "",
          crawledImageUrls: [],
          manualSupplement: ""
        },
        badProvider
      )
    ).rejects.toThrow();
  });
});
