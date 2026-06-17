import { describe, expect, it } from "vitest";
import { z } from "zod";

const CookingLogRequestSchema = z.object({
  wifeFeedback: z.string().trim().default(""),
  husbandImprovementNotes: z.string().trim().default(""),
  notes: z.string().trim().default("")
});

describe("recipe API request schemas", () => {
  it("accepts cooking log feedback fields", () => {
    const parsed = CookingLogRequestSchema.parse({
      wifeFeedback: "好吃",
      husbandImprovementNotes: "少放盐",
      notes: "下次多炒一会"
    });

    expect(parsed.husbandImprovementNotes).toBe("少放盐");
  });
});
