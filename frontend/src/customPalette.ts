// Custom per-event palettes. Where the named PALETTES in palettes.ts are fixed
// hand-tuned skins, a custom palette lets an organizer pick a handful of base
// colours (the page background — optionally an uploaded wallpaper — plus the
// story container, the QR card, and an accent) and DERIVES the rest of the
// full Palette so text always lands on a legible colour.
//
// The derivation is the whole point: the organizer never picks a text colour.
// For every surface we compute the ink (near-black or near-white, whichever
// contrasts more) and blend the muted/secondary tints toward the surface, so a
// dark stage gets light text and a pale stage gets dark text automatically.
//
// React-free on purpose (mirrors palettes.ts) so it can be imported anywhere.

import type { Palette } from "./palettes";

/** The organizer's raw choices — the small set of inputs the editor collects. */
export interface CustomPaletteInput {
  page: string; // the very-background colour (behind everything / around the stage)
  stage: string; // the container that holds the stories (+ the sidebar shares it)
  qr: string; // the container that holds the QR + event code
  accent: string; // primary accent (dots, active chips, links, buttons)
  wallpaper?: string; // full URL of an uploaded big-screen background image (optional)
}

/** A sensible starting point for the editor — Aurora-ish dark, so the preview reads. */
export const DEFAULT_CUSTOM_INPUT: CustomPaletteInput = {
  page: "#0C1024",
  stage: "#141225",
  qr: "#F4F1EC",
  accent: "#FF6B35",
};

// Near-black / near-white ink candidates. Not pure #000/#fff — a hair off reads
// softer on a projector and matches the tuned named palettes.
const DARK_INK = "#15161A";
const LIGHT_INK = "#F4F1EC";

type RGB = [number, number, number];

const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/** True for a syntactically valid #rgb / #rrggbb string. */
export function isHexColor(s: string): boolean {
  return typeof s === "string" && HEX_RE.test(s.trim());
}

function parseHex(hex: string): RGB {
  let h = hex.trim().replace(/^#/, "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex([r, g, b]: RGB): string {
  const h = (v: number) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** WCAG relative luminance (0 = black, 1 = white). */
function luminance([r, g, b]: RGB): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** WCAG contrast ratio between two colours (1..21). */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(parseHex(a));
  const lb = luminance(parseHex(b));
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Linear blend from a → b (t=0 keeps a, t=1 reaches b). */
function mix(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/** The ink (dark or light) with the most contrast on a given background. */
export function readableInk(bg: string): string {
  return contrastRatio(LIGHT_INK, bg) >= contrastRatio(DARK_INK, bg) ? LIGHT_INK : DARK_INK;
}

/** "r,g,b" string for the rgba() neutral-surface base (see palettes.ts). */
function neutralRgb(inkIsLight: boolean): string {
  return inkIsLight ? "255,255,255" : "20,21,26";
}

function rgba(hex: string, alpha: number): string {
  const [r, g, b] = parseHex(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Nudge a colour toward black (amount 0..1) — for the darker end of a gradient. */
function darken(hex: string, amount: number): string {
  return toHex(mix(parseHex(hex), [0, 0, 0], amount));
}

/**
 * Derive a complete Palette from the organizer's handful of choices. Everything
 * not chosen (all text colours, borders, header tint, danger, on-accent, …) is
 * computed for legibility against the surface it sits on.
 */
export function buildCustomPalette(input: CustomPaletteInput): Palette {
  const page = isHexColor(input.page) ? input.page : DEFAULT_CUSTOM_INPUT.page;
  const stage = isHexColor(input.stage) ? input.stage : DEFAULT_CUSTOM_INPUT.stage;
  const qr = isHexColor(input.qr) ? input.qr : DEFAULT_CUSTOM_INPUT.qr;
  const accent = isHexColor(input.accent) ? input.accent : DEFAULT_CUSTOM_INPUT.accent;

  // The stage (story container + sidebar) carries almost all of the on-screen
  // text, so its ink anchors the whole neutral system.
  const ink = readableInk(stage);
  const inkIsLight = ink === LIGHT_INK;
  const stageRgb = parseHex(stage);
  const inkRgb = parseHex(ink);

  // Muted/secondary = ink blended toward the stage (fades without losing hue).
  const muted = toHex(mix(inkRgb, stageRgb, 0.4));
  const muted2 = toHex(mix(inkRgb, stageRgb, 0.58));

  const onAccent = readableInk(accent);
  // Danger reads as an alert regardless of skin; pick the tone that survives the
  // stage and keep its "ink" variant readable too.
  const danger = inkIsLight ? "#FF556E" : "#E11D48";
  const dangerInk = inkIsLight ? "#FF8095" : "#BE123C";

  const wallpaper =
    input.wallpaper && input.wallpaper.trim()
      ? `url("${input.wallpaper}") center / cover no-repeat`
      : "none";

  return {
    id: CUSTOM_PALETTE_ID,
    name: "Custom",
    accent,
    brandGrad: `linear-gradient(135deg, ${accent}, ${darken(accent, 0.18)})`,
    ink,
    muted,
    muted2,
    panel: rgba(ink, 0.05),
    hairline: rgba(ink, 0.1),
    // Solid page colour is the fallback layer behind the wallpaper (and the
    // whole background on surfaces that don't paint the wallpaper). Expressed as
    // a gradient so it's a valid background-image layer everywhere pageBg is used.
    pageBg: `linear-gradient(${page}, ${page})`,
    bodyBg: page,
    stageBg: `linear-gradient(${stage}, ${stage})`,
    overlayBg: page,
    danger,
    dangerInk,
    onAccent,
    neutralRgb: neutralRgb(inkIsLight),
    headerBg: rgba(stage, 0.72),
    chipOn: accent,
    chipOnInk: onAccent,
    // The QR sits on its own light tile so it always scans; the CARD behind it
    // takes the organizer's chosen colour with a readable event-code tint.
    qrPanelBg: qr,
    qrPanelInk: readableInk(qr),
    qrDark: "#0C0A12",
    qrLight: "#F4F1EC",
    wallpaper,
  };
}

// Reserved palette id meaning "this event uses a stored customPalette". Kept
// here (not in PALETTE_IDS) because it isn't a named registry skin.
export const CUSTOM_PALETTE_ID = "custom";
