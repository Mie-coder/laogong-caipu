import { NextResponse } from "next/server";
import { z } from "zod";
import { createRecipeRepository } from "@/lib/db/recipe-repository";

const FavoriteRequestSchema = z.object({ isFavorite: z.boolean() });

function error(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function PATCH(request: Request, context: { params: { id: string } }) {
  const id = Number(context.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) return error("invalid_id", "菜谱编号无效", 400);

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return error("invalid_request", "收藏状态无效", 400);
  }
  const parsed = FavoriteRequestSchema.safeParse(payload);
  if (!parsed.success) return error("invalid_request", "收藏状态无效", 400);

  const updated = createRecipeRepository().setFavorite(id, parsed.data.isFavorite);
  if (!updated) return error("not_found", "菜谱不存在", 404);
  return NextResponse.json({ isFavorite: parsed.data.isFavorite });
}
