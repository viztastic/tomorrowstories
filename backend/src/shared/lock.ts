// Big-screen / attendee-wall access lock. An organizer can put a password on an
// event once it's over so the recorded stories aren't viewable by anyone who
// still has the link. No lock = open access (the default, live-event behaviour).
//
// Storage: we keep only a scrypt hash of the password (salt + hash), never the
// password itself. Viewers who enter the right password get a short-lived view
// token so the 4s wall poll doesn't re-hash on every request — the token is an
// HMAC signed with the (server-only) password hash, so it can't be forged and
// is invalidated automatically if the organizer changes or removes the password.

import { randomBytes, scryptSync, timingSafeEqual, createHmac } from "node:crypto";

export interface EventLock {
  salt: string; // hex
  hash: string; // hex scrypt(password, salt)
}

const KEY_LEN = 32;
const TOKEN_TTL_MS = 12 * 60 * 60 * 1000; // 12h — comfortably longer than an event day

/** Hash a fresh password for storage. */
export function hashPassword(password: string): EventLock {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, KEY_LEN).toString("hex");
  return { salt, hash };
}

/** Constant-time check of a candidate password against a stored lock. */
export function verifyPassword(password: string, lock: EventLock): boolean {
  const candidate = scryptSync(password, lock.salt, KEY_LEN);
  const expected = Buffer.from(lock.hash, "hex");
  // scrypt output length is fixed, but guard anyway so timingSafeEqual can't throw.
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}

/** Mint a view token for a viewer who proved the password. Format: `<exp>.<hmac>`. */
export function mintViewToken(eventId: string, lock: EventLock, now: number = Date.now()): string {
  const exp = now + TOKEN_TTL_MS;
  return `${exp}.${sign(eventId, exp, lock)}`;
}

/** True if the token is well-formed, unexpired, and signed for this event+lock. */
export function verifyViewToken(
  eventId: string,
  lock: EventLock,
  token: string,
  now: number = Date.now()
): boolean {
  const dot = token.indexOf(".");
  if (dot <= 0) return false;
  const exp = Number(token.slice(0, dot));
  if (!Number.isFinite(exp) || exp < now) return false;
  const provided = Buffer.from(token.slice(dot + 1), "utf8");
  const expected = Buffer.from(sign(eventId, exp, lock), "utf8");
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(provided, expected);
}

function sign(eventId: string, exp: number, lock: EventLock): string {
  // Key on the password hash so rotating/removing the password revokes every
  // outstanding token for free.
  return createHmac("sha256", lock.hash).update(`${eventId}.${exp}`).digest("hex");
}
