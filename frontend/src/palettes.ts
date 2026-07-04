// Per-event visual palettes ("skins"). An organizer picks one and it recolors
// both the big-screen wall and the attendee UI. Colors are exposed as CSS custom
// properties on :root by PaletteProvider; the design.ts token constants resolve
// to var(--ts-*), so almost every existing inline style recolors for free.
//
// This module is React-free on purpose so design.ts can import it safely.
// Keep the palette IDS in sync with backend/src/shared/config.ts PALETTE_IDS.

export interface Palette {
  id: string;
  name: string;
  accent: string; // primary accent (dots, active tabs, links, focus)
  brandGrad: string; // the brand gradient used on primary buttons/logo
  ink: string; // main text color
  muted: string; // secondary text
  muted2: string; // tertiary text / labels
  panel: string; // faint panel fill
  hairline: string; // faint border color
  pageBg: string; // radial page background (attendee + landing/admin)
  bodyBg: string; // flat body/overscroll background
  stageBg: string; // big-screen "stage" background
  overlayBg: string; // upload/video overlay background
  danger: string; // live dot / REC fill
  dangerInk: string; // "LIVE NOW" text tint
  onAccent: string; // text drawn on top of a solid `accent` fill (must contrast)
}

export const DEFAULT_PALETTE_ID = "aurora";

export const PALETTES: Record<string, Palette> = {
  // The original look — kept pixel-identical so existing events are unchanged.
  aurora: {
    id: "aurora",
    name: "Aurora",
    accent: "#FF6B35",
    brandGrad: "linear-gradient(120deg, #FF6B35, #FF3D77 46%, #7B2FF7)",
    ink: "#F4F1EC",
    muted: "#8B8698",
    muted2: "#726D82",
    panel: "rgba(255,255,255,.05)",
    hairline: "rgba(255,255,255,.08)",
    pageBg: "radial-gradient(1300px 740px at 50% -8%, #223159, #0C1024 60%)",
    bodyBg: "#0C1024",
    stageBg: "radial-gradient(120% 100% at 50% 0%, #1a1428, #08060e)",
    overlayBg: "#0B0812",
    danger: "#FF3D57",
    dangerInk: "#FF6B7E",
    onAccent: "#0C0A12",
  },
  // Bold civic energy — yellow / red / black. The brand gradient runs on RED
  // (not yellow) because primary buttons use white text, and white-on-yellow
  // fails contrast; the yellow lives in `accent`, where `onAccent` is dark.
  rally: {
    id: "rally",
    name: "Rally",
    accent: "#F8E11E",
    brandGrad: "linear-gradient(120deg, #E4002B, #C40024 45%, #111111)",
    ink: "#FDFBF2",
    muted: "#BDBAB0",
    muted2: "#85837B",
    panel: "rgba(255,255,255,.06)",
    hairline: "rgba(255,255,255,.10)",
    pageBg: "radial-gradient(1300px 740px at 50% -8%, #1A1000, #000000 60%)",
    bodyBg: "#000000",
    stageBg: "radial-gradient(120% 100% at 50% 0%, #1c1400, #000000)",
    overlayBg: "#050505",
    danger: "#E4002B",
    dangerInk: "#FF5A73",
    onAccent: "#111111",
  },
  // Cool deep-ocean blue.
  marine: {
    id: "marine",
    name: "Marine",
    accent: "#38BDF8",
    brandGrad: "linear-gradient(120deg, #38BDF8, #2563EB 50%, #0EA5A5)",
    ink: "#EAF6FF",
    muted: "#8AA0B4",
    muted2: "#63768A",
    panel: "rgba(255,255,255,.05)",
    hairline: "rgba(255,255,255,.08)",
    pageBg: "radial-gradient(1300px 740px at 50% -8%, #0E3A5A, #04121F 60%)",
    bodyBg: "#04121F",
    stageBg: "radial-gradient(120% 100% at 50% 0%, #0a2236, #02090f)",
    overlayBg: "#030B14",
    danger: "#FF5C7A",
    dangerInk: "#FF8AA0",
    onAccent: "#04121F",
  },
};

export const PALETTE_LIST: Palette[] = Object.values(PALETTES);

export function resolvePalette(id?: string): Palette {
  return (id && PALETTES[id]) || PALETTES[DEFAULT_PALETTE_ID];
}

// Palette token → CSS custom property name. The single source of truth for the
// variable names; design.ts constants reference these same names via var().
const VAR_NAMES: Record<keyof Omit<Palette, "id" | "name">, string> = {
  accent: "--ts-accent",
  brandGrad: "--ts-brand-grad",
  ink: "--ts-ink",
  muted: "--ts-muted",
  muted2: "--ts-muted2",
  panel: "--ts-panel",
  hairline: "--ts-hairline",
  pageBg: "--ts-page-bg",
  bodyBg: "--ts-body-bg",
  stageBg: "--ts-stage-bg",
  overlayBg: "--ts-overlay-bg",
  danger: "--ts-danger",
  dangerInk: "--ts-danger-ink",
  onAccent: "--ts-on-accent",
};

/** { "--ts-accent": "#FF6B35", … } for a palette — what PaletteProvider writes to :root. */
export function paletteVars(p: Palette): Record<string, string> {
  const out: Record<string, string> = {};
  (Object.keys(VAR_NAMES) as (keyof typeof VAR_NAMES)[]).forEach((k) => {
    out[VAR_NAMES[k]] = p[k];
  });
  return out;
}

/** CSS declarations for the default palette — seeded on :root by GlobalStyle so
 *  pages that never mount a PaletteProvider (Landing/Admin) still render. */
export function defaultRootCss(): string {
  return Object.entries(paletteVars(resolvePalette(DEFAULT_PALETTE_ID)))
    .map(([k, v]) => `${k}:${v};`)
    .join("");
}
