import { test, expect } from "@playwright/test";

test("big screen exposes the event code + QR on any device", async ({ page }) => {
  await page.goto("/e/demo/big");
  await expect(page.getByText(/live now/i)).toBeVisible();
  await expect(page.getByText(/or enter code/i)).toBeVisible();
});

test("mobile big screen is the organizer share panel", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "mobile-only");
  await page.goto("/e/demo/big");
  await expect(page.getByText(/get stories on the wall/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /open the live wall/i })).toBeVisible();
});

test("desktop big screen is the projector wall", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "desktop-only");
  await page.goto("/e/demo/big");
  await expect(page.getByText(/trending themes/i)).toBeVisible();
  await expect(page.getByText(/add your/i)).toBeVisible();
});
