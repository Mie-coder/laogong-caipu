import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const state = vi.hoisted(() => ({ setFavorite: vi.fn() }));

vi.mock("@/lib/db/recipe-repository", () => ({
  createRecipeRepository: () => ({ setFavorite: state.setFavorite })
}));

import { PATCH as setFavorite } from "@/app/api/recipes/[id]/favorite/route";

function routeContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

const CookingLogRequestSchema = z.object({
  wifeFeedback: z.string().trim().default(""),
  husbandImprovementNotes: z.string().trim().default(""),
  notes: z.string().trim().default("")
});

describe("recipe API request schemas", () => {
  beforeEach(() => state.setFavorite.mockReset());

  it("validates the explicit favorite target and returns a uniform not-found envelope", async () => {
    const invalidId = await setFavorite(new Request("http://localhost/api/recipes/x/favorite", { method: "PATCH", body: JSON.stringify({ isFavorite: true }) }), routeContext("x"));
    expect(invalidId.status).toBe(400);
    expect(await invalidId.json()).toMatchObject({ error: { code: "invalid_id" } });

    const invalidBody = await setFavorite(new Request("http://localhost/api/recipes/7/favorite", { method: "PATCH", body: JSON.stringify({ isFavorite: "true" }) }), routeContext("7"));
    expect(invalidBody.status).toBe(400);
    expect(await invalidBody.json()).toMatchObject({ error: { code: "invalid_request" } });

    state.setFavorite.mockReturnValue(false);
    const missing = await setFavorite(new Request("http://localhost/api/recipes/7/favorite", { method: "PATCH", body: JSON.stringify({ isFavorite: true }) }), routeContext("7"));
    expect(missing.status).toBe(404);
    expect(await missing.json()).toMatchObject({ error: { code: "not_found" } });
  });

  it("persists the requested favorite target instead of toggling server state", async () => {
    state.setFavorite.mockReturnValue(true);
    const response = await setFavorite(new Request("http://localhost/api/recipes/7/favorite", { method: "PATCH", body: JSON.stringify({ isFavorite: true }) }), routeContext("7"));
    expect(state.setFavorite).toHaveBeenCalledWith(7, true);
    expect(await response.json()).toEqual({ isFavorite: true });
  });

  it("accepts cooking log feedback fields", () => {
    const parsed = CookingLogRequestSchema.parse({
      wifeFeedback: "好吃",
      husbandImprovementNotes: "少放盐",
      notes: "下次多炒一会"
    });

    expect(parsed.husbandImprovementNotes).toBe("少放盐");
  });
});
