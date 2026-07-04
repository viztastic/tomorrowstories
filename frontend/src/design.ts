// Design tokens + helpers ported verbatim from the Claude Design prototype
// (project/Tomorrow Stories.dc.html). Keeping the exact gradient/grain math so
// the real app matches the mock pixel-for-pixel.

import { useEffect } from "react";
import type { CSSProperties } from "react";
import type { Theme } from "./types";
import { defaultRootCss } from "./palettes";

// Color tokens resolve to CSS custom properties set per-event by PaletteProvider
// (see palettes.ts). GlobalStyle seeds the default palette on :root, so pages
// that never mount a provider render the original look. Changing an event's
// palette recolors every inline style that uses these constants for free.
export const ACCENT = "var(--ts-accent)";
export const BRAND_GRAD = "var(--ts-brand-grad)";

export const INK = "var(--ts-ink)";
export const MUTED = "var(--ts-muted)";
export const MUTED2 = "var(--ts-muted2)";
export const PANEL = "var(--ts-panel)";

// Additional palette-driven tokens (previously hardcoded hex at call sites).
export const HAIRLINE = "var(--ts-hairline)";
export const PAGE_BG = "var(--ts-page-bg)";
export const BODY_BG = "var(--ts-body-bg)";
export const STAGE_BG = "var(--ts-stage-bg)";
export const OVERLAY_BG = "var(--ts-overlay-bg)";
export const DANGER = "var(--ts-danger)";
export const DANGER_INK = "var(--ts-danger-ink)";
export const ON_ACCENT = "var(--ts-on-accent)";
export const HEADER_BG = "var(--ts-header-bg)";
export const CHIP_ON = "var(--ts-chip-on)"; // active tab/filter chip bg
export const CHIP_ON_INK = "var(--ts-chip-on-ink)"; // text on an active chip

export const FONT_DISPLAY = "'Bricolage Grotesque', sans-serif";
export const FONT_UI = "'Hanken Grotesk', system-ui, sans-serif";

export const THEMES: Theme[] = [
  { id: "human", name: "Human & Machine", color: "#8B5CF6" },
  { id: "work", name: "Future of Work", color: "#FFB020" },
  { id: "green", name: "Sustainable Futures", color: "#2FD37E" },
  { id: "health", name: "Health & Longevity", color: "#FF5C8A" },
  { id: "create", name: "Creative Frontiers", color: "#22D3EE" },
  { id: "city", name: "Cities & Community", color: "#4D7CFF" },
];

export function themeById(themes: Theme[], id: string): Theme {
  // Friendly fallback so a clip whose topic was removed/renamed never renders a
  // blank pill — it groups under "Uncategorized" instead of vanishing.
  return themes.find((t) => t.id === id) || { id, name: "Uncategorized", color: "#888" };
}

// Film-grain overlay (inline SVG data-URI, as in the prototype).
export const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

export const grainStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  backgroundImage: GRAIN,
  backgroundSize: "150px 150px",
  mixBlendMode: "overlay",
  opacity: 0.5,
  pointerEvents: "none",
};

/** Cinematic "video still" gradient built from a theme's two-colour pair. */
export function stillBg(g: [string, string]): string {
  return (
    "radial-gradient(68% 52% at 30% 20%, rgba(255,255,255,.40), rgba(255,255,255,0) 60%)," +
    "radial-gradient(120% 82% at 66% 120%, rgba(0,0,0,.58), rgba(0,0,0,0) 62%)," +
    "radial-gradient(145% 125% at 50% 46%, rgba(0,0,0,0) 52%, rgba(0,0,0,.45))," +
    "linear-gradient(158deg, " +
    g[0] +
    ", " +
    g[1] +
    ")"
  );
}

// Second-colour palette that pairs pleasantly with any theme accent.
const PAIR2 = ["#7B2FF7", "#EC4899", "#F59E0B", "#22D3EE", "#A855F7", "#FB7185", "#84CC16"];

/** Deterministic colour pair for a video (theme accent + a hashed partner). */
export function pairFor(theme: Theme, seed = ""): [string, string] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return [theme.color, PAIR2[h % PAIR2.length]];
}

export function initials(name: string): string {
  return (name || "")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function fmtLikes(n: number): string {
  return n >= 1000 ? (n / 1000).toFixed(1).replace(".0", "") + "k" : "" + n;
}

export function fmtDur(sec: number): string {
  if (!sec || sec < 1) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Injects keyframes + base styles once (equivalent to the prototype <helmet>). */
export function GlobalStyle() {
  useEffect(() => {
    const id = "ts-global-style";
    if (document.getElementById(id)) return;
    const el = document.createElement("style");
    el.id = id;
    el.textContent = `
      /* Default palette tokens (Aurora). PaletteProvider overrides these on
         :root per-event; removing its overrides falls back to these. */
      :root{${defaultRootCss()}}
      *{box-sizing:border-box;-webkit-tap-highlight-color:transparent;}
      html,body,#root{margin:0;min-height:100%;}
      /* clip (not hidden) prevents horizontal overflow WITHOUT making body a
         scroll container, so vertical trackpad scrolling keeps working. The
         hidden fallback runs first for browsers without overflow:clip support. */
      html,body{overflow-x:hidden;overflow-x:clip;overscroll-behavior:none;}
      body{background:var(--ts-body-bg);color:var(--ts-ink);font-family:${FONT_UI};max-width:100vw;}
      button{font-family:inherit;}
      ::-webkit-scrollbar{width:0px;height:0px;}
      @keyframes wallUp{from{transform:translateY(0)}to{transform:translateY(-50%)}}
      @keyframes wallDown{from{transform:translateY(-50%)}to{transform:translateY(0)}}
      @keyframes blink{0%,100%{opacity:1}50%{opacity:.25}}
      @keyframes rise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
      @keyframes spin{to{transform:rotate(360deg)}}
    `;
    document.head.appendChild(el);
  }, []);
  return null;
}
