import { describe, expect, it, vi } from "vitest";
import { crawlUrl } from "@/lib/crawler/crawler";

describe("crawlUrl", () => {
  it("extracts title, description, body text, and images from HTML", async () => {
    const fetcher = vi.fn(async () =>
      new Response(
        `<!doctype html>
        <html>
          <head>
            <title>丝瓜炒蛋</title>
            <meta name="description" content="超级下饭的丝瓜炒蛋">
            <meta property="og:image" content="https://img.example.com/cover.jpg">
          </head>
          <body><main><p>丝瓜切块，鸡蛋炒熟。</p></main></body>
        </html>`,
        { status: 200, headers: { "content-type": "text/html" } }
      )
    );

    const result = await crawlUrl("https://example.com/recipe", fetcher as unknown as typeof fetch);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.title).toBe("丝瓜炒蛋");
      expect(result.description).toBe("超级下饭的丝瓜炒蛋");
      expect(result.text).toContain("丝瓜切块");
      expect(result.imageUrls).toEqual(["https://img.example.com/cover.jpg"]);
    }
  });

  it("returns a structured failure when the request fails", async () => {
    const fetcher = vi.fn(async () => {
      throw new Error("network down");
    });

    const result = await crawlUrl("https://example.com/fail", fetcher as unknown as typeof fetch);

    expect(result).toEqual({
      ok: false,
      errorCode: "network_error",
      errorMessage: "network down"
    });
  });
});
