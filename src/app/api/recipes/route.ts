import { NextResponse } from "next/server";
import { z } from "zod";
import { RecipeDraftSchema } from "@/lib/domain/recipe";
import { RecipeListResponseSchema } from "@/lib/domain/recipe-api";
import { createRecipeRepository } from "@/lib/db/recipe-repository";
import { apiError } from "@/lib/http/api-response";

const ListQuerySchema = z.object({ query: z.string().max(200).default(""), category: z.string().max(100).default(""), tag: z.string().max(100).default(""), difficulty: z.string().max(30).default("") });

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = ListQuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) return apiError("invalid_query", "筛选参数无效", 400);
  const recipes = RecipeListResponseSchema.parse({ recipes: createRecipeRepository().listRecipes(parsed.data) });
  return NextResponse.json(recipes);
}

export async function POST(request: Request) {
  try {
    const draft = RecipeDraftSchema.parse(await request.json());
    const repo = createRecipeRepository();
    const saved = repo.saveRecipeDraft(draft);
    return NextResponse.json(saved, { status: 201 });
  } catch (error) {
    return apiError("invalid_recipe", error instanceof Error ? error.message : "保存菜谱失败", 400);
  }
}
