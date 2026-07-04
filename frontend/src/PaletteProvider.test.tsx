import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { PaletteProvider } from "./PaletteProvider";
import { PALETTES, resolvePalette, paletteVars, defaultRootCss, DEFAULT_PALETTE_ID } from "./palettes";

describe("palettes registry", () => {
  it("resolves a known id and falls back to the default for unknown/undefined", () => {
    expect(resolvePalette("rally").id).toBe("rally");
    expect(resolvePalette("nope").id).toBe(DEFAULT_PALETTE_ID);
    expect(resolvePalette(undefined).id).toBe(DEFAULT_PALETTE_ID);
  });

  it("paletteVars maps every token to a --ts-* custom property", () => {
    const vars = paletteVars(PALETTES.rally);
    expect(vars["--ts-accent"]).toBe(PALETTES.rally.accent);
    expect(vars["--ts-brand-grad"]).toBe(PALETTES.rally.brandGrad);
    expect(Object.keys(vars).every((k) => k.startsWith("--ts-"))).toBe(true);
  });

  it("defaultRootCss carries the default palette's accent", () => {
    expect(defaultRootCss()).toContain(PALETTES[DEFAULT_PALETTE_ID].accent);
  });
});

describe("PaletteProvider", () => {
  it("writes the palette's tokens onto :root while mounted and removes them on unmount", () => {
    const root = document.documentElement;
    const { unmount } = render(
      <PaletteProvider paletteId="rally">
        <div />
      </PaletteProvider>
    );
    expect(root.style.getPropertyValue("--ts-accent")).toBe(PALETTES.rally.accent);
    expect(root.style.getPropertyValue("--ts-body-bg")).toBe(PALETTES.rally.bodyBg);
    unmount();
    // Overrides are dropped so the GlobalStyle :root defaults take back over.
    expect(root.style.getPropertyValue("--ts-accent")).toBe("");
  });

  it("applies the default palette for an unknown id", () => {
    const root = document.documentElement;
    const { unmount } = render(
      <PaletteProvider paletteId="bogus">
        <div />
      </PaletteProvider>
    );
    expect(root.style.getPropertyValue("--ts-accent")).toBe(PALETTES[DEFAULT_PALETTE_ID].accent);
    unmount();
  });
});
