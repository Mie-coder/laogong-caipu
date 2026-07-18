import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/images/filter/route";

const urls = [
  "https://sns-avatar.example/avatar.jpg",
  "https://images.example/food.jpg",
  "http://images.example/comment.jpg"
];

function request() {
  return new Request("http://localhost/api/images/filter", { method: "POST", body: JSON.stringify({ imageUrls: urls, recipeName: "菜谱" }) });
}

afterEach(() => { vi.unstubAllGlobals(); delete process.env.DEEPSEEK_API_KEY; });

describe("image filtering provider boundary", () => {
  it.each([
    new Response("upstream unavailable", { status: 502 }),
    new Response("not-json", { status: 200 }),
    new Response(JSON.stringify({ choices: [{ message: { content: "not-json" } }] }), { status: 200 })
  ])("keeps every safe source image when the provider fails", async (providerResponse) => {
    process.env.DEEPSEEK_API_KEY = "test-key";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(providerResponse));

    const response = await POST(request());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ imageUrls: urls });
  });
});
