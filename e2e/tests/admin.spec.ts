import { test, expect } from "@playwright/test";

test("admin is password-gated, then lists every session with links", async ({ page }) => {
  await page.goto("/admin");
  await expect(page.getByText(/organizer console/i)).toBeVisible();

  // Demo mode accepts any password.
  await page.getByPlaceholder(/admin password/i).fill("a-very-long-password");
  await page.getByRole("button", { name: /unlock/i }).click();

  await expect(page.getByText("Sessions")).toBeVisible();
  await expect(page.getByText("ATTENDEE").first()).toBeVisible();
  await expect(page.getByText("BIG SCREEN").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy" }).first()).toBeVisible();
});
