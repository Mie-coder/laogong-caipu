import { describe, expect, it } from "vitest";
import { RecipeDraftSchema } from "@/lib/domain/recipe";

describe("RecipeDraftSchema", () => {
  it("accepts a valid AI recipe draft", () => {
    const parsed = RecipeDraftSchema.parse({
      name: "丝瓜炒蛋",
      mainCategory: "家常菜",
      tags: ["下饭", "快手菜"],
      ingredients: [{ name: "丝瓜", amount: "1根", type: "ingredient" }],
      seasonings: [{ name: "盐", amount: "适量", type: "seasoning" }],
      steps: [{ order: 1, text: "丝瓜去皮切块。" }],
      cookTimeMinutes: 5,
      difficulty: "easy",
      tips: "鸡蛋先炒熟盛出，最后回锅。",
      confidence: 0.82,
      missingFields: []
    });

    expect(parsed.name).toBe("丝瓜炒蛋");
  });

  it("rejects drafts without steps", () => {
    expect(() =>
      RecipeDraftSchema.parse({
        name: "丝瓜炒蛋",
        mainCategory: "家常菜",
        tags: [],
        ingredients: [],
        seasonings: [],
        steps: [],
        cookTimeMinutes: null,
        difficulty: "easy",
        tips: "",
        confidence: 0.6,
        missingFields: []
      })
    ).toThrow();
  });
});
