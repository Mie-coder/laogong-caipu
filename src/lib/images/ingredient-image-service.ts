import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

const VERSION = "v1";
const MICU_URL = "https://www.micuapi.ai/v1/images/generations";
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const CACHE_KEY_PATTERN = /^[a-f0-9]{64}$/;

export type IngredientImageKind = "ingredient" | "seasoning";
export type IngredientImageResult = { key: string; imageUrl: string };
export type IngredientImageService = {
  getOrCreate(name: string): Promise<IngredientImageResult>;
  read(key: string): Promise<Buffer | null>;
};

export function normalizeIngredientName(name: string) {
  return name.normalize("NFKC").trim().replace(/\s+/g, " ");
}

export function ingredientImageKey(name: string) {
  return createHash("sha256").update(`${VERSION}|${normalizeIngredientName(name)}`).digest("hex");
}

export function buildIngredientImagePrompt(name: string) {
  return `中国家常菜食材摄影，单一食材“${normalizeIngredientName(name)}”，俯拍居中，真实自然纹理，暖米白宣纸色背景，柔和自然光，适合圆形裁切，无文字、无包装、无餐具、无水印。`;
}

export async function generateMicuIngredientPng(name: string): Promise<Buffer> {
  const apiKey = process.env.MICU_API_KEY;
  if (!apiKey) throw new Error("Micu 图片服务未配置");

  const response = await fetch(MICU_URL, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
      "user-agent": "laogong-caipu/1.0"
    },
    body: JSON.stringify({
      model: "gpt-image-2",
      prompt: buildIngredientImagePrompt(name),
      size: "1024x1024",
      quality: "low",
      n: 1
    }),
    signal: AbortSignal.timeout(90_000)
  });

  if (!response.ok) throw new Error("Micu 图片生成失败");
  const payload: unknown = await response.json();
  const image = readImagePayload(payload);

  if ("b64_json" in image) return validatePng(Buffer.from(image.b64_json, "base64"));

  const download = await fetch(image.url, { signal: AbortSignal.timeout(90_000) });
  if (!download.ok) throw new Error("Micu 图片下载失败");
  const declaredLength = Number(download.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_IMAGE_BYTES) throw new Error("Micu 图片超过 12 MiB 限制");
  return validatePng(Buffer.from(await download.arrayBuffer()));
}

export function createIngredientImageService(deps: {
  cacheRoot?: string;
  generate?: (name: string) => Promise<Buffer>;
} = {}): IngredientImageService {
  const cacheRoot = deps.cacheRoot ?? join(process.cwd(), "data", "generated", "ingredients", VERSION);
  const generate = deps.generate ?? generateMicuIngredientPng;
  const inFlight = new Map<string, Promise<IngredientImageResult>>();

  async function read(key: string): Promise<Buffer | null> {
    if (!CACHE_KEY_PATTERN.test(key)) return null;
    try {
      return await readFile(join(cacheRoot, `${key}.png`));
    } catch (error) {
      if (isMissingFile(error)) return null;
      throw error;
    }
  }

  async function getOrCreate(name: string): Promise<IngredientImageResult> {
    const normalizedName = normalizeIngredientName(name);
    const key = ingredientImageKey(normalizedName);
    if (await read(key)) return resultFor(key);

    const existing = inFlight.get(key);
    if (existing) return existing;

    const pending = (async () => {
      const png = validatePng(await generate(normalizedName));
      await mkdir(cacheRoot, { recursive: true });
      const destination = join(cacheRoot, `${key}.png`);
      const temporary = join(cacheRoot, `${key}.${randomUUID()}.tmp`);
      try {
        await writeFile(temporary, png, { flag: "wx" });
        await rename(temporary, destination);
      } finally {
        await unlink(temporary).catch((error: unknown) => {
          if (!isMissingFile(error)) throw error;
        });
      }
      return resultFor(key);
    })();

    inFlight.set(key, pending);
    void pending.then(
      () => inFlight.delete(key),
      () => inFlight.delete(key)
    );
    return pending;
  }

  return { getOrCreate, read };
}

function readImagePayload(payload: unknown): { b64_json: string } | { url: string } {
  if (!payload || typeof payload !== "object") throw new Error("Micu 图片响应无效");
  const data = (payload as { data?: unknown }).data;
  if (!Array.isArray(data) || data.length === 0 || !data[0] || typeof data[0] !== "object") {
    throw new Error("Micu 图片响应无效");
  }
  const image = data[0] as { b64_json?: unknown; url?: unknown };
  if (typeof image.b64_json === "string") return { b64_json: image.b64_json };
  if (typeof image.url === "string") return { url: image.url };
  throw new Error("Micu 图片响应无效");
}

function validatePng(image: Buffer): Buffer {
  if (image.length > MAX_IMAGE_BYTES) throw new Error("Micu 图片超过 12 MiB 限制");
  if (image.length < PNG_SIGNATURE.length || !image.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
    throw new Error("Micu 图片不是 PNG 格式");
  }
  return image;
}

function resultFor(key: string): IngredientImageResult {
  return { key, imageUrl: `/api/ingredient-images/${key}` };
}

function isMissingFile(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
