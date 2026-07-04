// Resolves the API base URL. Priority:
//   1. VITE_API_URL (build-time env, handy for local dev)
//   2. /config.json { apiUrl } written into the web bucket by CDK at deploy time
//   3. demo mode (no backend) — the app runs on seeded mock data
//
// DEMO can be forced with VITE_DEMO=1.

export const DEMO = import.meta.env.VITE_DEMO === "1";

let cached: string | null = import.meta.env.VITE_API_URL || null;
let inflight: Promise<string | null> | null = null;

export async function getApiUrl(): Promise<string | null> {
  if (DEMO) return null;
  if (cached !== null) return cached;
  if (!inflight) {
    inflight = fetch("/config.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((c: { apiUrl?: string } | null) => {
        cached = c?.apiUrl?.replace(/\/$/, "") ?? null;
        return cached;
      })
      .catch(() => null);
  }
  return inflight;
}
