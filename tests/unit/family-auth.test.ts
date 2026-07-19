import { EventEmitter } from "node:events";
import { describe, expect, it } from "vitest";
import { readFamilyAuthConfig } from "@/lib/auth/config";
import { createLoginRateLimiter } from "@/lib/auth/login-rate-limit";
import { hashFamilyPassword, verifyFamilyPassword } from "@/lib/auth/password";
import { createFamilySession, verifyFamilySession } from "@/lib/auth/session";
// @ts-ignore The executable JavaScript module intentionally exposes testable runtime seams.
import {
  readMaskedPassword,
  runHashFamilyPassword,
} from "../../scripts/hash-family-password.mjs";

const SYNTHETIC_PASSWORD = "unit-test-password";
const SYNTHETIC_WRONG_PASSWORD = "wrong-test-password";
const SESSION_NOW_MS = 1_700_000_000_000;
const SESSION_TTL_MS = 30 * 86_400_000;

function encodeBase64Url(value: string | ArrayBuffer) {
  return Buffer.from(typeof value === "string" ? value : new Uint8Array(value)).toString("base64url");
}

async function signEncodedPayload(encodedPayload: string, secret: string) {
  const encoder = new TextEncoder();
  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await globalThis.crypto.subtle.sign("HMAC", key, encoder.encode(encodedPayload));
  return `${encodedPayload}.${encodeBase64Url(signature)}`;
}

function signPayload(payload: unknown, secret: string) {
  return signEncodedPayload(encodeBase64Url(JSON.stringify(payload)), secret);
}

class FakeTty extends EventEmitter {
  isTTY = true;
  isRaw = false;
  readonly rawModes: boolean[] = [];
  paused = false;

  constructor(private readonly chunks: string[]) {
    super();
  }

  setEncoding() {}

  setRawMode(value: boolean) {
    this.isRaw = value;
    this.rawModes.push(value);
  }

  resume() {
    queueMicrotask(() => {
      for (const chunk of this.chunks) this.emit("data", chunk);
    });
  }

  pause() {
    this.paused = true;
  }
}

function createCapture() {
  let output = "";
  return {
    stream: {
      write(value: string) {
        output += value;
        return true;
      },
    },
    read: () => output,
  };
}

