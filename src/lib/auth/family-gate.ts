import { NextRequest, NextResponse } from "next/server";
import { FAMILY_COOKIE_NAME } from "@/lib/auth/constants";
import { resolvePublicRequestOrigin } from "@/lib/auth/request-origin";
import { verifyFamilySession } from "@/lib/auth/session";

const PUBLIC_PATHS = new Set([
  "/unlock",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/health",
]);
const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const FALLBACK_RETURN_PATH = "/";
const RETURN_PATH_ORIGIN = "https://family.invalid";

function jsonError(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

function isPublicPath(pathname: string) {
  return (
    PUBLIC_PATHS.has(pathname) ||
    pathname.startsWith("/_next/static/") ||
    pathname === "/_next/image"
  );
}

function hasValidSecret(secret: string | undefined): secret is string {
  return Boolean(secret && new TextEncoder().encode(secret).byteLength >= 32);
}

export function sanitizeReturnPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return FALLBACK_RETURN_PATH;
  }

  try {
    const parsed = new URL(value, RETURN_PATH_ORIGIN);
    if (parsed.origin !== RETURN_PATH_ORIGIN) return FALLBACK_RETURN_PATH;
    if (parsed.pathname === "/unlock" || parsed.pathname.startsWith("/unlock/")) {
      return FALLBACK_RETURN_PATH;
    }
    return value;
  } catch {
    return FALLBACK_RETURN_PATH;
  }
}

export async function applyFamilyGate(
  request: NextRequest,
  secret: string | undefined,
): Promise<NextResponse> {
  const { pathname, search } = request.nextUrl;
  if (isPublicPath(pathname)) return NextResponse.next();

  const token = request.cookies.get(FAMILY_COOKIE_NAME)?.value;
  const authenticated =
    hasValidSecret(secret) && Boolean(token && (await verifyFamilySession(token, secret)));

  if (authenticated) {
    if (UNSAFE_METHODS.has(request.method.toUpperCase())) {
      const publicOrigin = resolvePublicRequestOrigin(request);
      if (publicOrigin === null || request.headers.get("origin") !== publicOrigin) {
        return jsonError("forbidden", "请求来源无效", 403);
      }
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return jsonError("unauthorized", "需要家庭解锁", 401);
  }

  const publicOrigin = resolvePublicRequestOrigin(request);
  if (publicOrigin === null) {
    return jsonError("forbidden", "请求来源无效", 403);
  }

  const unlockUrl = new URL("/unlock", publicOrigin);
  unlockUrl.searchParams.set("next", sanitizeReturnPath(`${pathname}${search}`));
  return NextResponse.redirect(unlockUrl);
}
