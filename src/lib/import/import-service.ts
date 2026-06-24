import { parseRecipeFromContent as defaultParseRecipeFromContent } from "@/lib/ai/recipe-parser";
import { crawlUrl as defaultCrawlUrl, CrawlResult } from "@/lib/crawler/crawler";
import { ImportInput, RecipeDraft } from "@/lib/domain/recipe";
import { parseSourceInput, ParsedSourceInput } from "@/lib/source/source-parser";

export type ImportParseResult = {
  source: ParsedSourceInput;
  crawlStatus: "skipped" | "success" | "failed";
  crawlError: string;
  finalUrl: string;
  recipe: RecipeDraft;
  imageUrls: string[];
  needsSupplement: boolean;
};

export type ImportServiceDeps = {
  crawlUrl?: (sourceUrl: string) => Promise<CrawlResult>;
  parseRecipeFromContent?: typeof defaultParseRecipeFromContent;
};

export async function parseImport(input: ImportInput, deps: ImportServiceDeps = {}): Promise<ImportParseResult> {
  const source = parseSourceInput(input.rawInput);
  const crawlUrl = deps.crawlUrl ?? defaultCrawlUrl;
  const parseRecipeFromContent = deps.parseRecipeFromContent ?? defaultParseRecipeFromContent;

  let crawlStatus: ImportParseResult["crawlStatus"] = source.sourceUrl ? "failed" : "skipped";
  let crawlError = "";
  let finalUrl = source.sourceUrl;
  let crawledTitle = "";
  let crawledText = "";
  let crawledImageUrls: string[] = [];

  if (source.sourceUrl) {
    const crawlResult = await crawlUrl(source.sourceUrl);
    if (crawlResult.ok) {
      crawlStatus = "success";
      finalUrl = crawlResult.finalUrl;
      crawledTitle = crawlResult.title;
      crawledText = [crawlResult.description, crawlResult.text].filter(Boolean).join("\n");
      crawledImageUrls = crawlResult.imageUrls;
    } else {
      crawlStatus = "failed";
      crawlError = crawlResult.errorMessage;
    }
  }

  const recipe = await parseRecipeFromContent({
    sourcePlatform: source.sourcePlatform,
    sourceUrl: source.sourceUrl,
    shareText: source.shareText,
    crawledTitle,
    crawledText,
    crawledImageUrls,
    manualSupplement: input.manualSupplement ?? ""
  });

  return {
    source,
    crawlStatus,
    crawlError,
    finalUrl,
    recipe,
    imageUrls: crawledImageUrls,
    needsSupplement: (recipe.confidence ?? 0) < 0.65 || recipe.missingFields.length > 0 || crawlStatus === "failed"
  };
}
