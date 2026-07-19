import { describe, expect, it, vi } from "vitest";
import { FAMILY_COOKIE_NAME } from "@/lib/auth/constants";
import { createLoginRateLimiter } from "@/lib/auth/login-rate-limit";
import {
  createFamilyLoginHandler,
  createFamilyLogoutHandler,
} from "@/lib/auth/route-handlers";

const ORIGIN = "https://recipes.example";
const VALID_PASSWORD = "正确的家庭共享密码";

function loginRequest(
  password: string,
  options: { origin?: string | null; body?: string; forwardedFor?: string } = {},
) {
  const headers = new Headers({ "content-type": "application/json" });
  if (options.origin !== null) headers.set("origin", options.origin ?? ORIGIN);
  if (options.forwardedFor) headers.set("x-forwarded-for", options.forwardedFor);
  return new Request(`${ORIGIN}/api/auth/login`, {
    method: "POST",
    headers,
    body: options.body ?? JSON.stringify({ password }),
  });
}

function workingLogin(overrides: Partial<Parameters<typeof createFamilyLoginHandler>[0]> = {}) {
  return createFamilyLoginHandler({
    readConfig: () => ({ passwordHash: "encoded", sessionSecret: "s".repeat(32) }),
    verifyPassword: vi.fn().mockResolvedValue(true),
    createSession: vi.fn().mockResolvedValue("payload.signature"),
    limiter: createLoginRateLimiter(),
    ...overrides,
  });
}

describe("family auth route handlers", () => {
  it("sets a 30 day HttpOnly family cookie after a correct same-origin login", async () => {
    const POST = workingLogin();

    const response = await POST(loginRequest(VALID_PASSWORD));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(response.headers.get("set-cookie")).toContain(
      `${FAMILY_COOKIE_NAME}=payload.signature`,
    );
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("set-cookie")).toContain("SameSite=Lax");
    expect(response.headers.get("set-cookie")).toContain("Path=/");
    expect(response.headers.get("set-cookie")).toContain("Max-Age=2592000");
  });

  it("returns the same generic 401 for every wrong password", async () => {
    const POST = workingLogin({ verifyPassword: vi.fn().mockResolvedValue(false) });

    const first = await POST(loginRequest("错误的家庭共享密码一"));
    const second = await POST(loginRequest("错误的家庭共享密码二"));

    expect(first.status).toBe(401);
    expect(second.status).toBe(401);
    expect(await second.json()).toEqual(await first.json());
  });

  it("returns 429 before verifying a source blocked after five failures", async () => {
    const limiter = createLoginRateLimiter();
    for (let attempt = 0; attempt < 5; attempt += 1) limiter.recordFailure("203.0.113.7");
    const verifyPassword = vi.fn().mockResolvedValue(true);
    const POST = workingLogin({ limiter, verifyPassword });

    const response = await POST(
      loginRequest(VALID_PASSWORD, { forwardedFor: "203.0.113.7, 10.0.0.2" }),
    );

    expect(response.status).toBe(429);
    expect(verifyPassword).not.toHaveBeenCalled();
  });

  it("returns 400 for malformed input and 403 for a cross-origin login", async () => {
    const POST = workingLogin();

    const malformed = await POST(loginRequest("unused-value", { body: "{" }));
    const crossOrigin = await POST(
      loginRequest(VALID_PASSWORD, { origin: "https://evil.example" }),
    );

    expect(malformed.status).toBe(400);
    expect(crossOrigin.status).toBe(403);
  });

  it("returns a secret-free 503 when configuration cannot be read", async () => {
    const suppliedSecret = "do-not-expose-this-session-secret";
    const suppliedHash = "do-not-expose-this-password-hash";
    const POST = workingLogin({
      readConfig: () => {
        throw new Error(`${suppliedSecret}:${suppliedHash}`);
      },
    });

    const response = await POST(loginRequest(VALID_PASSWORD));
    const body = await response.text();

    expect(response.status).toBe(503);
    expect(body).not.toContain(suppliedSecret);
    expect(body).not.toContain(suppliedHash);
  });

  it("expires the family cookie on same-origin logout and rejects cross-origin logout", async () => {
    const POST = createFamilyLogoutHandler();

    const response = await POST(
      new Request(`${ORIGIN}/api/auth/logout`, {
        method: "POST",
        headers: { origin: ORIGIN },
      }),
    );
    const crossOrigin = await POST(
      new Request(`${ORIGIN}/api/auth/logout`, {
        method: "POST",
        headers: { origin: "https://evil.example" },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(response.headers.get("set-cookie")).toContain(`${FAMILY_COOKIE_NAME}=`);
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(crossOrigin.status).toBe(403);
  });
});

describe("family auth route module exports", () => {
  it("exports only POST from each auth route module", async () => {
    const loginRoute = await import("@/app/api/auth/login/route");
    const logoutRoute = await import("@/app/api/auth/logout/route");

    expect(Object.keys(loginRoute)).toEqual(["POST"]);
    expect(Object.keys(logoutRoute)).toEqual(["POST"]);
  });

  it("exports only GET from health and returns the exact no-store response", async () => {
    const healthRoute = await import("@/app/api/health/route");

    expect(Object.keys(healthRoute)).toEqual(["GET"]);
    const response = await healthRoute.GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ ok: true });
  });
});
