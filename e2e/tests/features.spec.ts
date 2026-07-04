import { test, expect } from "@playwright/test";

test("organizer's chosen palette recolors the app (yellow/red/black)", async ({ page }) => {
  await page.goto("/create");
  await page.getByRole("button", { name: "Rally" }).click();
  await page.getByRole("button", { name: /create event & open big screen/i }).click();
  await expect(page).toHaveURL(/\/e\/[a-z0-9]+\/big/);
  // The palette is applied as CSS custom properties on :root.
  const accent = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--ts-accent").trim()
  );
  expect(accent.toUpperCase()).toBe("#F8E11E");
});

test("the default palette leaves the original accent in place", async ({ page }) => {
  await page.goto("/e/demo");
  await expect(page.getByText("The Wall")).toBeVisible();
  const accent = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--ts-accent").trim()
  );
  expect(accent.toUpperCase()).toBe("#FF6B35");
});

test("attendee can choose between recording and the camera roll", async ({ page }) => {
  await page.goto("/e/demo");
  await page.getByRole("button", { name: /add your story/i }).click();
  await expect(page.getByText("Share your story")).toBeVisible();
  await expect(page.getByRole("button", { name: /record a video/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /choose from camera roll/i })).toBeVisible();
});

test("organizer can customize the topic buckets in the create flow", async ({ page }) => {
  await page.goto("/create");
  await page.getByRole("button", { name: /customize the topics/i }).click();
  // Prefilled with the six defaults…
  const topicInputs = page.getByRole("textbox", { name: "Topic name" });
  await expect(topicInputs).toHaveCount(6);
  await expect(topicInputs.first()).toHaveValue("Human & Machine");
  await expect(page.getByText(/6\/8/)).toBeVisible();
  // …and a topic can be added.
  await page.getByRole("button", { name: /add topic/i }).click();
  await expect(topicInputs).toHaveCount(7);
  await expect(page.getByText(/7\/8/)).toBeVisible();
});
