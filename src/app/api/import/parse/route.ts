import { NextResponse } from "next/server";
import { z } from "zod";
import { parseImport } from "@/lib/import/import-service";
import { apiError } from "@/lib/http/api-response";

const RequestSchema = z.object({
  rawInput: z.string().trim().min(1),
  manualSupplement: z.string().optional().default("")
});

export async function POST(request: Request) {
  try {
    const body = RequestSchema.parse(await request.json());
    const result = await parseImport(body);
    return NextResponse.json({ ...result, imageUrls: (result.imageUrls ?? []).filter(isSafeImageUrl) });
  } catch (error) {
    return apiError("import_parse_failed", error instanceof Error ? error.message : "导入解析失败", 400);
  }
}

function isSafeImageUrl(value: string) {
  try { const url = new URL(value); return url.protocol === "http:" || url.protocol === "https:"; } catch { return false; }
}
