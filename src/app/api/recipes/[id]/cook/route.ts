import { NextResponse } from "next/server";
import { z } from "zod";
import { createRecipeRepository } from "@/lib/db/recipe-repository";

const RequestSchema = z.object({
  wifeFeedback: z.string().trim().default(""),
  wifeRating: z.number().int().min(0).max(5).default(0),
  husbandImprovementNotes: z.string().trim().default(""),
  notes: z.string().trim().default("")
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await context.params;
  const id = Number(rawId);
  if (!Number.isSafeInteger(id) || id <= 0) {
    return NextResponse.json({ error: { code: "invalid_id", message: "菜谱编号无效" } }, { status: 400 });
  }
  try {
    const body = RequestSchema.parse(await request.json());
    const repo = createRecipeRepository();
    if (!repo.getRecipeById(id)) {
      return NextResponse.json({ error: { code: "not_found", message: "菜谱不存在" } }, { status: 404 });
    }
    repo.addCookingLog(id, body);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: { code: "invalid_request", message: error instanceof Error ? error.message : "记录做过失败" } },
      { status: 400 }
    );
  }
}
