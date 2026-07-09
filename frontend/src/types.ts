// Wire shapes returned by the API. Keep in sync with backend/src/shared/types.ts.

export interface Theme {
  id: string;
  name: string;
  color: string;
}

export type VideoStatus = "processing" | "live" | "failed";

/** Organizer's custom skin, as received from the API (wallpaper is a full URL).
 *  Shape matches CustomPaletteInput in customPalette.ts so it feeds the editor +
 *  buildCustomPalette directly. */
export interface CustomPalette {
  page: string;
  stage: string;
  qr: string;
  accent: string;
  wallpaper?: string; // display URL: CDN URL from the API, or a local object URL while editing
  wallpaperKey?: string; // S3 key set on a fresh upload this session (sent on save; see api.ts)
}

export interface EventDTO {
  eventId: string;
  code: string;
  name: string;
  themes: Theme[]; // topic buckets attendees choose from
  palette: string; // visual palette id (color skin) — see palettes.ts
  customPalette?: CustomPalette; // present only when palette === "custom"
  attendeeUrl: string;
  bigScreenUrl: string;
  createdAt: string;
  locked: boolean; // true when the organizer set a view password (never the password)
  creatorIp?: string; // only present on the admin sessions list
}

export interface VideoDTO {
  id: string;
  title: string;
  theme: string;
  author: string;
  status: VideoStatus;
  durationSec: number;
  likes: number;
  mediaUrl: string | null;
  posterUrl: string | null;
  createdAt: string;
}

export interface CommentDTO {
  id: string;
  videoId: string;
  author: string;
  text: string;
  createdAt: string;
}
