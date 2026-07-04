// Organizer authentication via Clerk. Verifies the Bearer session token on
// protected routes and resolves the caller's identity + event ownership.
//
// Participants never hit these — join/upload/like stay public. When
// CLERK_SECRET_KEY is unset (local/demo), requireOrganizer throws 503 so the
// caller can fall back to the legacy shared-password guard.

import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { verifyToken } from "@clerk/backend";
import { config } from "./config.js";
import { HttpError } from "./http.js";
import type { EventItem } from "./types.js";

export interface OrganizerIdentity {
  userId: string; // Clerk `sub`
  email?: string;
}

/** True when Clerk is configured (organizer auth is live). */
export function authEnabled(): boolean {
  return !!config.clerkSecretKey;
}

function bearerToken(event: APIGatewayProxyEventV2): string {
  const headers = event.headers ?? {};
  const raw = headers["authorization"] ?? headers["Authorization"] ?? "";
  return raw.replace(/^Bearer\s+/i, "").trim();
}

/** Verify the Bearer token and return the organizer identity, or throw 401/503. */
export async function requireOrganizer(event: APIGatewayProxyEventV2): Promise<OrganizerIdentity> {
  if (!authEnabled()) throw new HttpError(503, "Organizer sign-in isn't configured");
  const token = bearerToken(event);
  if (!token) throw new HttpError(401, "Sign in required");
  try {
    const claims = await verifyToken(token, {
      secretKey: config.clerkSecretKey,
      ...(config.authorizedParties.length ? { authorizedParties: config.authorizedParties } : {}),
    });
    const rec = claims as Record<string, unknown>;
    const email = typeof rec.email === "string" ? rec.email : undefined;
    return { userId: String(claims.sub), email };
  } catch (err) {
    if (err instanceof HttpError) throw err;
    throw new HttpError(401, "Invalid or expired session");
  }
}

export function isSuperAdmin(userId: string): boolean {
  return config.superAdminIds.includes(userId);
}

/** Allow only the owning organizer (or a super-admin) to manage an event. */
export function requireOwner(e: EventItem, id: OrganizerIdentity): void {
  if (e.ownerId && e.ownerId === id.userId) return;
  if (isSuperAdmin(id.userId)) return;
  throw new HttpError(403, "You don't have access to this event");
}
