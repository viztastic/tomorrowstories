// Environment configuration, read once at cold start.

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export const config = {
  region: process.env.AWS_REGION || "ap-southeast-2",
  tableName: required("TABLE_NAME"),
  rawBucket: required("RAW_BUCKET"),
  mediaBucket: required("MEDIA_BUCKET"),
  // Base URL that fronts the media bucket (CloudFront distribution domain).
  mediaBaseUrl: required("MEDIA_BASE_URL").replace(/\/$/, ""),
  // Public site origin, used to build attendee/big-screen links + QR targets.
  siteBaseUrl: required("SITE_BASE_URL").replace(/\/$/, ""),
  // MediaConvert queue + role (set on the transcode-start Lambda only).
  mcRole: process.env.MEDIACONVERT_ROLE_ARN || "",
  mcQueue: process.env.MEDIACONVERT_QUEUE || "",
  // Shared secret guarding the /admin sessions list. Empty = admin disabled.
  // (Legacy break-glass; organizer auth is Clerk — see clerkSecretKey.)
  adminPassword: process.env.ADMIN_PASSWORD || "",
  // TRANSCODE=off serves original uploads directly (no MediaConvert).
  transcode: (process.env.TRANSCODE || "on").toLowerCase() !== "off",
  // Clerk organizer auth. Empty secret = auth disabled (dev/demo fallback:
  // organizer routes fall back to the legacy shared-password guard).
  clerkSecretKey: process.env.CLERK_SECRET_KEY || "",
  // Clerk user ids granted super-admin (all-events) access, comma-separated.
  superAdminIds: (process.env.SUPER_ADMIN_IDS || "").split(",").map((s) => s.trim()).filter(Boolean),
  // Allowed origins for Clerk token `authorizedParties` (optional hardening).
  authorizedParties: (process.env.CLERK_AUTHORIZED_PARTIES || "").split(",").map((s) => s.trim()).filter(Boolean),
};

/** The default six conference topic buckets ("themes") from the design. */
export const DEFAULT_THEMES = [
  { id: "human", name: "Human & Machine", color: "#8B5CF6" },
  { id: "work", name: "Future of Work", color: "#FFB020" },
  { id: "green", name: "Sustainable Futures", color: "#2FD37E" },
  { id: "health", name: "Health & Longevity", color: "#FF5C8A" },
  { id: "create", name: "Creative Frontiers", color: "#22D3EE" },
  { id: "city", name: "Cities & Community", color: "#4D7CFF" },
];

// Allowed values for an event's visual palette (the color "skin" of the wall +
// attendee UI). The backend only stores/validates the id — the actual colors
// live in the frontend registry (frontend/src/palettes.ts). Keep these ids in
// sync with that file's PALETTES keys.
export const PALETTE_IDS = ["aurora", "rally", "marine"];
export const DEFAULT_PALETTE_ID = "aurora";
