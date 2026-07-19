const { expect, test } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");

test.describe.configure({ mode: "serial" });

const LONG_NAME = "番茄牛腩炖得软烂入味又暖胃的家庭招牌菜";
const LONG_AMOUNT = "约 8888 克（切成非常非常细的小块备用）";
const LONG_STEP = "先把番茄慢慢炒出浓郁汤汁，再加入焯过水的牛腩小火炖煮，期间耐心翻动并观察汤汁，直到每一块牛腩都软烂入味且不会粘锅。";
const SHARE_TEXT = "家庭招牌番茄牛腩 https://xhslink.com/o/deterministic 复制后打开小红书";
const SCREENSHOT_NAMES = [
  "01-home-nav.png",
  "02-recipe-list.png",
  "03-import-sheet.png",
  "04-parsing-progress.png",
  "05-image-review.png",
  "06-recipe-confirm.png",
  "07-recipe-detail.png",
  "08-cooking-guide.png",
  "09-cooking-mode.png",
  "10-recipe-review-sheet.png"
];

function projectWidth(testInfo) {
  return String(testInfo.project.use.viewport.width);
}

test.beforeAll(async ({}, workerInfo) => {
  fs.rmSync(path.resolve("output", "playwright-stitch-v3", projectWidth(workerInfo)), { recursive: true, force: true });
});

function imageData(label, color) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="720"><rect width="720" height="720" fill="${color}"/><circle cx="360" cy="330" r="210" fill="#fff9f5"/><text x="360" y="360" text-anchor="middle" font-size="64" fill="#2e2725">${label}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const IMAGE_URLS = [
  imageData("成品", "#d97757"),
  imageData("备料", "#87986a"),
  imageData("炖煮", "#d5a253")
];

function makeDraft(suffix = "") {
  return {
    name: `${LONG_NAME}${suffix}`,
    mainCategory: "家常菜",
    tags: ["下饭", "炖菜"],
    ingredients: [
      { name: "牛腩", amount: LONG_AMOUNT, type: "ingredient" },
      { name: "番茄", amount: "4 个", type: "ingredient" }
    ],
    seasonings: [{ name: "盐", amount: "适量", type: "seasoning" }],
    steps: [
      { order: 1, text: LONG_STEP, imageUrl: null },
      { order: 2, text: "加入热水后继续炖煮，出锅前调味。", imageUrl: null }
    ],
    cookTimeMinutes: 90,
    difficulty: "medium",
    tips: "盐最后再放，牛腩会更容易炖软。",
    confidence: 0.98,
    missingFields: [],
    sourcePlatform: "xiaohongshu",
    sourceUrl: "https://xhslink.com/o/deterministic",
    originalTitle: LONG_NAME,
    shareText: SHARE_TEXT,
    coverImageUrl: null,
    imageUrls: []
  };
}

async function stubImport(page, options = {}) {
  let parseCalls = 0;
  let filterCalls = 0;
  let releaseParse;
  const parseGate = options.gateParse ? new Promise((resolve) => { releaseParse = resolve; }) : null;
  await page.route("**/api/import/parse", async (route) => {
    parseCalls += 1;
    if (options.rejectParse && parseCalls === 1) {
      await route.fulfill({ status: 422, contentType: "application/json", body: JSON.stringify({ error: "分享内容无法解析，请补充正文" }) });
      return;
    }
    if (parseGate) await parseGate;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ recipe: makeDraft(options.suffix || ""), imageUrls: IMAGE_URLS, needsSupplement: false, crawlStatus: "ok", crawlError: "" })
    });
  });
  await page.route("**/api/images/filter", async (route) => {
    filterCalls += 1;
    if (options.delayFilter) await new Promise((resolve) => setTimeout(resolve, 350));
    if (options.failFilter) {
      await route.abort("failed");
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ imageUrls: IMAGE_URLS }) });
  });
  return { parseCalls: () => parseCalls, filterCalls: () => filterCalls, releaseParse: () => releaseParse?.() };
}

