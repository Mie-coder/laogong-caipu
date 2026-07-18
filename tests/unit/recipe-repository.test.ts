import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { migrate } from "@/lib/db/schema";
import { createRecipeRepository } from "@/lib/db/recipe-repository";

describe("RecipeRepository", () => {
  it("adds and persists favorite state without resetting existing recipes", () => {
    const db = new Database(":memory:");
    migrate(db);
    const repo = createRecipeRepository(db);
    const saved = repo.saveRecipeDraft({
      name: "收藏测试菜", mainCategory: "家常菜", tags: [], ingredients: [], seasonings: [],
      steps: [{ order: 1, text: "完成" }], cookTimeMinutes: null, difficulty: "unknown", tips: "", confidence: 1, missingFields: []
    });

    migrate(db);

    expect(repo.setFavorite(saved.id, true)).toBe(true);
    expect(repo.getRecipeById(saved.id)?.isFavorite).toBe(true);
    expect(repo.listRecipes()[0]?.isFavorite).toBe(true);
  });

  it("saves a recipe draft and reads it with children", () => {
    const db = new Database(":memory:");
    migrate(db);
    const repo = createRecipeRepository(db);

    const saved = repo.saveRecipeDraft({
      name: "丝瓜炒蛋",
      mainCategory: "家常菜",
      tags: ["下饭"],
      ingredients: [{ name: "丝瓜", amount: "1根", type: "ingredient" }],
      seasonings: [{ name: "盐", amount: "适量", type: "seasoning" }],
      steps: [{ order: 1, text: "丝瓜切块。" }],
      cookTimeMinutes: 5,
      difficulty: "easy",
      tips: "鸡蛋先炒熟。",
      confidence: 0.9,
      missingFields: [],
      sourcePlatform: "xiaohongshu",
      sourceUrl: "http://xhslink.com/o/smiaxnsR3c",
      originalTitle: "丝瓜炒蛋",
      shareText: "超级下饭",
      coverImageUrl: null
    });

    const recipe = repo.getRecipeById(saved.id);

    expect(recipe?.name).toBe("丝瓜炒蛋");
    expect(recipe?.ingredients[0]?.name).toBe("丝瓜");
    expect(recipe?.tags).toEqual(["下饭"]);
    expect(recipe?.steps[0]?.text).toBe("丝瓜切块。");
  });

  it("adds cooking logs and increments cooked count", () => {
    const db = new Database(":memory:");
    migrate(db);
    const repo = createRecipeRepository(db);

    const saved = repo.saveRecipeDraft({
      name: "家常小炒",
      mainCategory: "家常菜",
      tags: [],
      ingredients: [],
      seasonings: [],
      steps: [{ order: 1, text: "炒熟。" }],
      cookTimeMinutes: null,
      difficulty: "unknown",
      tips: "",
      confidence: 0.5,
      missingFields: []
    });

    repo.addCookingLog(saved.id, {
      wifeFeedback: "好吃",
      husbandImprovementNotes: "下次少放盐",
      notes: "火候可以",
      wifeRating: 4
    });

    const recipe = repo.getRecipeById(saved.id);
    expect(recipe?.cookedCount).toBe(1);
    expect(recipe?.cookingLogs[0]?.wifeFeedback).toBe("好吃");
  });
});
