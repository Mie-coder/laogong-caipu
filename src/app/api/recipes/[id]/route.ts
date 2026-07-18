import { NextResponse } from "next/server";
import { createRecipeRepository } from "@/lib/db/recipe-repository";

function parseRecipeId(rawId: string): number | null {
  const id = Number(rawId);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function error(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function GET(_request: Request, context: { params: { id: string } }) {
  const { id } = context.params;
  const recipeId = parseRecipeId(id);
  if (recipeId === null) return error("invalid_id", "菜谱编号无效", 400);
  const repo = createRecipeRepository();
  const recipe = repo.getRecipeById(recipeId);

  if (!recipe) {
    return error("not_found", "菜谱不存在", 404);
  }

  return NextResponse.json({ recipe });
}

export async function DELETE(_request: Request, context: { params: { id: string } }) {
  const { id } = context.params;
  const recipeId = parseRecipeId(id);
  if (recipeId === null) return error("invalid_id", "菜谱编号无效", 400);
  const repo = createRecipeRepository();
  const ok = repo.deleteRecipe(recipeId);

  if (!ok) {
    return error("not_found", "菜谱不存在", 404);
  }

  return NextResponse.json({ ok: true });
}