describe("family auth primitives", () => {
  it("hashes and verifies a family password without storing plaintext", async () => {
    const encoded = await hashFamilyPassword("我们两个人的长密码", Buffer.alloc(16, 7));
    expect(encoded).toMatch(/^scrypt\$[A-Za-z0-9_-]+\$[A-Za-z0-9_-]+$/);
    expect(encoded).not.toContain("我们两个人的长密码");
    await expect(verifyFamilyPassword("我们两个人的长密码", encoded)).resolves.toBe(true);
    await expect(verifyFamilyPassword("错误密码", encoded)).resolves.toBe(false);
    await expect(verifyFamilyPassword(SYNTHETIC_WRONG_PASSWORD, encoded)).resolves.toBe(false);
    await expect(verifyFamilyPassword("任意", "损坏摘要")).resolves.toBe(false);
  });

  it("uses Unicode code points for password length and rejects malformed hashes", async () => {
    const fourEmoji = "😀😀😀😀";
    expect(fourEmoji.length).toBe(8);
    expect(Array.from(fourEmoji)).toHaveLength(4);
    await expect(hashFamilyPassword(fourEmoji, Buffer.alloc(16, 3))).rejects.toThrow();

    const encoded = await hashFamilyPassword(SYNTHETIC_PASSWORD, Buffer.alloc(16, 3));
    await expect(verifyFamilyPassword(fourEmoji, encoded)).resolves.toBe(false);

    const validSalt = Buffer.alloc(16, 3).toString("base64url");
    const validDigest = Buffer.alloc(64, 4).toString("base64url");
    expect(validSalt.endsWith("w")).toBe(true);
    const nonCanonicalSalt = `${validSalt.slice(0, -1)}x`;
    expect(Buffer.from(nonCanonicalSalt, "base64url")).toEqual(Buffer.from(validSalt, "base64url"));
    expect(Buffer.from(nonCanonicalSalt, "base64url").toString("base64url")).toBe(validSalt);
    const malformedHashes = [
      `scrypt$${Buffer.alloc(15, 3).toString("base64url")}$${validDigest}`,
      `scrypt$${validSalt}$${Buffer.alloc(63, 4).toString("base64url")}`,
      `scrypt$${nonCanonicalSalt}$${validDigest}`,
    ];
    for (const malformedHash of malformedHashes) {
      await expect(verifyFamilyPassword(SYNTHETIC_PASSWORD, malformedHash)).resolves.toBe(false);
    }
  });

  it("accepts only an untampered unexpired 30 day session", async () => {
    const secret = "s".repeat(32);
    const token = await createFamilySession(secret, SESSION_NOW_MS);
    await expect(verifyFamilySession(token, secret, SESSION_NOW_MS + 1_000)).resolves.toBe(true);
    await expect(verifyFamilySession(`${token}x`, secret, SESSION_NOW_MS + 1_000)).resolves.toBe(false);
    await expect(verifyFamilySession(token, secret, SESSION_NOW_MS + SESSION_TTL_MS - 1)).resolves.toBe(true);
    await expect(verifyFamilySession(token, secret, SESSION_NOW_MS + SESSION_TTL_MS)).resolves.toBe(false);
  });

  it("rejects structurally invalid and correctly signed invalid session payloads", async () => {
    const secret = "s".repeat(32);
    const token = await createFamilySession(secret, SESSION_NOW_MS);
    await expect(verifyFamilySession(`${token}.extra`, secret, SESSION_NOW_MS)).resolves.toBe(false);
    await expect(verifyFamilySession("***.***", secret, SESSION_NOW_MS)).resolves.toBe(false);

    const invalidJsonToken = await signEncodedPayload(encodeBase64Url("{"), secret);
    const wrongVersionToken = await signPayload({ v: 2, exp: 1_800_000_000 }, secret);
    const fractionalExpiryToken = await signPayload({ v: 1, exp: 1_800_000_000.5 }, secret);
    await expect(verifyFamilySession(invalidJsonToken, secret, SESSION_NOW_MS)).resolves.toBe(false);
    await expect(verifyFamilySession(wrongVersionToken, secret, SESSION_NOW_MS)).resolves.toBe(false);
    await expect(verifyFamilySession(fractionalExpiryToken, secret, SESSION_NOW_MS)).resolves.toBe(false);
  });

  it("blocks the fifth failed login for 15 minutes and resets on success", () => {
    let now = 1_000;
    const limiter = createLoginRateLimiter({ now: () => now });
    for (let attempt = 0; attempt < 4; attempt += 1) {
      limiter.recordFailure("203.0.113.7");
      expect(limiter.isBlocked("203.0.113.7")).toBe(false);
    }
    limiter.recordFailure("203.0.113.7");
    expect(limiter.isBlocked("203.0.113.7")).toBe(true);
    limiter.reset("203.0.113.7");
    expect(limiter.isBlocked("203.0.113.7")).toBe(false);
    for (let attempt = 0; attempt < 5; attempt += 1) limiter.recordFailure("203.0.113.7");
    now += 15 * 60_000;
    expect(limiter.isBlocked("203.0.113.7")).toBe(false);
  });

  it("prunes expired attempts and evicts the oldest entry at the capacity limit", () => {
    let now = 1_000;
    const limiter = createLoginRateLimiter({ now: () => now });
    const expiredKey = "198.51.100.1";
    for (let attempt = 0; attempt < 5; attempt += 1) limiter.recordFailure(expiredKey);
    now += 15 * 60_000;
    expect(limiter.isBlocked(expiredKey)).toBe(false);
    for (let attempt = 0; attempt < 4; attempt += 1) {
      limiter.recordFailure(expiredKey);
      expect(limiter.isBlocked(expiredKey)).toBe(false);
    }
    limiter.recordFailure(expiredKey);
    expect(limiter.isBlocked(expiredKey)).toBe(true);
    limiter.reset(expiredKey);

    const oldestBlockedKey = "198.51.100.2";
    now += 1;
    for (let attempt = 0; attempt < 5; attempt += 1) limiter.recordFailure(oldestBlockedKey);
    expect(limiter.isBlocked(oldestBlockedKey)).toBe(true);
    for (let index = 0; index < 1_000; index += 1) {
      now += 1;
      limiter.recordFailure(`capacity-key-${index}`);
    }
    expect(limiter.isBlocked(oldestBlockedKey)).toBe(false);
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

  it("masks editable TTY input and writes only a digest to stdout", async () => {
    const input = new FakeTty(["unit-test-X\u007fpassword\r"]);
    const stdout = createCapture();
    const stderr = createCapture();

    await runHashFamilyPassword({ input, stdout: stdout.stream, stderr: stderr.stream });

    expect(input.rawModes).toEqual([true, false]);
    expect(input.paused).toBe(true);
    expect(stderr.read()).toContain("***********\b \b********");
    expect(stderr.read()).not.toContain(SYNTHETIC_PASSWORD);
    expect(stdout.read()).toMatch(/^scrypt\$[A-Za-z0-9_-]+\$[A-Za-z0-9_-]+\n$/);
    expect(stdout.read()).not.toContain(SYNTHETIC_PASSWORD);
    expect(stdout.read().trim().split("\n")).toHaveLength(1);
  });

  it("restores raw mode when masked TTY input is cancelled", async () => {
    const input = new FakeTty(["\u0003"]);
    const stderr = createCapture();

    await expect(
      readMaskedPassword({ input, stderr: stderr.stream }),
    ).rejects.toThrow("已取消");
    expect(input.rawModes).toEqual([true, false]);
    expect(input.paused).toBe(true);
  });

  it("rejects non-TTY password input without changing raw mode", async () => {
    const input = new FakeTty([]);
    input.isTTY = false;
    const stderr = createCapture();

    await expect(
      readMaskedPassword({ input, stderr: stderr.stream }),
    ).rejects.toThrow("该命令需要在交互式终端中运行");
    expect(input.rawModes).toEqual([]);
  });
});
