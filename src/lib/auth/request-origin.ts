type OriginRequest = Pick<Request, "headers" | "url">;

function firstHeaderValue(value: string) {
  return value.split(",", 1)[0].trim();
}

function urlOrigin(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.origin : null;
  } catch {
    return null;
  }
}

function proxyOrigin(protocol: string, host: string) {
  if (
    (protocol !== "http" && protocol !== "https") ||
    !host ||
    /[\s\\/@?#]/.test(host)
  ) {
    return null;
  }

  return urlOrigin(`${protocol}://${host}`);
}

export function resolvePublicRequestOrigin(request: OriginRequest) {
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const forwardedHost = request.headers.get("x-forwarded-host");

  if (forwardedProto === null && forwardedHost === null) {
    return urlOrigin(request.url);
  }
  if (forwardedProto === null) return null;

  const hostHeader = forwardedHost ?? request.headers.get("host");
  if (hostHeader === null) return null;

  return proxyOrigin(
    firstHeaderValue(forwardedProto).toLowerCase(),
    firstHeaderValue(hostHeader),
  );
}
