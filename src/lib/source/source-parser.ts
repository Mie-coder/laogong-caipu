export type SourcePlatform = "xiaohongshu" | "unknown" | "manual";

export type ParsedSourceInput = {
  sourcePlatform: SourcePlatform;
  sourceUrl: string;
  shareText: string;
  normalizedInput: string;
};

const URL_PATTERN = /https?:\/\/[^\s，。]+/i;
const XHS_PATTERN = /https?:\/\/xhslink\.com\/[^\s，。]+/i;

export function parseSourceInput(rawInput: string): ParsedSourceInput {
  const normalizedInput = rawInput.replace(/\r\n/g, "\n").trim();
  const xhsMatch = normalizedInput.match(XHS_PATTERN);
  const urlMatch = xhsMatch ?? normalizedInput.match(URL_PATTERN);
  const sourceUrl = urlMatch?.[0] ?? "";

  if (!sourceUrl) {
    return {
      sourcePlatform: "manual",
      sourceUrl: "",
      shareText: normalizedInput,
      normalizedInput
    };
  }

  const sourcePlatform: SourcePlatform = sourceUrl.includes("xhslink.com") ? "xiaohongshu" : "unknown";
  const beforeUrl = normalizedInput.slice(0, normalizedInput.indexOf(sourceUrl)).trim();
  const shareText = beforeUrl.replace(/复制后打开【小红书】查看笔记！/g, "").trim();

  return {
    sourcePlatform,
    sourceUrl,
    shareText,
    normalizedInput
  };
}
