import { randomBytes } from "node:crypto";

// Crockford base32 alphabet (no I, L, O, U — unambiguous).
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

function base32(bytes: Buffer): string {
  let out = "";
  for (const b of bytes) out += ALPHABET[b % 32];
  return out;
}

/**
 * Unguessable event id — the security boundary. 16 chars over a 32-symbol
 * alphabet ≈ 80 bits of entropy, so events cannot be enumerated. Lowercased
 * for tidy URLs (/e/<id>).
 */
export function newEventId(): string {
  return base32(randomBytes(16)).toLowerCase();
}

/** Short human-friendly display code (e.g. shown under the QR). Not a secret. */
export function newEventCode(): string {
  return base32(randomBytes(6)).slice(0, 6);
}

/** Per-video id. */
export function newVideoId(): string {
  return base32(randomBytes(10)).toLowerCase();
}

/**
 * URL/id-friendly slug for a topic-bucket name (mirrors the frontend `slug` in
 * export.ts). Lowercase, non-alphanumerics collapsed to dashes, trimmed, capped.
 * Returns "" when the name has no usable characters — callers fall back to a
 * random id so a topic never ends up with an empty id.
 */
export function slugify(s: string): string {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 24);
}
