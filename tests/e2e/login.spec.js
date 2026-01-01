const { test, expect } = require("@playwright/test");

const signIn = async (page) => {
  await page.goto("/login");

  await page.getByLabel("Email").fill("indev@test.com");
  await page.getByLabel("Password").fill("indev321");
  await page.getByRole("button", { name: "Sign in" }).click();
};

const waitForGreenIndicators = async (page) => {
  const loadedIndicators = page.locator('[aria-label$=": loaded"]');
  await expect(loadedIndicators).toHaveCount(7, { timeout: 30_000 });
};

test("sign in and test menu links", async ({ page }) => {
  await signIn(page);
  await waitForGreenIndicators(page);

  await expect(page).toHaveURL(/\/(dashboard|shared|organisation)(\?|$)/);
  await expect(page.getByRole("link", { name: "Dashboard" }).first()).toBeVisible();

  const menuLinks = [
    { name: "Dashboard", url: /\/dashboard(\?|$)/ },
    { name: "My OKRs", url: /\/okrt(\?|$)/ },
    { name: "Schedule", url: /\/calendar(\?|$)/ },
    { name: "Shared OKRs", url: /\/shared(\/|\?|$)/ },
    { name: "Business", url: /\/organisation(\?|$)/ },
    { name: "Coach", url: /\/coach(\?|$)/ },
    { name: "Notifications", url: /\/notifications(\?|$)/ },
    { name: "Members", url: /\/members(\?|$)/, optional: true },
  ];

  for (const item of menuLinks) {
    const link = page.getByRole("link", { name: item.name }).first();
    if (item.optional) {
      if (await link.count() === 0) {
        continue;
      }
    }
    await link.click();
    await expect(page).toHaveURL(item.url);
    await page.waitForTimeout(10_000);
  }
});
