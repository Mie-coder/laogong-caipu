export type FamilyAuthConfig = {
  passwordHash: string;
  sessionSecret: string;
};

const CONFIGURATION_ERROR_MESSAGE = "家庭门禁配置无效";
const PASSWORD_HASH_PATTERN = /^scrypt\$([A-Za-z0-9_-]+)\$([A-Za-z0-9_-]+)$/;

function hasValidPasswordHash(value: string | undefined): value is string {
  if (!value) return false;

  const match = PASSWORD_HASH_PATTERN.exec(value);
  if (!match) return false;

  try {
    const salt = Buffer.from(match[1], "base64url");
    const digest = Buffer.from(match[2], "base64url");
    return (
      salt.length === 16 &&
      digest.length === 64 &&
      salt.toString("base64url") === match[1] &&
      digest.toString("base64url") === match[2]
    );
  } catch {
    return false;
  }
}

export function readFamilyAuthConfig(env: NodeJS.ProcessEnv = process.env): FamilyAuthConfig {
  const passwordHash = env.FAMILY_PASSWORD_HASH;
  const sessionSecret = env.FAMILY_SESSION_SECRET;

  if (
    !hasValidPasswordHash(passwordHash) ||
    !sessionSecret ||
    Buffer.byteLength(sessionSecret, "utf8") < 32
  ) {
    throw new Error(CONFIGURATION_ERROR_MESSAGE);
  }

  return { passwordHash, sessionSecret };
}
