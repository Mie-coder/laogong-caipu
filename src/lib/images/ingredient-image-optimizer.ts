import sharp from "sharp";

export const INGREDIENT_IMAGE_SIZE = 256;
const MAX_CACHE_BYTES = 512 * 1024;

export async function optimizeIngredientImage(png: Buffer): Promise<Buffer> {
  const output = await sharp(png, { failOn: "error" })
    .rotate()
    .resize(INGREDIENT_IMAGE_SIZE, INGREDIENT_IMAGE_SIZE, { fit: "cover", position: "centre" })
    .webp({ quality: 60, effort: 4 })
    .toBuffer();

  return await validateIngredientWebp(output);
}

export async function validateIngredientWebp(image: Buffer): Promise<Buffer> {
  try {
    validateWebpContainer(image);
    const metadata = await sharp(image, { failOn: "error" }).metadata();
    if (
      metadata.format !== "webp" ||
      metadata.width !== INGREDIENT_IMAGE_SIZE ||
      metadata.height !== INGREDIENT_IMAGE_SIZE
    ) {
      throw new Error("invalid WebP dimensions");
    }

    const { info } = await sharp(image, { failOn: "error" }).raw().toBuffer({ resolveWithObject: true });
    if (info.width !== INGREDIENT_IMAGE_SIZE || info.height !== INGREDIENT_IMAGE_SIZE) {
      throw new Error("invalid decoded WebP dimensions");
    }
  } catch {
    throw new Error("食材图片压缩结果无效");
  }
  return image;
}

function validateWebpContainer(image: Buffer): void {
  if (
    image.byteLength > MAX_CACHE_BYTES ||
    image.byteLength < 20 ||
    !image.subarray(0, 4).equals(Buffer.from("RIFF")) ||
    !image.subarray(8, 12).equals(Buffer.from("WEBP")) ||
    image.readUInt32LE(4) !== image.byteLength - 8
  ) {
    throw new Error("invalid WebP container");
  }

  let offset = 12;
  let hasImageChunk = false;
  while (offset < image.byteLength) {
    if (offset + 8 > image.byteLength) throw new Error("truncated WebP chunk header");
    const chunkType = image.toString("ascii", offset, offset + 4);
    const chunkBytes = image.readUInt32LE(offset + 4);
    const chunkEnd = offset + 8 + chunkBytes;
    if (chunkEnd > image.byteLength) throw new Error("truncated WebP chunk");
    if (chunkType === "VP8 " || chunkType === "VP8L" || chunkType === "ANMF") hasImageChunk = true;
    offset = chunkEnd + (chunkBytes % 2);
  }

  if (offset !== image.byteLength || !hasImageChunk) throw new Error("invalid WebP chunks");
}
