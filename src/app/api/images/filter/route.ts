import { NextResponse } from "next/server";
import { z } from "zod";

const RequestSchema = z.object({
  imageUrls: z.array(z.string()).min(1),
  recipeName: z.string().optional().default("")
});

export async function POST(request: Request) {
  try {
    const body = RequestSchema.parse(await request.json());
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      // Without API key, just return all images
      return NextResponse.json({ imageUrls: body.imageUrls });
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
      return NextResponse.json({ imageUrls: body.imageUrls });
    }

    const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = (payload.choices?.[0]?.message?.content ?? "").trim();
    const stripJson = content.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();
    const parsed = JSON.parse(stripJson);
    return NextResponse.json({ imageUrls: parsed.imageUrls ?? body.imageUrls });

  } catch {
    return NextResponse.json({ imageUrls: [] }, { status: 500 });
  }
}
