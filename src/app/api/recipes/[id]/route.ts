import { NextResponse } from "next/server";
import { createRecipeRepository } from "@/lib/db/recipe-repository";

export async function GET(_request: Request, context: { params: { id: string } }) {
  const { id } = context.params;
  const repo = createRecipeRepository();
  const recipe = repo.getRecipeById(Number(id));

  if (!recipe) {
    return NextResponse.json({ error: "菜谱不存在" }, { status: 404 });
  }

  return NextResponse.json({ recipe });
}

export async function DELETE(_request: Request, context: { params: { id: string } }) {
  const { id } = context.params;
  const repo = createRecipeRepository();
  const ok = repo.deleteRecipe(Number(id));

  if (!ok) {
    return NextResponse.json({ error: "菜谱不存在" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
