import { z } from "zod";
import { RecipeDraftSchema, type RecipeDraft } from "@/lib/domain/recipe";
import { RecipeDetailResponseSchema, RecipeFavoriteResponseSchema, RecipeListResponseSchema, type RecipeDetail, type RecipeSummary } from "@/lib/domain/recipe-api";
import { ApiError, ApiErrorResponseSchema } from "@/lib/http/api-error";

async function requestJson<T>(url: string, schema: z.ZodType<T>, init: RequestInit = {}, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { ...init, signal, headers: { "Content-Type": "application/json", ...init.headers } });
  const text = await response.text();
  let payload: unknown = null;
  try { payload = text ? JSON.parse(text) : null; } catch { /* non-JSON server failure */ }
  if (!response.ok) {
    const parsed = ApiErrorResponseSchema.safeParse(payload);
    const error = parsed.success ? parsed.data.error : null;
    throw new ApiError(error !== null && typeof error === "object" ? error.code : "http_error", error !== null && typeof error === "object" ? error.message : typeof error === "string" ? error : "请求失败，请稍后重试", response.status);
  }
  const parsed = schema.safeParse(payload);
  if (!parsed.success) throw new ApiError("invalid_response", "服务响应异常，请稍后重试", response.status);
  return parsed.data;
}

const ImportParseResponseSchema = z.object({ recipe: RecipeDraftSchema, imageUrls: z.array(z.string()), needsSupplement: z.boolean(), crawlStatus: z.string(), crawlError: z.string() });

export async function parseImportApi(input: { rawInput: string; manualSupplement?: string }, signal?: AbortSignal): Promise<{ recipe: RecipeDraft; imageUrls: string[]; needsSupplement: boolean; crawlStatus: string; crawlError: string }> {
  const result = await requestJson("/api/import/parse", ImportParseResponseSchema, { method: "POST", body: JSON.stringify(input) }, signal);
  return { ...result, recipe: RecipeDraftSchema.parse(result.recipe) as RecipeDraft };
}
export function saveRecipeApi(recipe: RecipeDraft) { return requestJson("/api/recipes", z.object({ id: z.number() }), { method: "POST", body: JSON.stringify(recipe) }); }
export async function listRecipesApi(params: { query?: string; category?: string; tag?: string; difficulty?: string } = {}, signal?: AbortSignal): Promise<{ recipes: RecipeSummary[] }> {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => { if (value) search.set(key, value); });
  const result = await requestJson(`/api/recipes?${search}`, RecipeListResponseSchema, {}, signal);
  return { recipes: result.recipes.map((recipe) => ({ ...recipe, isFavorite: recipe.isFavorite ?? false })) };
}
export async function getRecipeApi(id: number, signal?: AbortSignal): Promise<{ recipe: RecipeDetail }> {
  const result = await requestJson(`/api/recipes/${id}`, RecipeDetailResponseSchema, {}, signal);
  return { recipe: { ...result.recipe, isFavorite: result.recipe.isFavorite ?? false } };
}
export function setRecipeFavoriteApi(id: number, isFavorite: boolean) {
  return requestJson(`/api/recipes/${id}/favorite`, RecipeFavoriteResponseSchema, { method: "PATCH", body: JSON.stringify({ isFavorite }) });
}
export function addCookingLogApi(id: number, input: { wifeFeedback: string; husbandImprovementNotes: string; notes: string; wifeRating: number }) { return requestJson(`/api/recipes/${id}/cook`, z.object({ ok: z.literal(true) }), { method: "POST", body: JSON.stringify(input) }); }
export function deleteRecipeApi(id: number) { return requestJson(`/api/recipes/${id}`, z.object({ ok: z.literal(true) }), { method: "DELETE" }); }
export async function filterImages(imageUrls: string[], recipeName: string, signal?: AbortSignal): Promise<string[]> {
  try {
    const response = await fetch("/api/images/filter", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ imageUrls, recipeName }), signal });
    if (!response.ok) return imageUrls;
    const payload: unknown = await response.json();
    return z.object({ imageUrls: z.array(z.string()) }).parse(payload).imageUrls;
  } catch {
    return imageUrls;
  }
}
export async function saveRecipeWithImages(draft: RecipeDraft, selectedImageUrls: string[]): Promise<{ id: number }> { return saveRecipeApi({ ...draft, imageUrls: selectedImageUrls }); }
