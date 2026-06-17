import { NextResponse } from "next/server";
import { z } from "zod";
import { parseImport } from "@/lib/import/import-service";

const RequestSchema = z.object({
  rawInput: z.string().trim().min(1),
  manualSupplement: z.string().optional().default("")
});

export async function POST(request: Request) {
  try {
    const body = RequestSchema.parse(await request.json());
    const result = await parseImport(body);
    return NextResponse.json({ ...result, imageUrls: result.imageUrls ?? [] });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "导入解析失败"
      },
      { status: 400 }
    );
  }
}
