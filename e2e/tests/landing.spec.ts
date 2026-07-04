import { test, expect } from "@playwright/test";

test("organizer can create an event and land on the big screen", async ({ page }) => {
  await page.goto("/create");
  await page.getByRole("button", { name: /create event & open big screen/i }).click();
  await expect(page).toHaveURL(/\/e\/[a-z0-9]+\/big/);
  // Both projector and mobile-organizer views expose the code + QR affordance.
  await expect(page.getByText(/or enter code/i)).toBeVisible();
});

test("a pasted event link joins the wall", async ({ page }) => {
  await page.goto("/join");
  await page.getByPlaceholder(/event code/i).fill("https://x.cloudfront.net/e/demo");
  await page.getByRole("button", { name: /join event/i }).click();
  await expect(page).toHaveURL(/\/e\/demo$/);
  await expect(page.getByText("The Wall")).toBeVisible();
});

test("an unknown code shows an inline error, not a page-bottom message", async ({ page }) => {
  await page.goto("/join");
  await page.getByPlaceholder(/event code/i).fill("ZZZZZ");
  await page.getByRole("button", { name: /join event/i }).click();
  await expect(page.getByText(/find that event/i)).toBeVisible();
});
