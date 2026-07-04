import { test, expect } from "@playwright/test";

test("the wall shows seeded stories", async ({ page }) => {
  await page.goto("/e/demo");
  await expect(page.getByText("The Wall")).toBeVisible();
  await expect(page.getByText("Teaching my grandma to talk to AI")).toBeVisible();
});

test("opening a story shows the watch screen", async ({ page }) => {
  await page.goto("/e/demo");
  await page.getByText("Teaching my grandma to talk to AI").click();
  await expect(page.getByPlaceholder("Add a comment...")).toBeVisible();
});

test("the upload flow opens from the + button", async ({ page }) => {
  await page.goto("/e/demo");
  await page.getByRole("button", { name: /add your story/i }).click();
  await expect(page.getByText("Share your story")).toBeVisible();
  await expect(page.getByText(/up to 60 seconds/i)).toBeVisible();
});

test("theme filter chips narrow the wall", async ({ page }) => {
  await page.goto("/e/demo");
  await page.getByRole("button", { name: "Future of Work" }).click();
  await expect(page.getByText("Why I fired my calendar")).toBeVisible();
});

test("desktop uses a real web layout: header tabs + Add story button", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "desktop-only");
  await page.goto("/e/demo");
  await expect(page.getByRole("button", { name: "Wall" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Themes" })).toBeVisible();
  await expect(page.getByRole("button", { name: /add your story/i })).toBeVisible();
});

test("mobile uses a bottom tab bar + FAB", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "mobile-only");
  await page.goto("/e/demo");
  await expect(page.getByRole("button", { name: "You", exact: true })).toBeVisible(); // bottom nav
  await expect(page.getByRole("button", { name: /add your story/i })).toBeVisible(); // FAB
});
