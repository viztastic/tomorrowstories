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
  adminPassword: process.env.ADMIN_PASSWORD || "",
  // TRANSCODE=off serves original uploads directly (no MediaConvert).
  transcode: (process.env.TRANSCODE || "on").toLowerCase() !== "off",
};

/** The default six conference themes from the design. */
export const DEFAULT_THEMES = [
  { id: "human", name: "Human & Machine", color: "#8B5CF6" },
  { id: "work", name: "Future of Work", color: "#FFB020" },
  { id: "green", name: "Sustainable Futures", color: "#2FD37E" },
  { id: "health", name: "Health & Longevity", color: "#FF5C8A" },
  { id: "create", name: "Creative Frontiers", color: "#22D3EE" },
  { id: "city", name: "Cities & Community", color: "#4D7CFF" },
];
