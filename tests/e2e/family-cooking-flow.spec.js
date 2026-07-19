const { expect, test } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");

const PASSWORD = "family-e2e-password";
const IMAGE_URL = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3Crect width='24' height='24' fill='%2387986a'/%3E%3C/svg%3E";

function familyRecipe() {
  return {
    name: "家庭验收排骨",
    mainCategory: "家常菜",
    tags: ["家庭验收"],
    ingredients: [
      { name: "排骨", amount: "500 克", type: "ingredient" },
      { name: "姜", amount: "3 片", type: "ingredient" },
      { name: "白芝麻", amount: "适量", type: "ingredient" },
    ],
    seasonings: [],
    steps: [{ order: 1, text: "将排骨焯水后与姜一同炖煮，出锅撒白芝麻。", imageUrl: null }],
    cookTimeMinutes: 45,
    difficulty: "easy",
    tips: "全程使用验收测试数据。",
    confidence: 1,
    missingFields: [],
    sourcePlatform: "acceptance",
    sourceUrl: "",
    originalTitle: "家庭验收排骨",
    shareText: "",
    coverImageUrl: null,
    imageUrls: [],
  };
}

async function assertNoHorizontalOverflow(page) {
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(metrics.scrollWidth, JSON.stringify(metrics)).toBeLessThanOrEqual(metrics.innerWidth);
}

function pathWithQuery(page) {
  const current = new URL(page.url());
  return `${current.pathname}${current.search}`;
}

function sameOriginUrl(page, pathname) {
  return new URL(pathname, page.url()).toString();
}

test("family unlock, ingredient loading, cooking controls, and logout remain protected", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/recipes");
  await expect.poll(() => pathWithQuery(page)).toBe("/unlock?next=%2Frecipes");

  await page.getByLabel("家庭密码").fill(PASSWORD);
  const loginResponse = page.waitForResponse(
    (response) => new URL(response.url()).pathname === "/api/auth/login" && response.request().method() === "POST",
    { timeout: 30_000 },
  );
  await page.getByRole("button", { name: "进入老公菜谱" }).click();
  expect((await loginResponse).status()).toBe(200);
  await expect.poll(() => pathWithQuery(page)).toBe("/recipes");

  const saved = await page.evaluate(async (draft) => {
    const response = await fetch("/api/recipes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    if (!response.ok) throw new Error(`recipe seed failed: ${response.status}`);
    return response.json();
  }, familyRecipe());
  expect(saved.id).toEqual(expect.any(Number));

  let releaseImages;
  const imagesHeld = new Promise((resolve) => { releaseImages = resolve; });
  await page.route("**/api/recipes/*/ingredient-images", async (route) => {
    expect(route.request().method()).toBe("POST");
    await imagesHeld;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ key: "a".repeat(64), imageUrl: IMAGE_URL }),
    });
  });

  await page.goto(sameOriginUrl(page, `/recipes/${saved.id}/cook`));
  const firstAvatar = page.locator(".cooking-ingredient-avatar").first();
  await expect(firstAvatar).toHaveAttribute("aria-busy", "true");
  await expect(page.locator(".cooking-ingredient-skeleton").first()).toBeVisible();
  await assertNoHorizontalOverflow(page);

  releaseImages();
  const generatedImage = page.getByTestId("ingredient-image-ingredient-0");
  await expect(generatedImage).toBeVisible();
  await expect.poll(() => generatedImage.evaluate((image) => image.complete && image.naturalWidth > 0)).toBe(true);
  await expect(firstAvatar).toHaveAttribute("aria-busy", "false");

  const ingredientButtons = page.locator(".cooking-ingredient");
  await expect(ingredientButtons).toHaveCount(3);
  await page.getByRole("button", { name: "全部勾选" }).click();
  await expect.poll(() => ingredientButtons.evaluateAll((buttons) => buttons.map((button) => button.getAttribute("aria-pressed")))).toEqual(["true", "true", "true"]);
  await page.getByRole("button", { name: "取消全选" }).click();
  await expect.poll(() => ingredientButtons.evaluateAll((buttons) => buttons.map((button) => button.getAttribute("aria-pressed")))).toEqual(["false", "false", "false"]);

  const screenshotPath = path.resolve("output/playwright-family-sharing/390/family-cooking.png");
  fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });
  await page.screenshot({ path: screenshotPath, animations: "disabled" });

  await page.goto(sameOriginUrl(page, "/"));
  await page.getByRole("button", { name: "家庭菜单" }).click();
  await page.getByRole("menuitem", { name: "退出家庭" }).click();
  await expect.poll(() => pathWithQuery(page)).toBe("/unlock");
  await page.goto(sameOriginUrl(page, "/recipes"));
  await expect.poll(() => pathWithQuery(page)).toBe("/unlock?next=%2Frecipes");
});
