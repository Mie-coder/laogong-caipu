import { expect, test } from "@playwright/test";

test("mobile app renders import page", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "老公菜谱" })).toBeVisible();
  await expect(page.getByRole("button", { name: "开始抓取" })).toBeVisible();
});
