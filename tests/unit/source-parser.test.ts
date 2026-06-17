import { describe, expect, it } from "vitest";
import { parseSourceInput } from "@/lib/source/source-parser";

describe("parseSourceInput", () => {
  it("extracts Xiaohongshu short link and share text", () => {
    const input = "5分钟就可以搞定！超级下饭的丝瓜炒蛋 丝瓜炒蛋可以算... http://xhslink.com/o/smiaxnsR3c \n复制后打开【小红书】查看笔记！";

    const result = parseSourceInput(input);

    expect(result.sourcePlatform).toBe("xiaohongshu");
    expect(result.sourceUrl).toBe("http://xhslink.com/o/smiaxnsR3c");
    expect(result.shareText).toBe("5分钟就可以搞定！超级下饭的丝瓜炒蛋 丝瓜炒蛋可以算...");
    expect(result.normalizedInput).toContain("丝瓜炒蛋");
  });

  it("supports a generic URL when the platform is unknown", () => {
    const result = parseSourceInput("https://example.com/recipe");

    expect(result.sourcePlatform).toBe("unknown");
    expect(result.sourceUrl).toBe("https://example.com/recipe");
    expect(result.shareText).toBe("");
  });

  it("returns empty URL and preserved text when no URL exists", () => {
    const result = parseSourceInput("只有正文，没有链接");

    expect(result.sourcePlatform).toBe("manual");
    expect(result.sourceUrl).toBe("");
    expect(result.shareText).toBe("只有正文，没有链接");
  });
});
