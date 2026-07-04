import { describe, it, expect } from "vitest";
import { normalizeThemes } from "../src/shared/themes.js";
import { slugify } from "../src/shared/ids.js";
import { HttpError } from "../src/shared/http.js";

describe("slugify", () => {
  it("lowercases and dashes non-alphanumerics", () => {
    expect(slugify("Human & Machine")).toBe("human-machine");
    expect(slugify("Future of Work")).toBe("future-of-work");
  });
  it("trims leading/trailing dashes and caps length", () => {
    expect(slugify("  Hello!!  ")).toBe("hello");
    expect(slugify("a".repeat(40))).toHaveLength(24);
  });
  it("returns empty string when there are no usable characters", () => {
    expect(slugify("!!!")).toBe("");
    expect(slugify("")).toBe("");
  });
});

describe("normalizeThemes", () => {
  it("normalizes a valid custom set, generating ids from names", () => {
    const out = normalizeThemes([
      { name: "Big Ideas", color: "#112233" },
      { name: "Quick Wins", color: "#AABBCC" },
    ]);
    expect(out).toEqual([
      { id: "big-ideas", name: "Big Ideas", color: "#112233" },
      { id: "quick-wins", name: "Quick Wins", color: "#AABBCC" },
    ]);
  });

  it("preserves a provided id (rename/recolor keeps the id → no orphans)", () => {
    const out = normalizeThemes([{ id: "human", name: "People & AI", color: "#8B5CF6" }]);
    expect(out[0].id).toBe("human");
    expect(out[0].name).toBe("People & AI");
  });

  it("mints an id only for the new (id-less) row", () => {
    const out = normalizeThemes([
      { id: "work", name: "Future of Work", color: "#FFB020" },
      { name: "Brand New", color: "#222222" },
    ]);
    expect(out[0].id).toBe("work");
    expect(out[1].id).toBe("brand-new");
  });

  it("de-duplicates colliding ids with a numeric suffix", () => {
    const out = normalizeThemes([
      { name: "Topic" },
      { name: "Topic" },
    ]);
    expect(out[0].id).toBe("topic");
    expect(out[1].id).toBe("topic-2");
  });

  it("falls back to a valid color when the given color is malformed", () => {
    const out = normalizeThemes([{ name: "Bad Color", color: "not-a-color" }]);
    expect(out[0].color).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  it("rejects an empty array (min 1)", () => {
    expect(() => normalizeThemes([])).toThrow(HttpError);
  });

  it("rejects more than 8 topics", () => {
    const many = Array.from({ length: 9 }, (_, i) => ({ name: `T${i}` }));
    expect(() => normalizeThemes(many)).toThrow(/at most 8/i);
  });

  it("rejects a blank name", () => {
    expect(() => normalizeThemes([{ name: "   ", color: "#112233" }])).toThrow(/name/i);
  });

  it("rejects a non-array input", () => {
    expect(() => normalizeThemes("nope" as unknown)).toThrow(HttpError);
  });
});
