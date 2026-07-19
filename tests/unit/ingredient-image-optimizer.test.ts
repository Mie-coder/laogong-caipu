import sharp from "sharp";
import { describe, expect, it } from "vitest";
import {
  INGREDIENT_IMAGE_SIZE,
  optimizeIngredientImage,
  validateIngredientWebp
} from "@/lib/images/ingredient-image-optimizer";

describe("ingredient image optimizer", () => {
  it("creates a compact 256 square WebP for the 72px ingredient avatar", async () => {
    const input = await sharp({
      create: { width: 1024, height: 1024, channels: 3, background: { r: 216, g: 120, b: 68 } }
    }).png().toBuffer();

    const output = await optimizeIngredientImage(input);
    const metadata = await sharp(output).metadata();

    expect(metadata.format).toBe("webp");
    expect(metadata.width).toBe(INGREDIENT_IMAGE_SIZE);
    expect(metadata.height).toBe(INGREDIENT_IMAGE_SIZE);
    expect(output.byteLength).toBeLessThan(512 * 1024);
    expect(validateIngredientWebp(output)).toBe(output);
  });

  it.each([
    ["HTML", Buffer.from("<html>not an image</html>")],
    ["random bytes", Buffer.from([0xde, 0xad, 0xbe, 0xef])],
    ["a RIFF file without a WEBP type", Buffer.concat([Buffer.from("RIFF"), Buffer.from([12, 0, 0, 0]), Buffer.from("WAVE"), Buffer.alloc(12)])]
  ])("rejects %s", (_description, image) => {
    expect(() => validateIngredientWebp(image)).toThrow("食材图片压缩结果无效");
  });
});
