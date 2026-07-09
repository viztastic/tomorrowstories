// Applies an event's visual palette by writing its tokens as CSS custom
// properties onto :root (document.documentElement) while the event page is
// mounted. Because design.ts's color constants resolve to var(--ts-*), setting
// these variables recolors the whole surface with no per-component work.
//
// A React context also exposes the resolved Palette object for the few places
// that need a concrete color in JS (e.g. the QR canvas, which can't read var()).
//
// An event uses EITHER a named palette (paletteId) or a custom one (custom): a
// custom palette is derived on the fly from the organizer's chosen colours +
// wallpaper (see customPalette.ts) and takes precedence when present.

import { createContext, useContext, useLayoutEffect, useMemo } from "react";
import type { ReactNode } from "react";
import { resolvePalette, paletteVars, DEFAULT_PALETTE_ID } from "./palettes";
import type { Palette } from "./palettes";
import { buildCustomPalette } from "./customPalette";
import type { CustomPaletteInput } from "./customPalette";

const PaletteContext = createContext<Palette>(resolvePalette(DEFAULT_PALETTE_ID));

export function usePalette(): Palette {
  return useContext(PaletteContext);
}

export function PaletteProvider({
  paletteId,
  custom,
  children,
}: {
  paletteId?: string;
  custom?: CustomPaletteInput | null;
  children: ReactNode;
}) {
  // A custom palette is derived from a fresh object each call, so memoize on the
  // serialized inputs — otherwise `palette` changes identity every render and the
  // effect below re-runs (and re-flushes :root) on every 4s poll.
  const key = custom ? `custom:${JSON.stringify(custom)}` : `named:${paletteId ?? ""}`;
  const palette = useMemo(
    () => (custom ? buildCustomPalette(custom) : resolvePalette(paletteId)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key]
  );

  useLayoutEffect(() => {
    const root = document.documentElement;
    const vars = paletteVars(palette);
    for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
    // On unmount (or palette change) drop the inline overrides so the default
    // :root block seeded by GlobalStyle takes over again — no bleed when the
    // user navigates from an event page back to Landing/Admin.
    return () => {
      for (const k of Object.keys(vars)) root.style.removeProperty(k);
    };
  }, [palette]);

  return <PaletteContext.Provider value={palette}>{children}</PaletteContext.Provider>;
}
