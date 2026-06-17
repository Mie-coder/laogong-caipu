const { expect, test } = require("@playwright/test");

test("mobile app renders import page", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "老公菜谱" })).toBeVisible();
  await expect(page.getByRole("button", { name: "开始抓取" })).toBeVisible();
});

test("can paste Xiaohongshu text and parse recipe", async ({ page }) => {
  await page.goto("/");

  // Type the Xiaohongshu share text into the textarea
  const textarea = page.locator("textarea").first();
  await textarea.fill(
    "我去开店，这一定是招牌！！！ 只要一口就沧陷的番茄... http://xhslink.com/o/A1APQcR9Hu1 复制后打开【小红书】查看笔记！"
  );

  // Click the parse button
  await page.getByRole("button", { name: "开始抓取" }).click();

  // Wait for the recipe confirmation form to appear
  await page.waitForSelector('input[value]', { timeout: 60000 });

  // Should see the recipe name input populated
  const nameInput = page.locator('input').first();
  const value = await nameInput.inputValue();
  expect(value.length).toBeGreaterThan(0);
  console.log("Recipe name:", value);

  // Should see save button
  await expect(page.getByRole("button", { name: "保存菜谱" })).toBeVisible();
});
