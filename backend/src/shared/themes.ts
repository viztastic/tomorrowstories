// Validation + normalization for an event's topic buckets (called "themes"
// throughout the codebase). Organizers can customize these per event; this is
// the single choke point that guarantees the stored array is always sane so the
// upload path (which validates a clip's theme against it) can trust it.

import { HttpError } from "./http.js";
import { slugify, newVideoId } from "./ids.js";
import { DEFAULT_THEMES } from "./config.js";
import type { Theme } from "./types.js";

const MIN_THEMES = 1; // an event with zero topics can't accept uploads
const MAX_THEMES = 8;
const NAME_MAX = 40;
const HEX = /^#[0-9a-fA-F]{6}$/;

// Fallback swatches for rows that arrive with a missing/invalid color.
const FALLBACK_COLORS = DEFAULT_THEMES.map((t) => t.color);

interface RawTheme {
  id?: unknown;
  name?: unknown;
  color?: unknown;
}

/**
 * Validate + normalize a client-supplied topic-bucket array.
 *
 * Ids are server-authoritative:
 *  - A row that carries a non-empty `id` KEEPS it (an existing topic being
 *    renamed/recolored) — this is what stops rename/recolor from orphaning the
 *    videos that reference that id.
 *  - A row with no id (a newly added topic) gets a fresh id slugified from its
 *    name, falling back to a random id, and de-duplicated with a numeric suffix.
 *
 * Throws HttpError(400) on any structural problem.
 */
export function normalizeThemes(input: unknown): Theme[] {
  if (!Array.isArray(input)) throw new HttpError(400, "themes must be an array");
  if (input.length < MIN_THEMES) throw new HttpError(400, "An event needs at least one topic");
  if (input.length > MAX_THEMES) throw new HttpError(400, `An event can have at most ${MAX_THEMES} topics`);

  const used = new Set<string>();
  const out: Theme[] = [];

  input.forEach((rawUnknown, i) => {
    const raw = (rawUnknown ?? {}) as RawTheme;
    const name = String(raw.name ?? "").trim();
    if (!name) throw new HttpError(400, "Every topic needs a name");
    if (name.length > NAME_MAX) throw new HttpError(400, `Topic names must be ${NAME_MAX} characters or fewer`);

    const rawColor = String(raw.color ?? "").trim();
    const color = HEX.test(rawColor) ? rawColor : FALLBACK_COLORS[i % FALLBACK_COLORS.length];

    // Preserve an existing id verbatim; generate one for a new row.
    const provided = String(raw.id ?? "").trim();
    let id = provided || slugify(name) || newVideoId();

    // Guarantee uniqueness within the set (suffix -2, -3, …).
    if (used.has(id)) {
      let n = 2;
      let candidate = `${id}-${n}`;
      while (used.has(candidate)) candidate = `${id}-${++n}`;
      id = candidate;
    }
    used.add(id);

    out.push({ id, name, color });
  });

  return out;
}