async function screenshot(page, testInfo, filename) {
  const directory = path.resolve("output", "playwright-stitch-v3", projectWidth(testInfo));
  fs.mkdirSync(directory, { recursive: true });
  await page.screenshot({
    path: path.join(directory, filename),
    animations: filename === "05-image-review.png" ? "allow" : "disabled"
  });
}

async function waitForVisibleImages(page) {
  const images = page.locator("img:visible");
  await expect.poll(() => images.evaluateAll(async (elements) => {
    if (elements.length === 0) return true;
    await Promise.all(elements.map(async (image) => {
      if (typeof image.decode === "function") {
        await image.decode().catch(() => undefined);
      }
    }));
    return elements.every((image) => image.complete && image.naturalWidth > 0);
  })).toBe(true);
}

async function assertWrappedWithoutClipping(locator, label) {
  const metrics = await locator.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      lineHeight: Number.parseFloat(style.lineHeight),
      whiteSpace: style.whiteSpace,
      overflowX: style.overflowX,
      overflowY: style.overflowY,
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight
    };
  });
  expect(metrics.whiteSpace, `${label}: ${JSON.stringify(metrics)}`).not.toBe("nowrap");
  expect(metrics.scrollWidth, `${label}: ${JSON.stringify(metrics)}`).toBeLessThanOrEqual(metrics.clientWidth + 1);
  expect(metrics.scrollHeight, `${label}: ${JSON.stringify(metrics)}`).toBeLessThanOrEqual(metrics.clientHeight + 2);
  expect(metrics.clientHeight, `${label}: ${JSON.stringify(metrics)}`).toBeGreaterThanOrEqual(metrics.lineHeight * 1.8);
  expect(["hidden", "clip"], `${label}: ${JSON.stringify(metrics)}`).not.toContain(metrics.overflowY);
}

async function assertNoHorizontalOverflow(page) {
  const metrics = await page.evaluate(() => {
    const offenders = [...document.querySelectorAll("body *")]
      .map((element) => ({
        tag: element.tagName,
        label: element.getAttribute("aria-label") || element.textContent?.trim().slice(0, 40) || "",
        right: Math.round(element.getBoundingClientRect().right)
      }))
      .filter((item) => item.right > window.innerWidth + 1)
      .sort((a, b) => b.right - a.right)
      .slice(0, 5);
    return { scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth, offenders };
  });
  expect(metrics.scrollWidth, JSON.stringify(metrics)).toBeLessThanOrEqual(metrics.innerWidth);
}

async function assertLastContentClearsFixedUi(page) {
  const metrics = await page.evaluate(() => {
    const fixed = [...document.querySelectorAll("body *")].filter((element) => getComputedStyle(element).position === "fixed" && element.getBoundingClientRect().height > 0);
    const bottomBar = fixed.sort((a, b) => b.getBoundingClientRect().top - a.getBoundingClientRect().top)[0];
    const hasFixedAncestor = (element) => {
      for (let current = element; current; current = current.parentElement) {
        if (getComputedStyle(current).position === "fixed") return true;
      }
      return false;
    };
    const content = [...document.querySelectorAll("button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), h1, h2, h3, p, li, img")]
      .filter((element) => element.getClientRects().length > 0 && !hasFixedAncestor(element))
      .sort((a, b) => (a.getBoundingClientRect().bottom + window.scrollY) - (b.getBoundingClientRect().bottom + window.scrollY));
    const last = content[content.length - 1];
    if (!bottomBar || !last) return { valid: false, reason: "missing fixed bar or scrolling content" };
    window.scrollTo(0, document.documentElement.scrollHeight);
    return {
      valid: last.getBoundingClientRect().bottom <= bottomBar.getBoundingClientRect().top,
      contentBottom: Math.round(last.getBoundingClientRect().bottom),
      barTop: Math.round(bottomBar.getBoundingClientRect().top),
      content: last.getAttribute("aria-label") || last.textContent?.trim().slice(0, 60) || last.tagName
    };
  });
  expect(metrics.valid, JSON.stringify(metrics)).toBe(true);
}

