// Wire shapes returned by the API. Keep in sync with backend/src/shared/types.ts.

export interface Theme {
  id: string;
  name: string;
  color: string;
}

export type VideoStatus = "processing" | "live" | "failed";

export interface EventDTO {
  eventId: string;
  code: string;
  name: string;
  themes: Theme[]; // topic buckets attendees choose from
  palette: string; // visual palette id (color skin) — see palettes.ts
  attendeeUrl: string;
  bigScreenUrl: string;
  createdAt: string;
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

/** A comment kept client-side only in v1 (not persisted server-side). */
export interface LocalComment {
  n: string;
  t: string;
  c: string;
}
