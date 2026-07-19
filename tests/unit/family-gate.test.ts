import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { FAMILY_COOKIE_NAME } from "@/lib/auth/constants";
import { applyFamilyGate, sanitizeReturnPath } from "@/lib/auth/family-gate";
import { createFamilySession } from "@/lib/auth/session";
import * as middlewareModule from "@/middleware";

const ORIGIN = "https://recipes.example";
const SECRET = "s".repeat(32);

function gatedRequest(
  path: string,
  options: { method?: string; token?: string; origin?: string } = {},
) {
  const headers = new Headers();
  if (options.token) headers.set("cookie", `${FAMILY_COOKIE_NAME}=${options.token}`);
  if (options.origin) headers.set("origin", options.origin);
  return new NextRequest(`${ORIGIN}${path}`, {
    method: options.method,
    headers,
  });
}

describe("family gate", () => {
  it("redirects an anonymous page but returns JSON 401 for an anonymous API", async () => {
    const page = await applyFamilyGate(
      new NextRequest(`${ORIGIN}/recipes/7`),
      SECRET,
    );
    expect(page.status).toBe(307);
    expect(page.headers.get("location")).toBe(
      `${ORIGIN}/unlock?next=%2Frecipes%2F7`,
    );

    const api = await applyFamilyGate(
      new NextRequest(`${ORIGIN}/api/recipes/7`),
      SECRET,
    );
    expect(api.status).toBe(401);
    await expect(api.json()).resolves.toMatchObject({
      error: { code: "unauthorized" },
    });
  });

  it("preserves a protected page search string in its safe unlock redirect", async () => {
    const response = await applyFamilyGate(
      new NextRequest(`${ORIGIN}/recipes?tag=%E5%BF%AB%E6%89%8B`),
      SECRET,
    );

    expect(response.headers.get("location")).toBe(
      `${ORIGIN}/unlock?next=%2Frecipes%3Ftag%3D%25E5%25BF%25AB%25E6%2589%258B`,
    );
  });

  it.each([
    "/unlock",
    "/api/auth/login",
    "/api/auth/logout",
    "/api/health",
    "/_next/static/chunks/app.js",
    "/_next/image?url=%2Fcover.png&w=640&q=75",
  ])("allows the explicit public path %s without a session", async (path) => {
    const response = await applyFamilyGate(gatedRequest(path), undefined);

    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("does not expose other Next internal paths such as _next/data", async () => {
    const response = await applyFamilyGate(
      gatedRequest("/_next/data/build-id/recipes.json"),
      SECRET,
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/unlock?next=");
  });

  it("does not treat arbitrary _next paths as public", async () => {
    const response = await applyFamilyGate(
      gatedRequest("/_next/private/runtime"),
      SECRET,
    );

    expect(response.status).toBe(307);
  });

  it("fails closed for missing and short session secrets", async () => {
    const token = await createFamilySession(SECRET);

    const missing = await applyFamilyGate(
      gatedRequest("/api/recipes", { token }),
      undefined,
    );
    const short = await applyFamilyGate(
      gatedRequest("/api/recipes", { token }),
      "太短",
    );

    expect(missing.status).toBe(401);
    expect(short.status).toBe(401);
  });

  it("passes a valid session and rejects expired or tampered sessions", async () => {
    const valid = await createFamilySession(SECRET);
    const expired = await createFamilySession(SECRET, Date.now() - 31 * 86_400_000);

    const accepted = await applyFamilyGate(
      gatedRequest("/recipes/7", { token: valid }),
      SECRET,
    );
    const expiredResponse = await applyFamilyGate(
      gatedRequest("/api/recipes/7", { token: expired }),
      SECRET,
    );
    const tamperedResponse = await applyFamilyGate(
      gatedRequest("/api/recipes/7", { token: `${valid}x` }),
      SECRET,
    );

    expect(accepted.headers.get("x-middleware-next")).toBe("1");
    expect(expiredResponse.status).toBe(401);
    expect(tamperedResponse.status).toBe(401);
  });

  it("rejects cross-origin unsafe requests with a valid session and accepts same-origin", async () => {
    const token = await createFamilySession(SECRET);

    const crossOrigin = await applyFamilyGate(
      gatedRequest("/api/recipes/7/favorite", {
        method: "PATCH",
        token,
        origin: "https://evil.example",
      }),
      SECRET,
    );
    const sameOrigin = await applyFamilyGate(
      gatedRequest("/api/recipes/7/favorite", {
        method: "PATCH",
        token,
        origin: ORIGIN,
      }),
      SECRET,
    );

    expect(crossOrigin.status).toBe(403);
    await expect(crossOrigin.json()).resolves.toMatchObject({
      error: { code: "forbidden" },
    });
    expect(sameOrigin.headers.get("x-middleware-next")).toBe("1");
  });

  it.each(["GET", "HEAD", "OPTIONS"])(
    "does not require Origin for an authenticated %s request",
    async (method) => {
      const token = await createFamilySession(SECRET);
      const response = await applyFamilyGate(
        gatedRequest("/api/recipes/7", { method, token }),
        SECRET,
      );

      expect(response.headers.get("x-middleware-next")).toBe("1");
    },
  );
});

describe("Next middleware contract", () => {
  it("exports only middleware and config with a matcher covering extensionless business APIs", () => {
    expect(Object.keys(middlewareModule).sort()).toEqual(["config", "middleware"]);
    expect(middlewareModule.config.matcher).toHaveLength(1);

    const matcher = new RegExp(middlewareModule.config.matcher[0]);
    expect(matcher.test("/api/ingredient-images/generated-key")).toBe(true);
    expect(matcher.test("/api/recipes/7/ingredient-images")).toBe(true);
  });

  it("routes _next/data through the real middleware gate", async () => {
    const response = await middlewareModule.middleware(
      gatedRequest("/_next/data/build-id/recipes.json"),
    );

    expect(response.status).toBe(307);
  });
});

describe("sanitizeReturnPath", () => {
  it("accepts only same-site paths beginning with exactly one slash", () => {
    expect(sanitizeReturnPath("/recipes/7?tab=steps")).toBe(
      "/recipes/7?tab=steps",
    );
    for (const unsafe of [
      null,
      "recipes/7",
      "//evil.test/path",
      "https://evil.test/path",
      "/unlock",
      "/unlock?next=/recipes",
      "/unlock/again",
    ]) {
      expect(sanitizeReturnPath(unsafe)).toBe("/");
    }
  });
});