async function assertCookingStepsClearFooter(page) {
  const metrics = await page.evaluate(() => {
    const steps = document.querySelectorAll(".cooking-steps li");
    const lastStep = steps[steps.length - 1];
    const footer = document.querySelector(".cooking-mode-footer");
    if (!lastStep || !footer) return { valid: false, reason: "missing cooking steps or footer" };
    window.scrollTo(0, document.documentElement.scrollHeight);
    const lastRect = lastStep.getBoundingClientRect();
    const footerRect = footer.getBoundingClientRect();
    return {
      valid: lastRect.bottom <= footerRect.top + 1 && footerRect.bottom <= window.innerHeight + 1,
      lastBottom: Math.round(lastRect.bottom),
      footerTop: Math.round(footerRect.top),
      footerBottom: Math.round(footerRect.bottom),
      viewportBottom: window.innerHeight
    };
  });
  expect(metrics.valid, JSON.stringify(metrics)).toBe(true);
}

async function assertCookingContentGeometry(page) {
  const metrics = await page.evaluate(() => {
    const steps = [...document.querySelectorAll(".cooking-steps li")];
    const stepValid = steps.every((step, index) => {
      const copy = step.querySelector("p");
      const next = steps[index + 1];
      return Boolean(copy) && copy.getBoundingClientRect().bottom <= step.getBoundingClientRect().bottom + 1 && (!next || next.getBoundingClientRect().top + 1 >= step.getBoundingClientRect().bottom);
    });
    const ingredientValid = [...document.querySelectorAll(".cooking-ingredient")].every((button) => {
      const buttonRect = button.getBoundingClientRect();
      return [...button.querySelectorAll(".cooking-ingredient-avatar, strong, small")].every((child) => {
        const rect = child.getBoundingClientRect();
        return rect.left >= buttonRect.left - 1 && rect.right <= buttonRect.right + 1 && rect.top >= buttonRect.top - 1 && rect.bottom <= buttonRect.bottom + 1;
      });
    });
    return { valid: stepValid && ingredientValid, stepValid, ingredientValid };
  });
  expect(metrics.valid, JSON.stringify(metrics)).toBe(true);
}

async function assertReviewDrawerLayout(page) {
  const metrics = await page.evaluate(() => {
    const drawer = document.querySelector('[data-testid="review-drawer"]');
    const footer = document.querySelector(".cook-review-footer");
    const form = document.querySelector(".cook-review-form");
    if (!drawer || !footer || !form) return { valid: false, reason: "missing review drawer layout" };
    form.scrollTo(0, form.scrollHeight);
    const drawerRect = drawer.getBoundingClientRect();
    const footerRect = footer.getBoundingClientRect();
    const last = form.lastElementChild;
    const lastRect = last?.getBoundingClientRect();
    return {
      valid: Boolean(lastRect) && drawerRect.bottom <= window.innerHeight + 1 && footerRect.bottom <= drawerRect.bottom + 1 && lastRect.bottom <= footerRect.top + 1,
      drawerBottom: Math.round(drawerRect.bottom),
      footerTop: Math.round(footerRect.top),
      footerBottom: Math.round(footerRect.bottom),
      lastBottom: lastRect ? Math.round(lastRect.bottom) : null,
      viewportBottom: window.innerHeight
    };
  });
  expect(metrics.valid, JSON.stringify(metrics)).toBe(true);
}

async function seedRecipe(request, suffix, cooked = false, mainCategory = "家常菜") {
  const response = await request.post("/api/recipes", { data: { ...makeDraft(suffix), mainCategory } });
  expect(response.ok()).toBeTruthy();
  const saved = await response.json();
  if (cooked) {
    const cookedResponse = await request.post(`/api/recipes/${saved.id}/cook`, {
      data: { wifeRating: 4, wifeFeedback: "很下饭", husbandImprovementNotes: "少放盐", notes: "小火" }
    });
    expect(cookedResponse.ok()).toBeTruthy();
  }
  return saved.id;
}

