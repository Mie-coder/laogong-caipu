import { z } from "zod";

export const RecipeSummarySchema = z.object({
  id: z.number().int().positive(), name: z.string(), mainCategory: z.string(),
  coverImageUrl: z.string().nullable(), cookedCount: z.number().int().nonnegative(),
  cookTimeMinutes: z.number().int().positive().nullable(), difficulty: z.string(),
  tags: z.array(z.string()), latestWifeFeedback: z.string(), wifeRating: z.number().min(0).max(5),
  isFavorite: z.boolean().default(false)
});
export type RecipeSummary = z.infer<typeof RecipeSummarySchema>;
export const RecipeIngredientApiSchema = z.object({ name: z.string(), amount: z.string(), type: z.string() });
export const RecipeStepApiSchema = z.object({ order: z.number().int().positive(), text: z.string(), imageUrl: z.string().nullable() });
export const CookingLogApiSchema = z.object({
  id: z.number().int().positive(), cookedAt: z.string(), wifeFeedback: z.string(), wifeRating: z.number().min(0).max(5),
  husbandImprovementNotes: z.string(), notes: z.string()
});
export const RecipeDetailSchema = RecipeSummarySchema.extend({
  sourcePlatform: z.string(), sourceUrl: z.string(), originalTitle: z.string(), shareText: z.string(), tips: z.string(),
  imageUrls: z.array(z.string()), ingredients: z.array(RecipeIngredientApiSchema), seasonings: z.array(RecipeIngredientApiSchema),
  steps: z.array(RecipeStepApiSchema), cookingLogs: z.array(CookingLogApiSchema)
});
export type RecipeDetail = z.infer<typeof RecipeDetailSchema>;
export const RecipeListResponseSchema = z.object({ recipes: z.array(RecipeSummarySchema) });
export const RecipeDetailResponseSchema = z.object({ recipe: RecipeDetailSchema });
export const RecipeFavoriteResponseSchema = z.object({ isFavorite: z.boolean() });
