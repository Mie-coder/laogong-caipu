import { randomBytes, scrypt } from "node:crypto";
import { pathToFileURL } from "node:url";

const MIN_PASSWORD_LENGTH = 5;
const MAX_PASSWORD_LENGTH = 128;
const SCRYPT_SALT_LENGTH = 16;
const SCRYPT_KEY_LENGTH = 64;

function derive(password, salt) {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, SCRYPT_KEY_LENGTH, (error, key) =>
      error ? reject(error) : resolve(key),
    );
  });
}

export async function readMaskedPassword({
  input = process.stdin,
  stderr = process.stderr,
} = {}) {
  if (!input.isTTY || typeof input.setRawMode !== "function") {
    throw new Error("该命令需要在交互式终端中运行");
  }

  const previousRawMode = input.isRaw;
  let password = "";
  stderr.write("请输入家庭密码：");
  input.setEncoding("utf8");
  input.setRawMode(true);

  try {
    return await new Promise((resolve, reject) => {
      const finish = (error) => {
        input.off("data", onData);
        input.off("error", onError);
        if (error) reject(error);
        else resolve(password);
      };

      const onError = () => finish(new Error("无法读取家庭密码"));
      const onData = (chunk) => {
        for (const character of chunk) {
          if (character === "\r" || character === "\n") {
            finish();
            return;
          }
          if (character === "\u0003" || character === "\u0004") {
            finish(new Error("已取消"));
            return;
          }
          if (character === "\u007f" || character === "\b") {
            const characters = Array.from(password);
            if (characters.length > 0) {
              characters.pop();
              password = characters.join("");
              stderr.write("\b \b");
            }
            continue;
          }
          if (character.codePointAt(0) < 32) continue;

          password += character;
          stderr.write("*");
        }
      };

      input.on("error", onError);
      input.on("data", onData);
      input.resume();
    });
  } finally {
    try {
      input.setRawMode(Boolean(previousRawMode));
    } finally {
      input.pause();
      stderr.write("\n");
    }
  }
}

export async function runHashFamilyPassword({
  input = process.stdin,
  stdout = process.stdout,
  stderr = process.stderr,
} = {}) {
  const password = await readMaskedPassword({ input, stderr });
  const passwordLength = Array.from(password).length;
  if (passwordLength < MIN_PASSWORD_LENGTH || passwordLength > MAX_PASSWORD_LENGTH) {
    throw new Error("家庭密码必须为 5–128 个字符");
  }

  const salt = randomBytes(SCRYPT_SALT_LENGTH);
  const digest = await derive(password, salt);
  stdout.write(`scrypt$${salt.toString("base64url")}$${digest.toString("base64url")}\n`);
}

const entryPath = process.argv[1];
if (entryPath && import.meta.url === pathToFileURL(entryPath).href) {
  runHashFamilyPassword().catch((error) => {
    const message = error instanceof Error ? error.message : "生成家庭密码摘要失败";
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
