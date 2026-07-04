import { test, expect } from "@playwright/test";

// In demo mode there are no Clerk keys, so the organizer is treated as signed in
// (mock auth) and the dashboard renders directly — no password gate.
test("dashboard lists your events with links", async ({ page }) => {
  await page.goto("/admin");
  await expect(page.getByText("Your events")).toBeVisible();
  await expect(page.getByText("ATTENDEE").first()).toBeVisible();
  await expect(page.getByText("BIG SCREEN").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy" }).first()).toBeVisible();
});

test("dashboard can open the theme & topics editor for an event", async ({ page }) => {
  await page.goto("/admin");
  await page.getByRole("button", { name: /edit theme & topics/i }).first().click();
  await expect(page.getByText("WALL & APP THEME")).toBeVisible();
  await expect(page.getByRole("button", { name: "Rally" })).toBeVisible();
  await expect(page.getByRole("button", { name: /save changes/i })).toBeVisible();
});
