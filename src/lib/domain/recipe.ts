import { z } from "zod";

export const IngredientTypeSchema = z.enum(["ingredient", "seasoning"]);

export const RecipeIngredientSchema = z.object({
  name: z.string().trim().min(1),
  amount: z.string().trim().default(""),
  type: IngredientTypeSchema
});

export const RecipeStepSchema = z.object({
  order: z.number().int().positive().nullable(),
  text: z.string().trim().min(1),
  imageUrl: z.string().optional().nullable()
});

export const RecipeDraftSchema = z.object({
  name: z.string().trim().min(1),
  mainCategory: z.string().trim().default("未分类"),
  tags: z.array(z.string().trim().min(1)).default([]),
  ingredients: z.array(RecipeIngredientSchema).default([]),
  seasonings: z.array(RecipeIngredientSchema).default([]),
  steps: z.array(RecipeStepSchema).min(1),
  cookTimeMinutes: z.number().int().positive().nullable().default(null),
  difficulty: z.enum(["easy", "medium", "hard", "unknown"]).default("unknown"),
  tips: z.string().trim().default(""),
  confidence: z.number().min(0).max(1).nullable().default(0.5),
  missingFields: z.array(z.string()).default([]),
  sourcePlatform: z.string().optional(),
  sourceUrl: z.string().optional(),
  originalTitle: z.string().optional(),
  shareText: z.string().optional(),
  coverImageUrl: z.string().optional().nullable(),
  imageUrls: z.array(z.string()).optional().default([])
});

export type RecipeDraft = z.infer<typeof RecipeDraftSchema>;

export type ImportInput = {
  rawInput: string;
  manualSupplement?: string;
};
