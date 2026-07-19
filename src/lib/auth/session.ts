import { FAMILY_SESSION_TTL_SECONDS } from "@/lib/auth/constants";

type SessionPayload = { v: 1; exp: number };

const encoder = new TextEncoder();

function encodeBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64Url(value: string) {
  if (!value || !/^[A-Za-z0-9_-]+$/.test(value) || value.length % 4 === 1) return null;

  try {
    const base64 = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return encodeBase64Url(bytes) === value ? bytes : null;
  } catch {
    return null;
  }
}

function decodeAscii(bytes: Uint8Array) {
  let value = "";
  for (const byte of bytes) value += String.fromCharCode(byte);
  return value;
}

async function importSigningKey(secret: string) {
  return globalThis.crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function sign(encodedPayload: string, secret: string) {
  const key = await importSigningKey(secret);
  const signature = await globalThis.crypto.subtle.sign("HMAC", key, encoder.encode(encodedPayload));
  return encodeBase64Url(new Uint8Array(signature));
}

export async function createFamilySession(secret: string, nowMs = Date.now()) {
  const payload: SessionPayload = {
    v: 1,
    exp: Math.floor(nowMs / 1000) + FAMILY_SESSION_TTL_SECONDS,
  };
  const encodedPayload = encodeBase64Url(encoder.encode(JSON.stringify(payload)));
  return `${encodedPayload}.${await sign(encodedPayload, secret)}`;
}

export async function verifyFamilySession(token: string, secret: string, nowMs = Date.now()) {
  const segments = token.split(".");
  if (segments.length !== 2) return false;

  const [encodedPayload, encodedSignature] = segments;
  const payloadBytes = decodeBase64Url(encodedPayload);
  const signatureBytes = decodeBase64Url(encodedSignature);
  if (!payloadBytes || !signatureBytes) return false;

  try {
    const key = await importSigningKey(secret);
    const isAuthentic = await globalThis.crypto.subtle.verify(
      "HMAC",
      key,
      signatureBytes,
      encoder.encode(encodedPayload),
    );
    if (!isAuthentic) return false;
  } catch {
    return false;
  }

  let payload: unknown;
  try {
    payload = JSON.parse(decodeAscii(payloadBytes));
  } catch {
    return false;
  }

  if (
    typeof payload !== "object" ||
    payload === null ||
    (payload as { v?: unknown }).v !== 1 ||
    !Number.isInteger((payload as { exp?: unknown }).exp) ||
    ((payload as { exp: number }).exp <= Math.floor(nowMs / 1000))
  ) {
    return false;
  }

  return true;
}
