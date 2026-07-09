import { describe, it, expect } from "vitest";
import {
  buildCustomPalette,
  contrastRatio,
  readableInk,
  isHexColor,
  CUSTOM_PALETTE_ID,
  DEFAULT_CUSTOM_INPUT,
} from "./customPalette";

describe("custom palette color helpers", () => {
  it("isHexColor accepts #rgb / #rrggbb and rejects junk", () => {
    expect(isHexColor("#fff")).toBe(true);
    expect(isHexColor("#0C1024")).toBe(true);
    expect(isHexColor("0C1024")).toBe(false);
    expect(isHexColor("#12")).toBe(false);
    expect(isHexColor("red")).toBe(false);
  });

  it("contrastRatio is symmetric and spans 1..21", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 0);
    expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(21, 0);
    expect(contrastRatio("#123456", "#123456")).toBeCloseTo(1, 5);
  });

  it("readableInk picks light ink on dark surfaces and dark ink on light ones", () => {
    const onDark = readableInk("#0C1024");
    const onLight = readableInk("#F4F1EC");
    // Whatever the exact tints, each must clear the WCAG AA large-text bar (3:1)
    // and comfortably beat body-text AA (4.5:1) on its surface.
    expect(contrastRatio(onDark, "#0C1024")).toBeGreaterThan(4.5);
    expect(contrastRatio(onLight, "#F4F1EC")).toBeGreaterThan(4.5);
    expect(onDark).not.toBe(onLight);
  });
});

describe("buildCustomPalette", () => {
  it("derives legible ink for the stage on both dark and light stages", () => {
    const dark = buildCustomPalette({ page: "#05060A", stage: "#141225", qr: "#F4F1EC", accent: "#FF6B35" });
    const light = buildCustomPalette({ page: "#FFFFFF", stage: "#FFFFFF", qr: "#E4002B", accent: "#E4002B" });

    // ink reads on the stage it was derived from (stageBg wraps the color in a gradient)
    expect(contrastRatio(dark.ink, "#141225")).toBeGreaterThan(4.5);
    expect(contrastRatio(light.ink, "#FFFFFF")).toBeGreaterThan(4.5);

    // dark stage → white-based neutral surfaces; light stage → near-black
    expect(dark.neutralRgb).toBe("255,255,255");
    expect(light.neutralRgb).toBe("20,21,26");
  });

  it("makes on-accent and qr-panel text readable on their own backgrounds", () => {
    const p = buildCustomPalette({ page: "#0C1024", stage: "#141225", qr: "#E4002B", accent: "#F5C400" });
    expect(contrastRatio(p.onAccent, "#F5C400")).toBeGreaterThan(4.5);
    expect(contrastRatio(p.qrPanelInk, "#E4002B")).toBeGreaterThan(3);
    // the chosen qr colour IS the card behind the QR block
    expect(p.qrPanelBg).toBe("#E4002B");
  });

  it("carries the accent and a matching brand gradient, tagged as the custom id", () => {
    const p = buildCustomPalette({ page: "#0C1024", stage: "#141225", qr: "#fff", accent: "#38BDF8" });
    expect(p.id).toBe(CUSTOM_PALETTE_ID);
    expect(p.accent).toBe("#38BDF8");
    expect(p.brandGrad).toContain("#38BDF8");
    expect(p.brandGrad).toContain("linear-gradient");
  });

  it("sets wallpaper to a cover background-image only when a URL is given", () => {
    const none = buildCustomPalette(DEFAULT_CUSTOM_INPUT);
    expect(none.wallpaper).toBe("none");

    const withImg = buildCustomPalette({ ...DEFAULT_CUSTOM_INPUT, wallpaper: "https://cdn.test/bg.jpg" });
    expect(withImg.wallpaper).toContain("https://cdn.test/bg.jpg");
    expect(withImg.wallpaper).toContain("cover");
  });

  it("falls back to defaults for malformed color input instead of throwing", () => {
    const p = buildCustomPalette({ page: "nope", stage: "bad", qr: "", accent: "xyz" });
    expect(p.accent).toBe(DEFAULT_CUSTOM_INPUT.accent);
    expect(isHexColor(p.ink)).toBe(true);
  });
});
