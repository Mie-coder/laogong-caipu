import { readFamilyAuthConfig } from "@/lib/auth/config";
import { createLoginRateLimiter } from "@/lib/auth/login-rate-limit";
import { verifyFamilyPassword } from "@/lib/auth/password";
import { createFamilyLoginHandler } from "@/lib/auth/route-handlers";
import { createFamilySession } from "@/lib/auth/session";

const limiter = createLoginRateLimiter();

export const POST = createFamilyLoginHandler({
  readConfig: readFamilyAuthConfig,
  verifyPassword: verifyFamilyPassword,
  createSession: createFamilySession,
  limiter,
});