test("imports, favorites, cooks, and reviews with ten Stitch V3 screenshots", async ({ page, request }, testInfo) => {
  test.setTimeout(180_000);
  await request.get("/recipes/0");
  await request.get("/recipes/0/cook");
  await page.addInitScript(() => {
    window.__speechCalls = { cancel: 0, spoken: [] };
    class StubUtterance {
      constructor(text) { this.text = text; this.lang = ""; this.onstart = null; this.onend = null; this.onerror = null; }
    }
    Object.defineProperty(window, "SpeechSynthesisUtterance", { configurable: true, value: StubUtterance });
    Object.defineProperty(window, "speechSynthesis", { configurable: true, value: { cancel: () => { window.__speechCalls.cancel += 1; }, speak: (utterance) => { window.__speechCalls.spoken.push({ text: utterance.text, lang: utterance.lang }); utterance.onstart?.(); utterance.onend?.(); } } });
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("https://images.unsplash.com/**", (route) => route.fulfill({
    status: 200,
    contentType: "image/svg+xml",
    body: decodeURIComponent(IMAGE_URLS[0].split(",")[1])
  }));
  const calls = await stubImport(page, { gateParse: true, delayFilter: true, suffix: `-${projectWidth(testInfo)}` });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "老公菜谱" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "底部导航" }).getByRole("link")).toHaveCount(2);
  await expect(page.getByRole("link", { name: "导入" })).toHaveAttribute("aria-current", "page");
  await waitForVisibleImages(page);
  await assertNoHorizontalOverflow(page);
  await screenshot(page, testInfo, "01-home-nav.png");

  await page.getByRole("button", { name: "导入新菜谱" }).click();
  const parseButton = page.getByRole("button", { name: "开始解析", exact: true });
  await expect(parseButton).toBeDisabled();
  await page.getByRole("textbox", { name: "分享文本" }).fill(SHARE_TEXT);
  await expect(parseButton).toBeEnabled();
  await screenshot(page, testInfo, "03-import-sheet.png");

  await parseButton.click();
  await expect(page.getByRole("heading", { name: "正在解析", exact: true })).toBeVisible();
  for (const label of ["识别分享内容", "读取菜谱正文", "整理食材和步骤", "筛选菜谱图片"]) {
    await expect(page.getByText(label, { exact: true })).toBeVisible();
  }
  await screenshot(page, testInfo, "04-parsing-progress.png");
  calls.releaseParse();

  await expect(page.getByRole("heading", { name: "审核图片", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /取消选择第 .* 张图片/ })).toHaveCount(3);
  await expect(page.getByRole("button", { name: "关闭大图" })).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(true);
  const reviewImages = page.locator('img[alt^="图片"]');
  await expect.poll(() => reviewImages.evaluateAll((images) => images.every((image) => image.complete && image.naturalWidth > 0))).toBe(true);
  await screenshot(page, testInfo, "05-image-review.png");

  await page.getByRole("button", { name: /确认图片（3）/ }).click();
  await expect(page.getByRole("heading", { name: "确认菜谱" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "菜名" })).toHaveValue(new RegExp(`-${projectWidth(testInfo)}$`));
  await assertNoHorizontalOverflow(page);
  await screenshot(page, testInfo, "06-recipe-confirm.png");

  await page.getByRole("button", { name: "保存菜谱" }).click();
  await expect(page).toHaveURL(/\/recipes\/\d+$/);
  await page.reload();
  await expect(page.getByRole("heading", { name: new RegExp(LONG_NAME) })).toBeVisible();
  await expect(page.getByText(LONG_AMOUNT, { exact: true })).toBeVisible();
  await assertWrappedWithoutClipping(page.getByText(LONG_AMOUNT, { exact: true }), "long ingredient amount");
  await page.getByRole("tab", { name: "步骤" }).click();
  await expect(page.getByText(LONG_STEP, { exact: true })).toBeVisible();
  await assertWrappedWithoutClipping(page.getByRole("heading", { name: new RegExp(LONG_NAME) }), "long recipe name");
  await assertWrappedWithoutClipping(page.getByText(LONG_STEP, { exact: true }), "long recipe step");
  await assertNoHorizontalOverflow(page);
  await screenshot(page, testInfo, "07-recipe-detail.png");
  const favorite = page.getByRole("button", { name: new RegExp(`收藏菜谱 .*-${projectWidth(testInfo)}`) });
  const favoriteSaved = page.waitForResponse((response) => response.request().method() === "PATCH" && /\/api\/recipes\/\d+\/favorite$/.test(new URL(response.url()).pathname) && response.ok());
  await favorite.click();
  await favoriteSaved;
  await expect(page.getByRole("button", { name: new RegExp(`取消收藏菜谱 .*-${projectWidth(testInfo)}`) })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: new RegExp(`取消收藏菜谱 .*-${projectWidth(testInfo)}`) })).toBeVisible();
  await page.getByRole("button", { name: "返回菜谱列表" }).click();
  await expect(page.getByRole("heading", { name: "我的菜谱" })).toBeVisible();
  await expect(page.getByRole("link", { name: "菜谱", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("button", { name: new RegExp(`查看菜谱 .*-${projectWidth(testInfo)}`) })).toBeVisible();
  await waitForVisibleImages(page);
  await expect(page.getByRole("button", { name: new RegExp(`取消收藏菜谱 .*-${projectWidth(testInfo)}`) })).toBeVisible();
  await screenshot(page, testInfo, "02-recipe-list.png");

  await page.getByRole("button", { name: new RegExp(`查看菜谱 .*-${projectWidth(testInfo)}`) }).click();
  await expect(page.getByRole("heading", { name: new RegExp(LONG_NAME) })).toBeVisible();
  await waitForVisibleImages(page);
  await page.getByRole("button", { name: "开始做菜" }).click();
  await expect(page.getByRole("heading", { name: /准备好了吗？/ })).toBeVisible();
  await assertNoHorizontalOverflow(page);
  await screenshot(page, testInfo, "08-cooking-guide.png");
  await page.getByRole("button", { name: "进入第 1 步" }).click();
  await expect(page).toHaveURL(/\/recipes\/\d+\/cook$/);
  await expect(page.getByRole("heading", { name: new RegExp(LONG_NAME) })).toBeVisible();
  await expect(page.getByRole("button", { name: new RegExp(`取消收藏菜谱 .*-${projectWidth(testInfo)}`) })).toBeVisible();
  await assertNoHorizontalOverflow(page);
  await assertCookingContentGeometry(page);
  await assertCookingStepsClearFooter(page);
  await page.getByRole("button", { name: "开始计时" }).click();
  await expect(page.getByRole("button", { name: "暂停计时" })).toBeVisible();
  await page.getByRole("button", { name: "暂停计时" }).click();
  await page.getByRole("button", { name: "继续计时" }).click();
  await page.getByRole("button", { name: "结束计时" }).click();
  const firstStep = page.getByRole("checkbox", { name: /完成第 1 步/ });
  await firstStep.click();
  await expect(firstStep).toHaveAttribute("data-state", "checked");
  await firstStep.click();
  await expect(firstStep).toHaveAttribute("data-state", "unchecked");
  await firstStep.click();
  await page.getByRole("button", { name: "开启语音播报" }).click();
  await page.getByRole("button", { name: "播报第 1 步" }).click();
  expect(await page.evaluate(() => window.__speechCalls.spoken.at(-1))).toMatchObject({ lang: "zh-CN", text: LONG_STEP });
  const cancelBeforeStepChange = await page.evaluate(() => window.__speechCalls.cancel);
  await page.getByRole("button", { name: "加入热水后继续炖煮，出锅前调味。" }).click();
  await expect.poll(() => page.evaluate(() => window.__speechCalls.cancel)).toBeGreaterThan(cancelBeforeStepChange);
  await page.getByRole("checkbox", { name: /完成第 2 步/ }).click();
  await assertNoHorizontalOverflow(page);
  await assertCookingContentGeometry(page);
  await assertCookingStepsClearFooter(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  await screenshot(page, testInfo, "09-cooking-mode.png");
  await assertCookingStepsClearFooter(page);
  await page.getByRole("button", { name: "完成做菜" }).click();
  const saveReview = page.getByRole("button", { name: "保存复盘" });
  await expect(saveReview).toBeDisabled();
  await page.getByRole("button", { name: "5 星，超好吃" }).click();
  await page.getByRole("textbox", { name: "老婆评价" }).fill("牛腩软烂，汤汁特别下饭");
  await page.getByRole("textbox", { name: "下次改进" }).fill("番茄再多放一个");
  const starButtons = page.getByRole("dialog").getByRole("button", { name: /星，/ });
  await expect(starButtons).toHaveCount(5);
  await expect(starButtons.locator("svg")).toHaveCount(5);
  await expect(page.getByRole("dialog")).not.toContainText("🎉");
  await assertNoHorizontalOverflow(page);
  await page.locator(".cook-review-form").evaluate((element) => { element.scrollTop = 0; });
  await page.mouse.move(1, 1);
  await screenshot(page, testInfo, "10-recipe-review-sheet.png");
  await assertReviewDrawerLayout(page);
  const screenshotDirectory = path.resolve("output", "playwright-stitch-v3", projectWidth(testInfo));
  expect(fs.readdirSync(screenshotDirectory).filter((name) => name.endsWith(".png")).sort()).toEqual(SCREENSHOT_NAMES);
  const reviewSaved = page.waitForResponse((response) => response.request().method() === "POST" && /\/api\/recipes\/\d+\/cook$/.test(new URL(response.url()).pathname) && response.ok());
  await saveReview.click();
  await reviewSaved;
  await page.getByRole("button", { name: "返回菜谱详情" }).click();
  await expect(page).toHaveURL(/\/recipes\/\d+$/);
  await expect(page.getByText(/做过 1 次/)).toBeVisible();
  await expect(page.getByText("老婆评分 5.0")).toBeVisible();
  expect(calls.parseCalls()).toBe(1);
  expect(calls.filterCalls()).toBe(1);
  await assertLastContentClearsFixedUi(page);
});

test("list filters and management survive detail navigation and restore scroll after remount", async ({ page, request }, testInfo) => {
  const suffix = `-返回-${projectWidth(testInfo)}`;
  await seedRecipe(request, `${suffix}-甲`, true);
  await seedRecipe(request, `${suffix}-乙`, false);
  await seedRecipe(request, `${suffix}-丙`, false);
  const foreignName = `${LONG_NAME}${suffix}-异类`;
  await seedRecipe(request, `${suffix}-异类`, false, "异国料理");
  await page.goto("/recipes");
  await expect(page.getByRole("heading", { name: "我的菜谱" })).toBeVisible();
  await page.getByRole("button", { name: "搜索" }).click();
  await page.getByRole("button", { name: "筛选" }).click();
  await expect(page.getByRole("dialog", { name: "筛选菜谱" })).toBeVisible();
  const categoryReload = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return response.request().method() === "GET" &&
      url.pathname === "/api/recipes" &&
      url.searchParams.get("category") === "家常菜" &&
      response.ok();
  });
  await page.getByRole("button", { name: "分类 家常菜" }).click();
  await categoryReload;
  await expect(page.getByRole("button", { name: `查看菜谱 ${foreignName}` })).toHaveCount(0);
  await expect(page.getByRole("button", { name: new RegExp(`查看菜谱 .*${suffix}-甲`) })).toBeVisible();
  await page.getByRole("button", { name: "更多" }).click();
  await page.getByRole("menuitem", { name: "管理菜谱" }).click();
  await expect(page.getByRole("button", { name: "删除已选" })).toBeDisabled();
  const disposableName = `${LONG_NAME}${suffix}-丙`;
  await page.getByRole("button", { name: `选择菜谱 ${disposableName}` }).click();
  const deleteSelected = page.getByRole("button", { name: "删除已选" });
  await expect(deleteSelected).toBeEnabled();
  await deleteSelected.focus();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "删除", exact: true }).click();
  await expect(page.getByRole("button", { name: `查看菜谱 ${disposableName}` })).toHaveCount(0);
  const unfilteredReload = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return response.request().method() === "GET" &&
      url.pathname === "/api/recipes" &&
      url.search === "" &&
      response.ok();
  });
  await page.getByRole("button", { name: "全部", exact: true }).click();
  await unfilteredReload;
  const targetRecipe = page.getByRole("button", { name: new RegExp(`查看菜谱 .*${suffix}-`) }).last();
  await expect(targetRecipe).toBeVisible();
  await expect(page.locator(".animate-pulse")).toHaveCount(0);
  await page.evaluate(() => window.scrollTo(0, Math.min(500, document.documentElement.scrollHeight - innerHeight)));
  await targetRecipe.evaluate((element) => element.scrollIntoView({ block: "center" }));
  const before = await page.evaluate(() => window.scrollY);
  expect(before).toBeGreaterThan(50);
  await targetRecipe.evaluate((element) => element.click());
  await expect(page).toHaveURL(/\/recipes\/\d+$/);
  await page.goBack();
  await expect(page.getByRole("heading", { name: "我的菜谱" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThanOrEqual(Math.max(0, before - 2));
  await assertNoHorizontalOverflow(page);
  await assertLastContentClearsFixedUi(page);
});

test("keeps input on parse rejection and uses image-filter fallback without reparsing on back", async ({ page }, testInfo) => {
  const calls = await stubImport(page, { rejectParse: true, failFilter: true, suffix: `-fallback-${projectWidth(testInfo)}` });
  await page.goto("/");
  await page.getByRole("button", { name: "导入新菜谱" }).click();
  await page.getByRole("textbox", { name: "分享文本" }).fill(SHARE_TEXT);
  await page.getByRole("button", { name: "开始解析", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "导入菜谱" })).toBeVisible();
  await expect(page.getByText("分享内容无法解析，请补充正文")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "分享文本" })).toHaveValue(SHARE_TEXT);

  await page.getByRole("button", { name: "开始解析", exact: true }).click();
  await expect(page.getByRole("heading", { name: "审核图片" })).toBeVisible();
  await expect(page.getByRole("button", { name: /取消选择第 .* 张图片/ })).toHaveCount(3);
  await expect(page.getByText(/请求失败|解析失败/)).toHaveCount(0);
  await page.getByRole("button", { name: /确认图片（3）/ }).click();
  await expect(page.getByRole("heading", { name: "确认菜谱" })).toBeVisible();
  await page.getByRole("button", { name: "返回图片审核" }).click();
  await page.getByRole("button", { name: "返回解析结果" }).click();
  await expect(page.getByRole("dialog", { name: "导入菜谱" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "分享文本" })).toHaveValue(SHARE_TEXT);
  await expect(page.getByText("解析完成", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "继续审核图片" }).click();
  await expect(page.getByRole("heading", { name: "审核图片" })).toBeVisible();
  expect(calls.parseCalls()).toBe(2);
  expect(calls.filterCalls()).toBe(1);
  await assertNoHorizontalOverflow(page);
});

test("matches the Stitch V3 structural visual contract", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("navigation", { name: "底部导航" }).getByRole("link")).toHaveCount(2);
  const contract = await page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    const hero = document.querySelector("h1");
    const nav = document.querySelector("nav");
    return {
      background: root.getPropertyValue("--color-bg").trim().toLowerCase(),
      ink: root.getPropertyValue("--color-ink").trim().toLowerCase(),
      line: root.getPropertyValue("--color-line").trim().toLowerCase(),
      heroWeight: getComputedStyle(hero).fontWeight,
      navBlur: getComputedStyle(nav).backdropFilter,
      glassCards: document.querySelectorAll(".glass-card, .backdrop-blur-xl").length,
      confetti: document.body.textContent.includes("🎉")
    };
  });
  expect(contract).toMatchObject({ background: "hsl(40 33% 97%)", ink: "hsl(60 3% 12%)", line: "hsl(40 13% 90%)", navBlur: "blur(20px)", glassCards: 0, confetti: false });
  expect(Number(contract.heroWeight)).toBe(400);
  await assertNoHorizontalOverflow(page);
});
