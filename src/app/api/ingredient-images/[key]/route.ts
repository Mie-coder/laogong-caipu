import { apiError } from "@/lib/http/api-response";
import {
  createIngredientImageService,
  type IngredientImageService
} from "@/lib/images/ingredient-image-service";

const CACHE_KEY_PATTERN = /^[a-f0-9]{64}$/;
const images = createIngredientImageService();

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

export const GET = createIngredientImageGetHandler(images);
