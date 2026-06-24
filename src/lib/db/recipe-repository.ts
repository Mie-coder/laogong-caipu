import type Database from "better-sqlite3";
import { RecipeDraft } from "@/lib/domain/recipe";
import { getDb } from "@/lib/db/client";

export type CookingLogInput = {
  wifeFeedback: string;
  husbandImprovementNotes: string;
  notes: string;
  wifeRating: number;
};

export type RecipeSummary = {
  id: number;
  name: string;
  mainCategory: string;
  coverImageUrl: string | null;
  cookedCount: number;
  difficulty: string;
  tags: string[];
  latestWifeFeedback: string;
  wifeRating: number;
};

export type RecipeDetail = RecipeSummary & {
  sourcePlatform: string;
  sourceUrl: string;
  originalTitle: string;
  shareText: string;
  cookTimeMinutes: number | null;
  difficulty: string;
  tips: string;
  imageUrls: string[];
  ingredients: Array<{ name: string; amount: string; type: string }>;
  seasonings: Array<{ name: string; amount: string; type: string }>;
  steps: Array<{ order: number; text: string; imageUrl: string | null }>;
  cookingLogs: Array<{
    id: number;
    cookedAt: string;
    wifeFeedback: string;
    wifeRating: number;
    husbandImprovementNotes: string;
    notes: string;
  }>;
};

