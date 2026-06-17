import { NextResponse } from "next/server";
import { z } from "zod";
import { createRecipeRepository } from "@/lib/db/recipe-repository";

const RequestSchema = z.object({
  wifeFeedback: z.string().trim().default(""),
  wifeRating: z.number().int().min(0).max(5).default(0),
  husbandImprovementNotes: z.string().trim().default(""),
  notes: z.string().trim().default("")
});

export async function POST(request: Request, context: { params: { id: string } }) {
  try {
    const { id } = context.params;
    const body = RequestSchema.parse(await request.json());
    const repo = createRecipeRepository();
    repo.addCookingLog(Number(id), body);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "记录做过失败" },
      { status: 400 }
    );
  }
}
