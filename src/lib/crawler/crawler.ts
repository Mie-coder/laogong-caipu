export type CrawlFailureCode = "invalid_url" | "network_error" | "http_error" | "empty_content";

export type CrawlSuccess = {
  ok: true;
  finalUrl: string;
  title: string;
  description: string;
  text: string;
  imageUrls: string[];
  rawHtml: string;
};

export type CrawlFailure = {
  ok: false;
  errorCode: CrawlFailureCode;
  errorMessage: string;
};

export type CrawlResult = CrawlSuccess | CrawlFailure;

export async function crawlUrl(sourceUrl: string, fetcher: typeof fetch = fetch): Promise<CrawlResult> {
  if (!sourceUrl) {
    return { ok: false, errorCode: "invalid_url", errorMessage: "缺少可抓取的链接" };
  }

  try {
    const response = await fetcher(sourceUrl, {
      redirect: "follow",
      headers: {
        "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
        accept: "text/html,application/xhtml+xml"
      }
    });

    if (!response.ok) {
      return { ok: false, errorCode: "http_error", errorMessage: `HTTP ${response.status}` };
    }

    const rawHtml = await response.text();
    const title = extractFirst(rawHtml, /<title[^>]*>(.*?)<\/title>/is);
    const description =
      extractMeta(rawHtml, "description") || extractMeta(rawHtml, "og:description") || "";
    const imageUrls = [...new Set([extractMeta(rawHtml, "og:image"), ...extractImages(rawHtml)].filter(Boolean))];
    const text = htmlToText(rawHtml);

    if (!title && !description && text.length < 20) {
      return { ok: false, errorCode: "empty_content", errorMessage: "页面内容为空或需要登录" };
    }

    return {
      ok: true,
      finalUrl: response.url || sourceUrl,
      title,
      description,
      text,
      imageUrls,
      rawHtml
    };
  } catch (error) {
    return {
      ok: false,
      errorCode: "network_error",
      errorMessage: error instanceof Error ? error.message : "网络请求失败"
    };
  }
}

function extractFirst(html: string, pattern: RegExp): string {
  return decodeHtml(html.match(pattern)?.[1]?.trim() ?? "");
}

function extractMeta(html: string, name: string): string {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`<meta[^>]+name=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+property=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${escaped}["'][^>]*>`, "i")
  ];
  for (const pattern of patterns) {
    const value = html.match(pattern)?.[1];
    if (value) return decodeHtml(value.trim());
  }
  return "";
}

function extractImages(html: string): string[] {
  return Array.from(html.matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi))
    .map((match) => match[1])
    .filter((src) => src.startsWith("http"));
}

function htmlToText(html: string): string {
  return decodeHtml(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function decodeHtml(value: string): string {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'");
}
