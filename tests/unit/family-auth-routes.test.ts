import { afterEach, describe, expect, it, vi } from "vitest";
import { FAMILY_COOKIE_NAME } from "@/lib/auth/constants";
import { createLoginRateLimiter } from "@/lib/auth/login-rate-limit";
import {
  createFamilyLoginHandler,
  createFamilyLogoutHandler,
} from "@/lib/auth/route-handlers";

const ORIGIN = "https://recipes.example";
const VALID_PASSWORD = "正确的家庭共享密码";

afterEach(() => {
  vi.unstubAllEnvs();
});

function loginRequest(
  password: string,
  options: {
    origin?: string | null;
    body?: string;
    forwardedFor?: string;
    forwardedProto?: string;
    forwardedHost?: string;
    host?: string;
    requestOrigin?: string;
  } = {},
) {
  const headers = new Headers({ "content-type": "application/json" });
  if (options.origin !== null) headers.set("origin", options.origin ?? ORIGIN);
  if (options.forwardedFor) headers.set("x-forwarded-for", options.forwardedFor);
  if (options.forwardedProto !== undefined) {
    headers.set("x-forwarded-proto", options.forwardedProto);
  }
  if (options.forwardedHost !== undefined) {
    headers.set("x-forwarded-host", options.forwardedHost);
  }
  if (options.host !== undefined) headers.set("host", options.host);
  return new Request(`${options.requestOrigin ?? ORIGIN}/api/auth/login`, {
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

function limiterSpies(blocked = false) {
  return {
    isBlocked: vi.fn().mockReturnValue(blocked),
    recordFailure: vi.fn(),
    reset: vi.fn(),
  };
}

describe("family auth route handlers", () => {
  it("sets a 30 day HttpOnly family cookie after a correct same-origin login", async () => {
    const POST = workingLogin();

    const response = await POST(loginRequest(VALID_PASSWORD));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    const cookie = response.headers.get("set-cookie");
    expect(cookie).toContain(
      `${FAMILY_COOKIE_NAME}=payload.signature`,
    );
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("Max-Age=2592000");
    expect(cookie).not.toContain("Secure");
  });

  it("accepts login through first trusted proxy origin values including a public port", async () => {
    const POST = workingLogin();

    const response = await POST(
      loginRequest(VALID_PASSWORD, {
        requestOrigin: "http://0.0.0.0:3000",
        origin: "https://recipes.example:8443",
        forwardedProto: "https, http",
        forwardedHost: "recipes.example:8443, 0.0.0.0:3000",
        host: "0.0.0.0:3000",
      }),
    );

    expect(response.status).toBe(200);
  });

  it("accepts logout through forwarded proto with the public Host fallback", async () => {
    const POST = createFamilyLogoutHandler();
    const response = await POST(
      new Request("http://0.0.0.0:3000/api/auth/logout", {
        method: "POST",
        headers: {
          origin: "https://recipes.example:9443",
          "x-forwarded-proto": "https, http",
          host: "recipes.example:9443",
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  });

  it("rejects mismatched or invalid trusted proxy origins", async () => {
    const POST = workingLogin();
    const proxyOptions = {
      requestOrigin: "http://0.0.0.0:3000",
      forwardedProto: "https",
      forwardedHost: "recipes.example",
      host: "0.0.0.0:3000",
    };

    const mismatch = await POST(
      loginRequest(VALID_PASSWORD, {
        ...proxyOptions,
        origin: "https://evil.example",
      }),
    );
    const invalidProto = await POST(
      loginRequest(VALID_PASSWORD, {
        ...proxyOptions,
        origin: "http://0.0.0.0:3000",
        forwardedProto: "javascript",
      }),
    );
    const invalidHost = await POST(
      loginRequest(VALID_PASSWORD, {
        ...proxyOptions,
        origin: "http://0.0.0.0:3000",
        forwardedHost: "recipes.example/path",
      }),
    );

    expect(mismatch.status).toBe(403);
    expect(invalidProto.status).toBe(403);
    expect(invalidHost.status).toBe(403);
  });

  it("sets Secure on the family cookie in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const POST = workingLogin();

    const response = await POST(loginRequest(VALID_PASSWORD));

    expect(response.headers.get("set-cookie")).toContain("Secure");
  });

  it("rejects a four-code-point emoji password before verification", async () => {
    const verifyPassword = vi.fn().mockResolvedValue(true);
    const POST = workingLogin({ verifyPassword });

    const response = await POST(loginRequest("😀😀😀😀"));

    expect(response.status).toBe(400);
    expect(verifyPassword).not.toHaveBeenCalled();
  });

  it("allows a correct five-character password to reach verification", async () => {
    const password = "abcde";
    const verifyPassword = vi.fn().mockResolvedValue(true);
    const POST = workingLogin({ verifyPassword });

    const response = await POST(loginRequest(password));

    expect(response.status).toBe(200);
    expect(verifyPassword).toHaveBeenCalledWith(password, "encoded");
  });

  it("allows 65 emoji code points to reach password verification", async () => {
    const password = "😀".repeat(65);
    const verifyPassword = vi.fn().mockResolvedValue(true);
    const POST = workingLogin({ verifyPassword });

    const response = await POST(loginRequest(password));

    expect(response.status).toBe(200);
    expect(verifyPassword).toHaveBeenCalledWith(password, "encoded");
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
    const limiter = limiterSpies(true);
    const verifyPassword = vi.fn().mockResolvedValue(true);
    const POST = workingLogin({ limiter, verifyPassword });

    const response = await POST(
      loginRequest(VALID_PASSWORD, { forwardedFor: "203.0.113.7, 10.0.0.2" }),
    );

    expect(response.status).toBe(429);
    expect(limiter.isBlocked).toHaveBeenCalledWith("203.0.113.7");
    expect(verifyPassword).not.toHaveBeenCalled();
  });

  it("records a wrong password against only the trimmed first forwarded IP", async () => {
    const password = "错误的家庭共享密码";
    const limiter = limiterSpies();
    const POST = workingLogin({
      limiter,
      verifyPassword: vi.fn().mockResolvedValue(false),
    });

    await POST(
      loginRequest(password, {
        forwardedFor: " 203.0.113.8 , 10.0.0.2",
      }),
    );

    expect(limiter.recordFailure).toHaveBeenCalledWith("203.0.113.8");
    expect(limiter.recordFailure).not.toHaveBeenCalledWith(
      expect.stringContaining(password),
    );
  });

  it("resets successful attempts using x-real-ip when forwarded-for is absent", async () => {
    const limiter = limiterSpies();
    const POST = workingLogin({ limiter });
    const request = loginRequest(VALID_PASSWORD);
    request.headers.set("x-real-ip", "198.51.100.17");

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(limiter.reset).toHaveBeenCalledWith("198.51.100.17");
    expect(limiter.recordFailure).not.toHaveBeenCalled();
  });

  it("truncates the limiter key to 128 characters", async () => {
    const longForwardedIdentifier = "x".repeat(140);
    const limiter = limiterSpies();
    const POST = workingLogin({
      limiter,
      verifyPassword: vi.fn().mockResolvedValue(false),
    });

    await POST(
      loginRequest("错误的家庭共享密码", {
        forwardedFor: `${longForwardedIdentifier}, 10.0.0.2`,
      }),
    );

    expect(limiter.recordFailure).toHaveBeenCalledWith("x".repeat(128));
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
