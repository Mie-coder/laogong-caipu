import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/http/api-response";

const RequestSchema = z.object({
    imageUrls: z.array(z.string().url()).min(1),
  recipeName: z.string().optional().default("")
});

export async function POST(request: Request) {
  let body: z.infer<typeof RequestSchema>;
  try {
    body = RequestSchema.parse(await request.json());
  } catch (error) {
    return apiError("invalid_image_filter_request", error instanceof Error ? error.message : "图片筛选请求无效", 400);
  }

  const safeImages = [...new Set(body.imageUrls.filter(isSafeImageUrl))];
  try {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ imageUrls: safeImages });
    }

    const prompt = body.recipeName
      ? `以下是小红书笔记中提取到的图片URL列表。请从中筛选出合适作为"${body.recipeName}"这个菜谱配图的图片。\n\n筛选规则：\n- 只保留跟做菜、食材、成品菜相关的图片\n- 排除：用户头像、表情包、广告推广图、无关物品、纯文字图片\n- 如果有多个角度拍摄的最终成品图，都保留\n\n图片URL列表：\n${body.imageUrls.map((url, i) => `${i + 1}. ${url}`).join("\n")}\n\n请返回一个JSON对象，格式为：{"imageUrls": ["筛选后的URL列表"]}。只输出JSON，不要其他内容。`
      : `以下是小红书笔记中提取到的图片URL列表。请从中筛选出与菜谱/做菜/食物相关的图片。\n\n筛选规则：\n- 只保留跟做菜、食材、成品菜相关的图片\n- 排除：用户头像、表情包、广告推广图、无关物品、纯文字图片\n\n图片URL列表：\n${body.imageUrls.map((url, i) => `${i + 1}. ${url}`).join("\n")}\n\n请返回一个JSON对象，格式为：{"imageUrls": ["筛选后的URL列表"]}。只输出JSON，不要其他内容。`;

    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
        temperature: 0.1,
        messages: [{ role: "user", content: prompt }]
      })
    });

    if (!response.ok) {
      return NextResponse.json({ imageUrls: safeImages });
    }

    const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = (payload.choices?.[0]?.message?.content ?? "").trim();
    const stripJson = content.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();
    const parsed = JSON.parse(stripJson);
    const returned = z.object({ imageUrls: z.array(z.string()).default([]) }).safeParse(parsed);
    return NextResponse.json({ imageUrls: returned.success ? returned.data.imageUrls.filter(isSafeImageUrl) : safeImages });

  } catch {
    return NextResponse.json({ imageUrls: safeImages });
  }
}

function isSafeImageUrl(value: string) {
  try { const url = new URL(value); return url.protocol === "http:" || url.protocol === "https:"; } catch { return false; }
}
