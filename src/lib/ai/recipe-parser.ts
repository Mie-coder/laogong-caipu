import { RecipeDraft, RecipeDraftSchema } from "@/lib/domain/recipe";

export type RecipeParserInput = {
  sourcePlatform: string;
  sourceUrl: string;
  shareText: string;
  crawledTitle: string;
  crawledText: string;
  crawledImageUrls: string[];
  manualSupplement: string;
};

export interface AIRecipeParser {
  parse(input: RecipeParserInput): Promise<unknown>;
}

export async function parseRecipeFromContent(
  input: RecipeParserInput,
  provider: AIRecipeParser = createAIRecipeParserFromEnv()
): Promise<RecipeDraft> {
  const rawResult = await provider.parse(input);
  const normalized = normalizeAIDraft(rawResult);
  const parsed = RecipeDraftSchema.parse(normalized);

  // Try to extract a name from shareText if AI didn't provide one
  const name = parsed.name || guessDishName(input.shareText);

  return {
    ...parsed,
    name,
    sourcePlatform: input.sourcePlatform,
    sourceUrl: input.sourceUrl,
    originalTitle: input.crawledTitle,
    shareText: input.shareText,
    coverImageUrl: input.crawledImageUrls[0] ?? null
  };
}

function guessDishName(shareText: string): string {
  // Heuristic: take text before first punctuation or link
  const cleaned = shareText
    .replace(/http[^\s]+/g, "")
    .replace(/复制后打开.*$/, "")
    .replace(/！+|。+|，+|！/g, " ")
    .trim();
  const words = cleaned.split(/\s+/).filter((w) => w.length > 1);
  // Return the last phrase that looks like a dish name
  for (let i = words.length - 1; i >= 0; i--) {
    const w = words[i];
    if (w.length >= 2 && !/^(可以|只要|一定|这|是|去|开店|超级|如果)/.test(w)) {
      return w;
    }
  }
  return cleaned.slice(0, 30) || "未知菜谱";
}

function normalizeAIDraft(raw: any): Record<string, unknown> {
  const result = { ...raw } as Record<string, unknown>;

  // Map alternative field names
  if (!result.name && result.title) result.name = result.title;
  if (!result.mainCategory && result.category) result.mainCategory = result.category;
  if (!result.mainCategory) result.mainCategory = "未分类";

  // Normalize ingredients: string[] -> { name, type: "ingredient" }[]
  if (Array.isArray(result.ingredients)) {
    result.ingredients = result.ingredients.map((item: any) =>
      typeof item === "string"
        ? { name: item, amount: "", type: "ingredient" }
        : { ...item, amount: item.amount ?? "", type: item.type ?? "ingredient" }
    );
  } else {
    result.ingredients = [];
  }

  // Normalize seasonings: string[] -> { name, type: "seasoning" }[]
  if (Array.isArray(result.seasonings)) {
    result.seasonings = result.seasonings.map((item: any) =>
      typeof item === "string"
        ? { name: item, amount: "", type: "seasoning" }
        : { ...item, amount: item.amount ?? "", type: item.type ?? "seasoning" }
    );
  } else {
    result.seasonings = [];
  }

  // Clean tags: remove Xiaohongshu hashtags, keep only food/cuisine tags
  if (Array.isArray(result.tags)) {
    const noiseWords = ["今天", "我的", "在家", "美食", "一人", "简单", "超级", "吃", "晚餐", "午饭", "今天吃", "吃什么", "一日", "一餐"];
    result.tags = result.tags
      .filter((tag: string) => !noiseWords.some((w) => tag.includes(w)))
      .slice(0, 5);
  }
  if (!Array.isArray(result.tags) || result.tags.length === 0) {
    result.tags = classifyTags(result);
  }

  // Normalize steps
  if (Array.isArray(result.steps)) {
    result.steps = result.steps.map((item: any, index: number) => {
      if (typeof item === "string") return { order: index + 1, text: item, imageUrl: null };
      const text = item.text || item.description || item.step || "";
      if (!text) return null;
      return { order: item.order ?? index + 1, text, imageUrl: item.imageUrl ?? null };
    }).filter(Boolean);
  }

  if (!Array.isArray(result.steps) || result.steps.length === 0) {
    result.steps = [{ order: 1, text: "按原文步骤操作。" }];
  }

  // Normalize tags
  if (!Array.isArray(result.tags)) {
    result.tags = [];
  }

  // Normalize confidence
  if (typeof result.confidence === "string") {
    result.confidence = Number(result.confidence);
  }
  if (result.confidence === undefined || result.confidence === null) {
    result.confidence = 0.5;
  }

  // Normalize cookTimeMinutes
  if (typeof result.cookTimeMinutes === "string") {
    const match = String(result.cookTimeMinutes).match(/(\d+)/);
    result.cookTimeMinutes = match ? Number(match[1]) : null;
  }
  if (result.prep_time || result.cook_time) {
    const timeMatch = String(result.prep_time || result.cook_time || "").match(/(\d+)/);
    if (!result.cookTimeMinutes && timeMatch) {
      result.cookTimeMinutes = Number(timeMatch[1]);
    }
  }

  // Normalize difficulty
  if (!["easy", "medium", "hard", "unknown"].includes(result.difficulty as string)) {
    result.difficulty = "unknown";
  }

  // Normalize tips
  if (!result.tips) result.tips = "";

  // Normalize missingFields
  if (!Array.isArray(result.missingFields)) result.missingFields = [];

  return result;
}

