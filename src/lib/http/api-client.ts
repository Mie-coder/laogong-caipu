import { RecipeDraft } from "@/lib/domain/recipe";

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {})
    }
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error ?? "请求失败");
  }
  return payload as T;
}

export function parseImportApi(input: { rawInput: string; manualSupplement?: string }) {
  return requestJson<{ recipe: RecipeDraft; imageUrls: string[]; needsSupplement: boolean; crawlStatus: string; crawlError: string }>(
    "/api/import/parse",
    { method: "POST", body: JSON.stringify(input) }
  );
}

export function saveRecipeApi(recipe: RecipeDraft) {
  return requestJson<{ id: number }>("/api/recipes", { method: "POST", body: JSON.stringify(recipe) });
}

export function listRecipesApi(params: { query?: string; category?: string; tag?: string; difficulty?: string } = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) search.set(key, value);
  });
  return requestJson<{ recipes: any[] }>(`/api/recipes?${search.toString()}`);
}

export function getRecipeApi(id: number) {
  return requestJson<{ recipe: any }>(`/api/recipes/${id}`);
}

export function addCookingLogApi(id: number, input: { wifeFeedback: string; husbandImprovementNotes: string; notes: string; wifeRating: number }) {
  return requestJson<{ ok: true }>(`/api/recipes/${id}/cook`, { method: "POST", body: JSON.stringify(input) });
}

export function deleteRecipeApi(id: number) {
  return requestJson<{ ok: true }>(`/api/recipes/${id}`, { method: "DELETE" });
}

export async function filterImages(imageUrls: string[], recipeName: string): Promise<string[]> {
  try {
    const response = await fetch("/api/images/filter", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ imageUrls, recipeName })
    });
    const payload = await response.json();
    return payload.imageUrls ?? imageUrls;
  } catch {
    return imageUrls;
  }
}

export async function saveRecipeWithImages(draft: RecipeDraft, selectedImageUrls: string[]): Promise<{ id: number }> {
  return saveRecipeApi({ ...draft, imageUrls: selectedImageUrls });
}