export function createRecipeRepository(db: Database.Database = getDb()) {
  return {
    saveRecipeDraft(draft: RecipeDraft): { id: number } {
      const tx = db.transaction(() => {
        const result = db
          .prepare(
            `INSERT INTO recipes
             (name, main_category, source_platform, source_url, original_title, share_text, cover_image_url, cook_time_minutes, difficulty, tips)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .run(
            draft.name,
            draft.mainCategory,
            draft.sourcePlatform ?? "",
            draft.sourceUrl ?? "",
            draft.originalTitle ?? "",
            draft.shareText ?? "",
            draft.coverImageUrl ?? null,
            draft.cookTimeMinutes,
            draft.difficulty,
            draft.tips
          );

        const recipeId = Number(result.lastInsertRowid);
        const insertIngredient = db.prepare(
          `INSERT INTO recipe_ingredients (recipe_id, name, amount, type, sort_order) VALUES (?, ?, ?, ?, ?)`
        );
        [...draft.ingredients, ...draft.seasonings].forEach((item, index) => {
          insertIngredient.run(recipeId, item.name, item.amount, item.type, index + 1);
        });

        const insertStep = db.prepare(
          `INSERT INTO recipe_steps (recipe_id, step_order, text, image_url) VALUES (?, ?, ?, ?)`
        );
        draft.steps.forEach((step) => insertStep.run(recipeId, step.order, step.text, step.imageUrl ?? null));

        const insertTag = db.prepare(`INSERT INTO recipe_tags (recipe_id, tag) VALUES (?, ?)`);
        draft.tags.forEach((tag) => insertTag.run(recipeId, tag));

        if (draft.imageUrls && draft.imageUrls.length > 0) {
          const insertImage = db.prepare(`INSERT INTO recipe_images (recipe_id, url, sort_order) VALUES (?, ?, ?)`);
          draft.imageUrls.forEach((url, index) => insertImage.run(recipeId, url, index + 1));
        }

        return { id: recipeId };
      });

      return tx();
    },

    listRecipes(filters: { query?: string; tag?: string; category?: string; difficulty?: string } = {}): RecipeSummary[] {
      const rows = db
        .prepare(
          `SELECT r.*, (
             SELECT wife_feedback FROM cooking_logs c WHERE c.recipe_id = r.id ORDER BY c.id DESC LIMIT 1
           ) AS latest_wife_feedback,
           (
             SELECT wife_rating FROM cooking_logs c WHERE c.recipe_id = r.id ORDER BY c.id DESC LIMIT 1
           ) AS latest_wife_rating
           FROM recipes r
           WHERE (? = '' OR r.name LIKE ?)
             AND (? = '' OR r.main_category = ?)
             AND (? = '' OR r.difficulty = ?)
           ORDER BY r.updated_at DESC, r.id DESC`
        )
        .all(
          filters.query ?? "", `%${filters.query ?? ""}%`,
          filters.category ?? "", filters.category ?? "",
          filters.difficulty ?? "", filters.difficulty ?? ""
        ) as any[];

      return rows
        .filter((row: any) => {
          if (!filters.tag) return true;
          const tags = getTags(db, row.id);
          return tags.includes(filters.tag);
        })
        .map((row: any) => ({
          id: row.id,
          name: row.name,
          mainCategory: row.main_category,
          coverImageUrl: row.cover_image_url,
          cookedCount: row.cooked_count,
          difficulty: row.difficulty,
          tags: getTags(db, row.id),
          latestWifeFeedback: row.latest_wife_feedback ?? "",
          wifeRating: row.latest_wife_rating ?? 0
        }));
    },

    getRecipeById(id: number): RecipeDetail | null {
      const row = db.prepare(`SELECT * FROM recipes WHERE id = ?`).get(id) as any;
      if (!row) return null;

      const ingredients = getIngredients(db, id);
      return {
        id: row.id,
        name: row.name,
        mainCategory: row.main_category,
        coverImageUrl: row.cover_image_url,
        cookedCount: row.cooked_count,
        tags: getTags(db, id),
        latestWifeFeedback: "",
        wifeRating: 0,
        sourcePlatform: row.source_platform ?? "",
        sourceUrl: row.source_url ?? "",
        originalTitle: row.original_title ?? "",
        shareText: row.share_text ?? "",
        cookTimeMinutes: row.cook_time_minutes,
        difficulty: row.difficulty,
        tips: row.tips,
        imageUrls: getImageUrls(db, id),
        ingredients: ingredients.filter((item) => item.type === "ingredient"),
        seasonings: ingredients.filter((item) => item.type === "seasoning"),
        steps: getSteps(db, id),
        cookingLogs: getCookingLogs(db, id)
      };
    },

    addCookingLog(id: number, input: CookingLogInput): void {
      const tx = db.transaction(() => {
        db.prepare(
          `INSERT INTO cooking_logs (recipe_id, wife_feedback, wife_rating, husband_improvement_notes, notes) VALUES (?, ?, ?, ?, ?)`
        ).run(id, input.wifeFeedback, input.wifeRating, input.husbandImprovementNotes, input.notes);
        db.prepare(`UPDATE recipes SET cooked_count = cooked_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(id);
      });
      tx();
    },

    deleteRecipe(id: number): boolean {
      const recipe = this.getRecipeById(id);
      if (!recipe) return false;
      db.prepare(`DELETE FROM recipes WHERE id = ?`).run(id);
      return true;
    }
  };
}

function getTags(db: Database.Database, recipeId: number): string[] {
  return (db.prepare(`SELECT tag FROM recipe_tags WHERE recipe_id = ? ORDER BY id`).all(recipeId) as any[]).map(
    (row) => row.tag
  );
}

function getIngredients(db: Database.Database, recipeId: number) {
  return db
    .prepare(`SELECT name, amount, type FROM recipe_ingredients WHERE recipe_id = ? ORDER BY sort_order`)
    .all(recipeId) as Array<{ name: string; amount: string; type: string }>;
}

function getImageUrls(db: Database.Database, recipeId: number): string[] {
  return (db
    .prepare(`SELECT url FROM recipe_images WHERE recipe_id = ? ORDER BY sort_order`)
    .all(recipeId) as any[]).map((row) => row.url);
}

function getSteps(db: Database.Database, recipeId: number) {
  return (db
    .prepare(`SELECT step_order, text, image_url FROM recipe_steps WHERE recipe_id = ? ORDER BY step_order`)
    .all(recipeId) as any[]).map((row) => ({
    order: row.step_order,
    text: row.text,
    imageUrl: row.image_url
  }));
}

function getCookingLogs(db: Database.Database, recipeId: number) {
  return (db
    .prepare(`SELECT id, cooked_at, wife_feedback, wife_rating, husband_improvement_notes, notes FROM cooking_logs WHERE recipe_id = ? ORDER BY id DESC`)
    .all(recipeId) as any[]).map((row) => ({
    id: row.id,
    cookedAt: row.cooked_at,
    wifeFeedback: row.wife_feedback,
    wifeRating: row.wife_rating ?? 0,
    husbandImprovementNotes: row.husband_improvement_notes,
    notes: row.notes
  }));
}