function classifyTags(recipe: Record<string, unknown>): string[] {
  const tags: string[] = [];
  const category = String(recipe.mainCategory || "");
  const name = String(recipe.name || "");
  const difficulty = String(recipe.difficulty || "");
  const allIngredients = [...(recipe.ingredients as any[] || []), ...(recipe.seasonings as any[] || [])]
    .map((i) => typeof i === "string" ? i : i.name || "")
    .join("");
  const steps = (recipe.steps as any[] || []).map((s) => typeof s === "string" ? s : s.text || "").join("");

  if (category === "烘焙" || name.includes("蛋糕") || name.includes("面包") || name.includes("饼干")) {
    tags.push("烘焙");
  } else if (category === "饮品" || name.includes("奶茶") || name.includes("咖啡") || name.includes("果汁")) {
    tags.push("饮品");
  } else if (category === "甜品" || name.includes("甜") || name.includes("糖水") || name.includes("布丁")) {
    tags.push("甜品");
  }

  if (allIngredients.includes("面") || allIngredients.includes("粉") || name.includes("面") || name.includes("粉")) {
    if (!name.includes("面粉") && !name.includes("淀粉")) tags.push("面食");
  }

  if (steps.includes("炒") || name.includes("炒")) tags.push("炒菜");
  if (steps.includes("炖") || steps.includes("焖") || name.includes("炖")) tags.push("炖菜");
  if (steps.includes("蒸") || name.includes("蒸")) tags.push("蒸菜");
  if (steps.includes("煎") || name.includes("煎")) tags.push("煎");
  if (steps.includes("炸") || name.includes("炸")) tags.push("炸");
  if (steps.includes("烤") || name.includes("烤")) tags.push("烤");

  if (difficulty === "easy") tags.push("快手菜");

  if (category && category !== "未分类") tags.push(category);

  return [...new Set(tags)].slice(0, 5);
}

export function createAIRecipeParserFromEnv(): AIRecipeParser {
  if (process.env.AI_PROVIDER === "deepseek") {
    return new DeepSeekRecipeParser({
      apiKey: process.env.DEEPSEEK_API_KEY ?? "",
      model: process.env.DEEPSEEK_MODEL ?? "deepseek-chat"
    });
  }

  return new MockRecipeParser();
}

export class MockRecipeParser implements AIRecipeParser {
  async parse(input: RecipeParserInput): Promise<unknown> {
    const text = [input.shareText, input.crawledTitle, input.crawledText, input.manualSupplement].join("\n");
    const name = text.includes("丝瓜炒蛋") ? "丝瓜炒蛋" : "家常小炒";

    return {
      name,
      mainCategory: "家常菜",
      tags: ["下饭", "快手菜"],
      ingredients: [{ name: "主食材", amount: "适量", type: "ingredient" as const }],
      seasonings: [{ name: "盐", amount: "适量", type: "seasoning" as const }],
      steps: [
        { order: 1, text: "处理并清洗食材。" },
        { order: 2, text: "热锅下油，按原文提示炒熟。" }
      ],
      cookTimeMinutes: text.includes("5分钟") ? 5 : null,
      difficulty: "easy" as const,
      tips: "根据实际口味调整咸淡。",
      confidence: input.crawledText || input.manualSupplement ? 0.75 : 0.55,
      missingFields: input.crawledText || input.manualSupplement ? [] : ["原文步骤可能不完整"]
    };
  }
}

