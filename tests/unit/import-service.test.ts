import { describe, expect, it } from "vitest";
import { parseImport } from "@/lib/import/import-service";

describe("parseImport", () => {
  it("continues with share text when crawling fails", async () => {
    const result = await parseImport(
      {
        rawInput: "超级下饭的丝瓜炒蛋 http://xhslink.com/o/smiaxnsR3c 复制后打开【小红书】查看笔记！"
      },
      {
        crawlUrl: async () => ({ ok: false, errorCode: "empty_content" as const, errorMessage: "页面内容为空" }),
        parseRecipeFromContent: async () => ({
          name: "丝瓜炒蛋",
          mainCategory: "家常菜",
          tags: ["下饭"],
          ingredients: [],
          seasonings: [],
          steps: [{ order: 1, text: "炒熟。" }],
          cookTimeMinutes: 5,
          difficulty: "easy" as const,
          tips: "",
          confidence: 0.56,
          missingFields: ["原文步骤可能不完整"]
        })
      }
    );

    expect(result.source.sourcePlatform).toBe("xiaohongshu");
    expect(result.crawlStatus).toBe("failed");
    expect(result.recipe.name).toBe("丝瓜炒蛋");
    expect(result.needsSupplement).toBe(true);
  });
});
