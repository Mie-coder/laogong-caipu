import { afterEach, describe, expect, it, vi } from "vitest";
import { access, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
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
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const MAX_CACHE_BYTES = 512 * 1024;
const WEBP = Buffer.concat([
  Buffer.from("RIFF"), Buffer.from([12, 0, 0, 0]), Buffer.from("WEBP"), Buffer.from("VP8 "), Buffer.alloc(8)
]);

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

  it("shares generation and optimization, then reads the WebP cache", async () => {
    const cacheRoot = await mkdtemp(join(tmpdir(), "ingredient-images-"));
    try {
      const generate = vi.fn().mockResolvedValue(PNG);
      const optimize = vi.fn().mockResolvedValue(WEBP);
      const service = createIngredientImageService({ cacheRoot, generate, optimize });

      const [first, second] = await Promise.all([service.getOrCreate("牛肉"), service.getOrCreate("牛肉")]);

      expect(first).toEqual(second);
      expect(generate).toHaveBeenCalledTimes(1);
      expect(optimize).toHaveBeenCalledOnce();
      expect(optimize).toHaveBeenCalledWith(PNG);
      await expect(access(join(cacheRoot, `${first.key}.webp`))).resolves.toBeUndefined();
      await expect(service.read(first.key)).resolves.toEqual(WEBP);
      await service.getOrCreate("牛肉");
      expect(generate).toHaveBeenCalledTimes(1);
      expect(optimize).toHaveBeenCalledTimes(1);
    } finally {
      await rm(cacheRoot, { recursive: true, force: true });
    }
  });

  it("rejects a non-PNG provider payload without creating a cache hit", async () => {
    const cacheRoot = await mkdtemp(join(tmpdir(), "ingredient-images-"));
    try {
      const generate = vi.fn().mockResolvedValue(Buffer.from("html"));
      const optimize = vi.fn().mockResolvedValue(WEBP);
      const service = createIngredientImageService({ cacheRoot, generate, optimize });

      await expect(service.getOrCreate("牛肉")).rejects.toThrow("PNG");
      expect(optimize).not.toHaveBeenCalled();
      await expect(service.read(ingredientImageKey("牛肉"))).resolves.toBeNull();
    } finally {
      await rm(cacheRoot, { recursive: true, force: true });
    }
  });

  it.each([
    ["corrupt", Buffer.from("not-a-webp")],
    ["oversized", Buffer.alloc(MAX_CACHE_BYTES + 1)]
  ])("deletes a %s cache file and regenerates it", async (_kind, invalidCache) => {
    const cacheRoot = await mkdtemp(join(tmpdir(), "ingredient-images-"));
    try {
      const key = ingredientImageKey("牛肉");
      const cachePath = join(cacheRoot, `${key}.webp`);
      await writeFile(cachePath, invalidCache);
      const generate = vi.fn().mockResolvedValue(PNG);
      const optimize = vi.fn().mockResolvedValue(WEBP);
      const service = createIngredientImageService({ cacheRoot, generate, optimize });

      await expect(service.read(key)).resolves.toBeNull();
      await expect(access(cachePath)).rejects.toMatchObject({ code: "ENOENT" });
      await expect(service.getOrCreate("牛肉")).resolves.toMatchObject({ key });
      expect(generate).toHaveBeenCalledTimes(1);
      expect(optimize).toHaveBeenCalledTimes(1);
      await expect(service.read(key)).resolves.toEqual(WEBP);
    } finally {
      await rm(cacheRoot, { recursive: true, force: true });
    }
  });

  it("leaves no cache hit or temporary file when optimization rejects", async () => {
    const cacheRoot = await mkdtemp(join(tmpdir(), "ingredient-images-"));
    try {
      const generate = vi.fn().mockResolvedValue(PNG);
      const optimize = vi.fn().mockRejectedValue(new Error("优化失败"));
      const service = createIngredientImageService({ cacheRoot, generate, optimize });

      await expect(service.getOrCreate("牛肉")).rejects.toThrow("优化失败");
      await expect(service.read(ingredientImageKey("牛肉"))).resolves.toBeNull();
      await expect(readdir(cacheRoot)).resolves.toEqual([]);
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

  it("cancels an oversized streamed Micu JSON response before parsing it", async () => {
    process.env.MICU_API_KEY = "test-micu-key";
    const cancel = vi.fn();
    const response = new Response(oversizedStream(20 * 1024 * 1024, cancel), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));

    await expect(generateMicuIngredientPng("牛肉")).rejects.toThrow("超过");
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it("cancels an oversized streamed Micu image download before buffering it", async () => {
    process.env.MICU_API_KEY = "test-micu-key";
    const cancel = vi.fn();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ url: "https://example.test/image.png" }] }), {
        status: 200,
        headers: { "content-type": "application/json" }
      }))
      .mockResolvedValueOnce(new Response(oversizedStream(MAX_IMAGE_BYTES + 1, cancel), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(generateMicuIngredientPng("牛肉")).rejects.toThrow("超过");
    expect(cancel).toHaveBeenCalledTimes(1);
  });
});

function oversizedStream(bytes: number, cancel: () => void) {
  let sent = false;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (!sent) {
        sent = true;
        controller.enqueue(new Uint8Array(bytes));
      }
    },
    cancel
  });
}
