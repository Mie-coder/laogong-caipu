import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const SCRYPT_KEY_LENGTH = 64;
const SCRYPT_SALT_LENGTH = 16;
const PASSWORD_HASH_PATTERN = /^scrypt\$([A-Za-z0-9_-]+)\$([A-Za-z0-9_-]+)$/;

function derive(password: string, salt: Buffer) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, SCRYPT_KEY_LENGTH, (error, key) =>
      error ? reject(error) : resolve(key as Buffer),
    );
  });
}

function hasValidPasswordLength(password: string) {
  const length = Array.from(password).length;
  return length >= 8 && length <= 128;
}

function parseFamilyPasswordHash(encoded: string) {
  const match = PASSWORD_HASH_PATTERN.exec(encoded);
  if (!match) return null;

  try {
    const salt = Buffer.from(match[1], "base64url");
    const digest = Buffer.from(match[2], "base64url");
    if (
      salt.length !== SCRYPT_SALT_LENGTH ||
      digest.length !== SCRYPT_KEY_LENGTH ||
      salt.toString("base64url") !== match[1] ||
      digest.toString("base64url") !== match[2]
    ) {
      return null;
    }
    return { salt, digest };
  } catch {
    return null;
  }
}

export async function hashFamilyPassword(password: string, salt = randomBytes(SCRYPT_SALT_LENGTH)) {
  if (!hasValidPasswordLength(password) || salt.length !== SCRYPT_SALT_LENGTH) {
    throw new Error("家庭密码格式无效");
  }

  const digest = await derive(password, salt);
  return `scrypt$${salt.toString("base64url")}$${digest.toString("base64url")}`;
}

export async function verifyFamilyPassword(password: string, encoded: string) {
  const parsed = parseFamilyPasswordHash(encoded);
  if (!parsed || !hasValidPasswordLength(password)) return false;

  const actual = await derive(password, parsed.salt);
  return actual.length === parsed.digest.length && timingSafeEqual(actual, parsed.digest);
}
