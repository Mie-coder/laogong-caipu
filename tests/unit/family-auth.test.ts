import { describe, expect, it } from "vitest";
import { readFamilyAuthConfig } from "@/lib/auth/config";
import { createLoginRateLimiter } from "@/lib/auth/login-rate-limit";
import { hashFamilyPassword, verifyFamilyPassword } from "@/lib/auth/password";
import { createFamilySession, verifyFamilySession } from "@/lib/auth/session";

describe("family auth primitives", () => {
  it("hashes and verifies a family password without storing plaintext", async () => {
    const encoded = await hashFamilyPassword("我们两个人的长密码", Buffer.alloc(16, 7));
    expect(encoded).toMatch(/^scrypt\$[A-Za-z0-9_-]+\$[A-Za-z0-9_-]+$/);
    expect(encoded).not.toContain("我们两个人的长密码");
    await expect(verifyFamilyPassword("我们两个人的长密码", encoded)).resolves.toBe(true);
    await expect(verifyFamilyPassword("错误密码", encoded)).resolves.toBe(false);
    await expect(verifyFamilyPassword("任意", "损坏摘要")).resolves.toBe(false);
  });

  it("accepts only an untampered unexpired 30 day session", async () => {
    const secret = "s".repeat(32);
    const token = await createFamilySession(secret, 1_700_000_000_000);
    await expect(verifyFamilySession(token, secret, 1_700_000_001_000)).resolves.toBe(true);
    await expect(verifyFamilySession(`${token}x`, secret, 1_700_000_001_000)).resolves.toBe(false);
    await expect(
      verifyFamilySession(token, secret, 1_700_000_000_000 + 30 * 86_400_000 + 1),
    ).resolves.toBe(false);
  });

  it("blocks the fifth failed login for 15 minutes and resets on success", () => {
    let now = 1_000;
    const limiter = createLoginRateLimiter({ now: () => now });
    for (let attempt = 0; attempt < 5; attempt += 1) limiter.recordFailure("203.0.113.7");
    expect(limiter.isBlocked("203.0.113.7")).toBe(true);
    limiter.reset("203.0.113.7");
    expect(limiter.isBlocked("203.0.113.7")).toBe(false);
    for (let attempt = 0; attempt < 5; attempt += 1) limiter.recordFailure("203.0.113.7");
    now += 15 * 60_000 + 1;
    expect(limiter.isBlocked("203.0.113.7")).toBe(false);
  });

  it("rejects invalid family auth configuration without exposing supplied values", () => {
    const validHash = `scrypt$${Buffer.alloc(16, 1).toString("base64url")}$${Buffer.alloc(64, 2).toString("base64url")}`;
    const validSecret = "a".repeat(32);
    expect(
      readFamilyAuthConfig({
        FAMILY_PASSWORD_HASH: validHash,
        FAMILY_SESSION_SECRET: validSecret,
      }),
    ).toEqual({ passwordHash: validHash, sessionSecret: validSecret });

    const invalidConfigurations = [
      { FAMILY_SESSION_SECRET: validSecret },
      { FAMILY_PASSWORD_HASH: "invalid-family-hash", FAMILY_SESSION_SECRET: validSecret },
      { FAMILY_PASSWORD_HASH: validHash, FAMILY_SESSION_SECRET: "short-secret" },
    ];

    for (const env of invalidConfigurations) {
      try {
        readFamilyAuthConfig(env);
        throw new Error("expected invalid family auth configuration to throw");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe("家庭门禁配置无效");
        for (const suppliedValue of Object.values(env)) {
          expect((error as Error).message).not.toContain(suppliedValue);
        }
      }
    }
  });
});
