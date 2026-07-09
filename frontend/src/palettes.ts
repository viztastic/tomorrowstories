// Per-event visual palettes ("skins"). An organizer picks one and it recolors
// both the big-screen wall and the attendee UI. Colors are exposed as CSS custom
// properties on :root by PaletteProvider; the design.ts token constants resolve
// to var(--ts-*), so almost every existing inline style recolors for free.
//
// Light vs dark: the app's neutral surfaces are written as
// `rgba(var(--ts-neutral-rgb), α)`. Dark palettes set neutral-rgb to white
// (255,255,255) — panels/borders are white-at-low-alpha over a dark page. A
// light palette (rally) sets it to a near-black, so the SAME alphas become
// dark-on-white — one variable flips every surface without touching call sites.
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
  onAccent: string; // text drawn on top of a solid topic-color chip (must contrast)
  neutralRgb: string; // "r,g,b" base for rgba() neutral surfaces (white on dark, near-black on light)
  headerBg: string; // sticky header / bottom-nav frosted background
  chipOn: string; // active tab/filter chip background
  chipOnInk: string; // text on an active chip
  // Big-screen QR/event-code "credential" block. Most palettes leave qrPanelBg
  // transparent — the QR sits on its own light tile (qrLight) and the code below
  // it uses the normal ink colors. A palette can instead give the block a solid
  // card (qrPanelBg) with its own text tint (qrPanelInk) and recolor the QR
  // itself (qrDark = module color, qrLight = QR background / tile fill).
  qrPanelBg: string; // fill behind the QR + event code block ("transparent" = none)
  qrPanelInk: string; // text color for the event code when qrPanelBg is set
  qrDark: string; // QR module (foreground) color
  qrLight: string; // QR background + surrounding tile fill
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
    neutralRgb: "255,255,255",
    headerBg: "rgba(12,16,36,.72)",
    chipOn: "#F4F1EC",
    chipOnInk: "#0C0A12",
    qrPanelBg: "transparent",
    qrPanelInk: "#F4F1EC",
    qrDark: "#0C0A12",
    qrLight: "#F4F1EC",
  },
  // Bold civic energy in a LIGHT layout — white dominant, red the hero accent,
  // yellow on the active chips. Inspired by the YMCA World Council palette.
  rally: {
    id: "rally",
    name: "Rally",
    accent: "#E4002B", // red — links, dots, active states (reads well on white)
    brandGrad: "linear-gradient(135deg, #E4002B, #C40024)", // solid red buttons, white text
    ink: "#17181C", // near-black, neutral (not warm)
    muted: "#63666E",
    muted2: "#8A8E98",
    panel: "rgba(20,21,26,.05)",
    hairline: "rgba(20,21,26,.12)",
    pageBg: "radial-gradient(1200px 700px at 50% -10%, #FFFFFF, #F4F6F8 92%)", // essentially white
    bodyBg: "#FFFFFF",
    stageBg: "radial-gradient(120% 100% at 50% 0%, #FFFFFF, #F1F3F6)",
    overlayBg: "#FFFFFF",
    danger: "#E4002B",
    dangerInk: "#C40024", // red readable on white
    onAccent: "#17181C",
    neutralRgb: "20,21,26", // neutral near-black → clean grey surfaces on white
    headerBg: "rgba(255,255,255,.85)",
    chipOn: "#F5C400", // yellow active chips (the second accent)
    chipOnInk: "#17181C",
    qrPanelBg: "transparent",
    qrPanelInk: "#17181C",
    qrDark: "#0C0A12",
    qrLight: "#F4F1EC",
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
    neutralRgb: "255,255,255",
    headerBg: "rgba(4,18,31,.72)",
    chipOn: "#EAF6FF",
    chipOnInk: "#04121F",
    qrPanelBg: "transparent",
    qrPanelInk: "#EAF6FF",
    qrDark: "#0C0A12",
    qrLight: "#F4F1EC",
  },
  // Warm civic gold in a LIGHT layout — a #E3C166 yellow wall with #AD2923 brick
  // red as the hero accent. On the big screen the QR + event code sit on a solid
  // red card with a white (inverted) QR and white text, per the event brief.
  beacon: {
    id: "beacon",
    name: "Beacon",
    accent: "#AD2923", // brick red — links, dots, active states (reads on yellow)
    brandGrad: "linear-gradient(135deg, #AD2923, #8E1F17)", // solid red buttons, white text
    ink: "#2E1A0B", // deep warm brown, strong contrast on gold
    muted: "#6E4A22",
    muted2: "#8A6A38",
    panel: "rgba(46,26,11,.06)",
    hairline: "rgba(46,26,11,.14)",
    pageBg: "radial-gradient(1200px 700px at 50% -10%, #EBD07A, #E3C166 92%)",
    bodyBg: "#E3C166",
    // White stage so the stories + QR card pop against the gold page frame.
    stageBg: "radial-gradient(120% 100% at 50% 0%, #FFFFFF, #F7F3EA)",
    overlayBg: "#E3C166",
    danger: "#AD2923",
    dangerInk: "#8E1F17", // red readable on gold
    onAccent: "#FFFFFF", // white text on a solid red topic chip
    neutralRgb: "46,26,11", // warm near-black → brown-tinted neutral surfaces on gold
    headerBg: "rgba(227,193,102,.85)",
    chipOn: "#AD2923", // red active chips
    chipOnInk: "#FFFFFF",
    qrPanelBg: "#AD2923", // red card behind the QR + event code
    qrPanelInk: "#FFFFFF", // white event code text on the red card
    qrDark: "#FFFFFF", // white QR modules…
    qrLight: "#AD2923", // …on red, so the QR reads as white-on-red
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
  neutralRgb: "--ts-neutral-rgb",
  headerBg: "--ts-header-bg",
  chipOn: "--ts-chip-on",
  chipOnInk: "--ts-chip-on-ink",
  qrPanelBg: "--ts-qr-panel-bg",
  qrPanelInk: "--ts-qr-panel-ink",
  qrDark: "--ts-qr-dark",
  qrLight: "--ts-qr-light",
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
