import { test } from "node:test";
import assert from "node:assert/strict";
import { renderWall, slug, esc } from "./export-wall.mjs";

test("slug makes a safe filename", () => {
  assert.equal(slug("Why I fired my calendar!"), "why-i-fired-my-calendar");
  assert.equal(slug("  A/B  C  "), "a-b-c");
  assert.equal(slug(""), "clip");
});

test("esc escapes HTML-significant characters", () => {
  assert.equal(esc('a<b>&"'), "a&lt;b&gt;&amp;&quot;");
});

test("renderWall produces a self-contained wall referencing local files", () => {
  const event = { name: "Tomorrow 2026", themes: [{ id: "human", name: "Human & Machine", color: "#8B5CF6" }] };
  const items = [
    { id: "v1", title: "My AI co-founder quit", author: "Ben Carter", theme: "human", videoFile: "videos/my-ai-v1.mp4", posterFile: "posters/my-ai-v1.jpg" },
  ];
  const html = renderWall(event, items);
  assert.ok(html.startsWith("<!doctype html>"));
  assert.ok(html.includes("videos/my-ai-v1.mp4"), "references local mp4");
  assert.ok(html.includes('poster="posters/my-ai-v1.jpg"'), "references local poster");
  assert.ok(html.includes("#8B5CF6"), "uses theme colour");
  assert.ok(html.includes("Human &amp; Machine"), "escapes + shows theme name");
  assert.ok(html.includes("My AI co-founder quit"), "shows title");
});

test("renderWall omits poster attribute when there is no poster", () => {
  const html = renderWall({ name: "E", themes: [] }, [
    { id: "v2", title: "T", author: "A", theme: "x", videoFile: "videos/t-v2.mp4", posterFile: null },
  ]);
  assert.ok(!html.includes("poster="), "no poster attribute");
  assert.ok(html.includes("videos/t-v2.mp4"));
});
