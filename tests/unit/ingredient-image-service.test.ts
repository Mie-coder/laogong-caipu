import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createIngredientImageService,
  generateMicuIngredientPng,
  ingredientImageKey,
  normalizeIngredientName
} from "@/lib/images/ingredient-image-service";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64"
);

const originalApiKey = process.env.MICU_API_KEY;

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalApiKey === undefined) delete process.env.MICU_API_KEY;
  else process.env.MICU_API_KEY = originalApiKey;
});

describe("ingredient image service", () => {
  it("normalizes names and builds a stable versioned cache key", () => {
    expect(normalizeIngredientName("  蒜   瓣  ")).toBe("蒜 瓣");
    expect(ingredientImageKey("蒜 瓣")).toMatch(/^[a-f0-9]{64}$/);
    expect(ingredientImageKey("蒜  瓣")).toBe(ingredientImageKey("蒜 瓣"));
  });

  it("shares one generation for simultaneous requests and then reads the cache", async () => {
    const cacheRoot = await mkdtemp(join(tmpdir(), "ingredient-images-"));
    try {
      const generate = vi.fn().mockResolvedValue(PNG);
      const service = createIngredientImageService({ cacheRoot, generate });

      const [first, second] = await Promise.all([service.getOrCreate("牛肉"), service.getOrCreate("牛肉")]);

      expect(first).toEqual(second);
      expect(generate).toHaveBeenCalledTimes(1);
      await expect(service.read(first.key)).resolves.toEqual(PNG);
      await service.getOrCreate("牛肉");
      expect(generate).toHaveBeenCalledTimes(1);
    } finally {
      await rm(cacheRoot, { recursive: true, force: true });
    }
  });

  it("rejects a non-PNG provider payload without creating a cache hit", async () => {
    const cacheRoot = await mkdtemp(join(tmpdir(), "ingredient-images-"));
    try {
      const generate = vi.fn().mockResolvedValue(Buffer.from("html"));
      const service = createIngredientImageService({ cacheRoot, generate });

      await expect(service.getOrCreate("牛肉")).rejects.toThrow("PNG");
      await expect(service.read(ingredientImageKey("牛肉"))).resolves.toBeNull();
    } finally {
      await rm(cacheRoot, { recursive: true, force: true });
    }
  });

  it("normalizes Micu b64_json responses and supplies authorization from the environment", async () => {
    process.env.MICU_API_KEY = "test-micu-key";
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: [{ b64_json: PNG.toString("base64") }]
    }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(generateMicuIngredientPng("牛肉")).resolves.toEqual(PNG);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://www.micuapi.ai/v1/images/generations",
      expect.objectContaining({
        headers: expect.objectContaining({ authorization: "Bearer test-micu-key" })
      })
    );
  });

  it("downloads and normalizes Micu url responses", async () => {
    process.env.MICU_API_KEY = "test-micu-key";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ url: "https://example.test/image.png" }] }), {
        status: 200,
        headers: { "content-type": "application/json" }
      }))
      .mockResolvedValueOnce(new Response(PNG, { status: 200, headers: { "content-type": "image/png" } }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(generateMicuIngredientPng("牛肉")).resolves.toEqual(PNG);
    expect(fetchMock).toHaveBeenNthCalledWith(2, "https://example.test/image.png", expect.objectContaining({ signal: expect.any(AbortSignal) }));
  });
});
