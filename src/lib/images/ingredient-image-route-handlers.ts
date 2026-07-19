import { z } from "zod";
import { apiError } from "@/lib/http/api-response";
import type { IngredientImageService } from "@/lib/images/ingredient-image-service";

const RequestSchema = z.object({
  kind: z.enum(["ingredient", "seasoning"]),
  index: z.number().int().nonnegative()
}).strict();

const CACHE_KEY_PATTERN = /^[a-f0-9]{64}$/;

type RecipeForIngredientImages = {
  ingredients: Array<{ name: string }>;
  seasonings: Array<{ name: string }>;
};

type PostHandlerDependencies = {
  getRecipeById: (id: number) => RecipeForIngredientImages | null;
  images: IngredientImageService;
};

export function createIngredientImagePostHandler(deps: PostHandlerDependencies) {
  return async function POST(request: Request, context: { params: { id: string } }) {
    const recipeId = parseRecipeId(context.params.id);
    if (recipeId === null) return apiError("invalid_id", "菜谱编号无效", 400);

    const parsed = RequestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return apiError("invalid_request", "请求参数无效", 400);

    const recipe = deps.getRecipeById(recipeId);
    if (!recipe) return apiError("not_found", "菜谱不存在", 404);

    const item = (parsed.data.kind === "ingredient" ? recipe.ingredients : recipe.seasonings)[parsed.data.index];
    if (!item) return apiError("not_found", "食材不存在", 404);

    try {
      return Response.json(await deps.images.getOrCreate(item.name));
    } catch (error) {
      if (error instanceof Error && error.message === "Micu 图片服务未配置") {
        return apiError("image_service_unavailable", "图片服务暂不可用", 503);
      }
      return apiError("image_generation_failed", "图片生成失败", 502);
    }
  };
}

export function createIngredientImageGetHandler(imageService: IngredientImageService) {
  return async function GET(_request: Request, context: { params: { key: string } }) {
    const { key } = context.params;
    if (!CACHE_KEY_PATTERN.test(key)) return apiError("invalid_key", "图片标识无效", 400);

    const png = await imageService.read(key);
    if (!png) return apiError("not_found", "图片不存在", 404);

    return new Response(png, {
      headers: {
        "content-type": "image/png",
        "cache-control": "public, max-age=31536000, immutable",
        etag: `"${key}"`
      }
    });
  };
}

function parseRecipeId(rawId: string): number | null {
  const id = Number(rawId);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}
