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
