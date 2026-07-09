import { describe, it, expect } from "vitest";
import { normalizeCustomPalette } from "../src/shared/customPalette.js";
import { HttpError } from "../src/shared/http.js";

const EVENT = "evt123";
const base = { page: "#0C1024", stage: "#141225", qr: "#F4F1EC", accent: "#FF6B35" };

describe("normalizeCustomPalette", () => {
  it("accepts four valid colours and returns them verbatim", () => {
    expect(normalizeCustomPalette(base, EVENT)).toEqual(base);
  });

  it("rejects a non-object", () => {
    expect(() => normalizeCustomPalette(null, EVENT)).toThrow(HttpError);
    expect(() => normalizeCustomPalette([base], EVENT)).toThrow(HttpError);
    expect(() => normalizeCustomPalette("nope", EVENT)).toThrow(HttpError);
  });

  it("rejects a malformed or missing colour", () => {
    expect(() => normalizeCustomPalette({ ...base, accent: "orange" }, EVENT)).toThrow(/accent/);
    expect(() => normalizeCustomPalette({ ...base, page: "#FFF" }, EVENT)).toThrow(/page/); // shorthand not allowed on the wire
    const { page, ...missing } = base;
    void page;
    expect(() => normalizeCustomPalette(missing, EVENT)).toThrow(HttpError);
  });

  it("keeps a wallpaper key scoped to the event's media prefix", () => {
    const key = `media/${EVENT}/wallpaper-abc.jpg`;
    expect(normalizeCustomPalette({ ...base, wallpaperKey: key }, EVENT).wallpaperKey).toBe(key);
  });

  it("drops an absent wallpaper key (null/empty) rather than storing it", () => {
    expect(normalizeCustomPalette({ ...base, wallpaperKey: null }, EVENT).wallpaperKey).toBeUndefined();
    expect(normalizeCustomPalette({ ...base, wallpaperKey: "" }, EVENT).wallpaperKey).toBeUndefined();
  });

  it("rejects a wallpaper key outside the event's prefix or with traversal", () => {
    expect(() => normalizeCustomPalette({ ...base, wallpaperKey: "media/other/x.jpg" }, EVENT)).toThrow(/wallpaperKey/);
    expect(() => normalizeCustomPalette({ ...base, wallpaperKey: `media/${EVENT}/../evil.jpg` }, EVENT)).toThrow(/wallpaperKey/);
  });
});
