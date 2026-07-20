import { NextResponse } from "next/server";
import { z } from "zod";
import type { FamilyAuthConfig } from "@/lib/auth/config";
import {
  FAMILY_COOKIE_NAME,
  FAMILY_SESSION_TTL_SECONDS,
} from "@/lib/auth/constants";
import { createLoginRateLimiter } from "@/lib/auth/login-rate-limit";
import { resolvePublicRequestOrigin } from "@/lib/auth/request-origin";

const PasswordSchema = z.string().refine((password) => {
  const length = Array.from(password).length;
  return length >= 5 && length <= 128;
});

const LoginSchema = z.object({ password: PasswordSchema }).strict();

const INVALID_CREDENTIALS = {
  error: { code: "invalid_credentials", message: "家庭密码不正确" },
};

export type LoginHandlerDeps = {
  readConfig: () => FamilyAuthConfig;
  verifyPassword: (password: string, encoded: string) => Promise<boolean>;
  createSession: (secret: string) => Promise<string>;
  limiter: ReturnType<typeof createLoginRateLimiter>;
};

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

function hasSameOrigin(request: Request) {
  const publicOrigin = resolvePublicRequestOrigin(request);
  return publicOrigin !== null && request.headers.get("origin") === publicOrigin;
}

function limiterKey(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  return (forwardedFor || realIp || "unknown").slice(0, 128);
}

function familyCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    // Next accepts the canonical wire value at runtime, while its type uses lowercase literals.
    sameSite: "Lax" as "lax",
    path: "/",
    maxAge,
  };
}

export function createFamilyLoginHandler(deps: LoginHandlerDeps) {
  return async function familyLogin(request: Request): Promise<Response> {
    if (!hasSameOrigin(request)) {
      return errorResponse("forbidden", "请求来源无效", 403);
    }

    const key = limiterKey(request);
    if (deps.limiter.isBlocked(key)) {
      return errorResponse("too_many_attempts", "尝试次数过多，请稍后再试", 429);
    }

    let parsed: z.infer<typeof LoginSchema>;
    try {
      parsed = LoginSchema.parse(await request.json());
    } catch {
      return errorResponse("invalid_request", "登录请求无效", 400);
    }

    try {
      const config = deps.readConfig();
      const valid = await deps.verifyPassword(parsed.password, config.passwordHash);
      if (!valid) {
        deps.limiter.recordFailure(key);
        return NextResponse.json(INVALID_CREDENTIALS, { status: 401 });
      }

      const token = await deps.createSession(config.sessionSecret);
      deps.limiter.reset(key);
      const response = NextResponse.json({ ok: true });
      response.cookies.set(
        FAMILY_COOKIE_NAME,
        token,
        familyCookieOptions(FAMILY_SESSION_TTL_SECONDS),
      );
      return response;
    } catch {
      return errorResponse("service_unavailable", "家庭门禁暂不可用", 503);
    }
  };
}

export function createFamilyLogoutHandler() {
  return async function familyLogout(request: Request): Promise<Response> {
    if (!hasSameOrigin(request)) {
      return errorResponse("forbidden", "请求来源无效", 403);
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set(FAMILY_COOKIE_NAME, "", familyCookieOptions(0));
    return response;
  };
}
