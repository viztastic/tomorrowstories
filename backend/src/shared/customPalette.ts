// Validation + normalization for an event's custom palette. Mirrors themes.ts:
// the single choke point that guarantees a stored customPalette is always sane
// (four #rrggbb colours + an optional wallpaper key scoped to THIS event's media
// prefix). The frontend derives every text/border colour from these four, so the
// backend only has to store the organizer's raw choices.

import { HttpError } from "./http.js";
import type { EventCustomPalette } from "./types.js";

const HEX = /^#[0-9a-fA-F]{6}$/;
const MAX_KEY = 256;

function color(raw: unknown, field: string): string {
  const s = String(raw ?? "").trim();
  if (!HEX.test(s)) throw new HttpError(400, `customPalette.${field} must be a #rrggbb colour`);
  return s;
}

/**
 * Validate a client-supplied custom palette. `eventId` scopes the wallpaper key
 * so an organizer can only point at an image under their own event's media
 * prefix — never an arbitrary object elsewhere in the bucket.
 */
export function normalizeCustomPalette(input: unknown, eventId: string): EventCustomPalette {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new HttpError(400, "customPalette must be an object");
  }
  const raw = input as Record<string, unknown>;
  const item: EventCustomPalette = {
    page: color(raw.page, "page"),
    stage: color(raw.stage, "stage"),
    qr: color(raw.qr, "qr"),
    accent: color(raw.accent, "accent"),
  };

  const wk = raw.wallpaperKey == null ? "" : String(raw.wallpaperKey).trim();
  if (wk) {
    const prefix = `media/${eventId}/`;
    if (!wk.startsWith(prefix) || wk.includes("..") || wk.length > MAX_KEY) {
      throw new HttpError(400, "Invalid wallpaperKey");
    }
    item.wallpaperKey = wk;
  }
  return item;
}
