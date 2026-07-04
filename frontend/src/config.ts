// Resolves runtime config for the SPA. Priority for each field:
//   1. Vite build-time env (VITE_API_URL / VITE_CLERK_PUBLISHABLE_KEY)
//   2. /config.json written into the web bucket by CDK at deploy time
//   3. demo mode (no backend, no auth) — the app runs on seeded mock data
//
// DEMO can be forced with VITE_DEMO=1.

export const DEMO = import.meta.env.VITE_DEMO === "1";

export interface AppConfig {
  apiUrl: string | null;
  clerkPublishableKey: string; // public key; empty = organizer auth disabled
}

let cached: AppConfig | null = null;
let inflight: Promise<AppConfig> | null = null;

const envApiUrl = (import.meta.env.VITE_API_URL as string | undefined) || null;
const envClerkKey = (import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined) || "";

export async function getConfig(): Promise<AppConfig> {
  if (cached) return cached;
  if (DEMO) {
    cached = { apiUrl: null, clerkPublishableKey: "" };
    return cached;
  }
  if (!inflight) {
    inflight = fetch("/config.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((c: { apiUrl?: string; clerkPublishableKey?: string } | null) => {
        cached = {
          apiUrl: (envApiUrl || c?.apiUrl || "").replace(/\/$/, "") || null,
          clerkPublishableKey: envClerkKey || c?.clerkPublishableKey || "",
        };
        return cached;
      })
      .catch(() => {
        cached = { apiUrl: envApiUrl, clerkPublishableKey: envClerkKey };
        return cached;
      });
  }
  return inflight;
}

/** Convenience accessor for the API base URL (null in demo/unconfigured). */
export async function getApiUrl(): Promise<string | null> {
  return (await getConfig()).apiUrl;
}
