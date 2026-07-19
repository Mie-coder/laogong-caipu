import { afterEach, describe, expect, it, vi } from "vitest";
import { filterImages, listRecipesApi, logoutFamilyApi, parseImportApi, unlockFamilyApi } from "@/lib/http/api-client";

afterEach(() => vi.unstubAllGlobals());

describe("API client response validation and degradation", () => {
  it("posts the family password only in the login JSON body", async () => {
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", request);

    await expect(unlockFamilyApi("我们两个人的长密码")).resolves.toEqual({ ok: true });
    expect(request).toHaveBeenCalledWith("/api/auth/login", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ password: "我们两个人的长密码" }),
    }));
  });

  it("posts an empty JSON body to log out the family", async () => {
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", request);

    await expect(logoutFamilyApi()).resolves.toEqual({ ok: true });
    expect(request).toHaveBeenCalledWith("/api/auth/logout", expect.objectContaining({ method: "POST", body: "{}" }));
  });

  it("rejects an import response whose recipe is not a valid RecipeDraft", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      recipe: { name: "", steps: [] }, imageUrls: [], needsSupplement: false, crawlStatus: "ok", crawlError: ""
    }), { status: 200, headers: { "Content-Type": "application/json" } })));

    await expect(parseImportApi({ rawInput: "分享文本" })).rejects.toThrow();
  });

  it.each([
    new Error("offline"),
    new Response("not json", { status: 200 }),
    new Response(JSON.stringify({ imageUrls: [123] }), { status: 200, headers: { "Content-Type": "application/json" } })
  ])("returns original image URLs when image filtering cannot produce a valid response", async (failure) => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => {
      if (failure instanceof Error) return Promise.reject(failure);
      return Promise.resolve(failure);
    }));

    await expect(filterImages(["first.jpg", "second.jpg"], "菜谱")).resolves.toEqual(["first.jpg", "second.jpg"]);
  });

  it("turns a non-JSON error body into a safe API error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("gateway unavailable", { status: 502 })));

    await expect(listRecipesApi()).rejects.toMatchObject({ code: "http_error", message: "请求失败，请稍后重试", status: 502 });
  });

  it.each([
    [JSON.stringify({ error: "权限不足" }), "权限不足"],
    [JSON.stringify({ detail: "secret" }), "请求失败，请稍后重试"],
    ["<html><body>secret trace</body></html>", "请求失败，请稍后重试"]
  ])("normalizes flat and unsafe server error payloads", async (body, message) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(body, { status: 500 })));
    await expect(listRecipesApi()).rejects.toMatchObject({ code: "http_error", message });
  });

  it("turns a successful but invalid payload into an invalid_response ApiError", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ recipes: [{ id: "bad" }] }), { status: 200 })));
    await expect(listRecipesApi()).rejects.toMatchObject({ code: "invalid_response", message: "服务响应异常，请稍后重试" });
  });

  it("forwards the list AbortSignal to fetch", async () => {
    const signal = new AbortController().signal;
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({ recipes: [] }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", request);

    await listRecipesApi({ query: "鸡翅" }, signal);
    expect(request).toHaveBeenCalledWith("/api/recipes?query=%E9%B8%A1%E7%BF%85", expect.objectContaining({ signal }));
  });

  it("normalizes legacy list recipes to a required favorite boolean", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ recipes: [{
      id: 1, name: "菜谱", mainCategory: "家常菜", coverImageUrl: null, cookedCount: 0, cookTimeMinutes: null,
      difficulty: "easy", tags: [], latestWifeFeedback: "", wifeRating: 0
    }] }), { status: 200, headers: { "Content-Type": "application/json" } })));

    await expect(listRecipesApi()).resolves.toMatchObject({ recipes: [{ isFavorite: false }] });
  });
});
