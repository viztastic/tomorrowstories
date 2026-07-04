import { test, expect } from "@playwright/test";

// Guards the thing that keeps biting on phones: no page should scroll sideways.
const routes = ["/", "/join", "/create", "/admin", "/e/demo", "/e/demo/big"];

for (const route of routes) {
  test(`no horizontal overflow at ${route}`, async ({ page }) => {
    await page.goto(route);
    await page.waitForLoadState("networkidle");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow, `horizontal overflow on ${route}`).toBeLessThanOrEqual(1);
  });
}
