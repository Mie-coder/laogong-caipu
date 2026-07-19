import sharp from "sharp";

export const INGREDIENT_IMAGE_SIZE = 256;
const MAX_CACHE_BYTES = 512 * 1024;

export async function optimizeIngredientImage(png: Buffer): Promise<Buffer> {
  const output = await sharp(png, { failOn: "error" })
    .rotate()
    .resize(INGREDIENT_IMAGE_SIZE, INGREDIENT_IMAGE_SIZE, { fit: "cover", position: "centre" })
    .webp({ quality: 60, effort: 4 })
    .toBuffer();

  return validateIngredientWebp(output);
}

export function validateIngredientWebp(image: Buffer): Buffer {
  if (
    image.byteLength > MAX_CACHE_BYTES ||
    image.byteLength < 12 ||
    !image.subarray(0, 4).equals(Buffer.from("RIFF")) ||
    !image.subarray(8, 12).equals(Buffer.from("WEBP"))
  ) {
    throw new Error("食材图片压缩结果无效");
  }
  return image;
}
