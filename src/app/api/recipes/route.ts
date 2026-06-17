import { NextResponse } from "next/server";
import { RecipeDraftSchema } from "@/lib/domain/recipe";
import { createRecipeRepository } from "@/lib/db/recipe-repository";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const repo = createRecipeRepository();
  const recipes = repo.listRecipes({
    query: url.searchParams.get("query") ?? "",
    category: url.searchParams.get("category") ?? "",
    tag: url.searchParams.get("tag") ?? "",
    difficulty: url.searchParams.get("difficulty") ?? ""
  });

  return NextResponse.json({ recipes });
}

export async function POST(request: Request) {
  try {
    const draft = RecipeDraftSchema.parse(await request.json());
    const repo = createRecipeRepository();
    const saved = repo.saveRecipeDraft(draft);
    return NextResponse.json(saved, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "保存菜谱失败" },
      { status: 400 }
    );
  }
}