export class DeepSeekRecipeParser implements AIRecipeParser {
  constructor(private readonly config: { apiKey: string; model: string }) {}

  async parse(input: RecipeParserInput): Promise<unknown> {
    if (!this.config.apiKey) {
      throw new Error("缺少 DEEPSEEK_API_KEY");
    }

    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.config.apiKey}`
      },
      body: JSON.stringify({
        model: this.config.model,
        temperature: 0.3,
        messages: [
          {
            role: "system",
            content: buildSystemPrompt()
          },
          {
            role: "user",
            content: buildPrompt(input)
          }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`DeepSeek 请求失败：HTTP ${response.status}`);
    }

    const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = payload.choices?.[0]?.message?.content ?? "";
    // Log for debug
    console.log("[DeepSeek raw]", content.slice(0, 500));
    return JSON.parse(stripJsonFence(content));
  }
}

function buildSystemPrompt(): string {
  return `你是菜谱结构化助手。根据用户提供的小红书分享内容，推断出完整菜谱并输出JSON。

你必须输出以下所有字段，缺一不可：

{
  "name": "菜名",
  "mainCategory": "分类，如 家常菜/川菜/粤菜/西餐/烘焙/甜品/饮品",
  "tags": ["标签1", "标签2"],
  "ingredients": [
    {"name": "食材名", "amount": "用量", "type": "ingredient"}
  ],
  "seasonings": [
    {"name": "调料名", "amount": "用量", "type": "seasoning"}
  ],
  "steps": [
    {"order": 1, "text": "步骤描述"}
  ],
  "cookTimeMinutes": 数字或null,
  "difficulty": "easy/medium/hard 之一",
  "tips": "烹饪小贴士，没有就空字符串",
  "confidence": 0到1的数字,
  "missingFields": ["缺失的字段名列表"]
}

tags 重要规则：
- tags 只用菜系相关的词，如：快手菜、下饭菜、川菜、粤菜、面食、烘焙、甜品、炖菜、炒菜、蒸菜、汤羹、凉菜、早餐、便当
- 绝对不要用小红书话题标签（今天晚餐长这样、我的美食日记、在家做美食等）
- 最多5个tag

ingredients 和 seasonings 规则：
- 必须是对象数组，每个元素必须有 name/amount/type 三个字段
- 不要把清水/水/食用油放在seasonings里，它们不算调料
- AMOUNT 字段极其重要：必须根据菜谱合理推断每种食材的具体用量，不要全写"适量"。参考常见份量：
  - 肉类主料：如 300克、500克、2块、半只
  - 蔬菜辅料：如 1根、2个、半颗、100克
  - 葱姜蒜：如 3片、2瓣、1段
  - 蛋类：如 2个、3个
  - 调料：如 1汤匙(15ml)、1茶匙(5ml)、少许、适量
  - 无法准确判断时才写"适量"

steps 规则：
- 必须是对象数组，每个元素必须有序号和步骤文本
- 即使信息不完整也要尽量输出
- 只输出 JSON，不要任何 markdown 代码块或其他文字。`;
}

function buildPrompt(input: RecipeParserInput): string {
  const parts = [];
  if (input.shareText) parts.push(`分享文案：${input.shareText}`);
  if (input.crawledTitle) parts.push(`页面标题：${input.crawledTitle}`);
  if (input.crawledText) parts.push(`页面正文：${input.crawledText.slice(0, 3000)}`);
  if (input.manualSupplement) parts.push(`用户补充：${input.manualSupplement}`);
  if (parts.length === 0) parts.push("无内容，请根据菜名推断");
  return parts.join("\n\n");
}

function stripJsonFence(content: string): string {
  return content.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
}
