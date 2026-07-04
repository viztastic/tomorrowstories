// Shared domain types for Tomorrow Stories.
// The frontend keeps a parallel copy in frontend/src/types.ts — keep the wire
// shapes (VideoDTO / EventDTO) in sync between the two.

export interface Theme {
  id: string;
  name: string;
  color: string;
}

export type VideoStatus = "processing" | "live" | "failed";

/** DynamoDB item for an event. PK=EVENT#<id>, SK=META */
export interface EventItem {
  PK: string;
  SK: "META";
  eventId: string;
  code: string; // short human-friendly display code
  name: string;
  themes: Theme[];
  createdAt: string;
  creatorIp?: string; // source IP that created the event (admin-only)
}

/** DynamoDB item for a video. PK=EVENT#<id>, SK=VIDEO#<videoId> */
export interface VideoItem {
  PK: string;
  SK: string;
  eventId: string;
  videoId: string;
  title: string;
  theme: string; // theme id
  author: string;
  status: VideoStatus;
  durationSec: number;
  likes: number;
  rawKey: string;
  mediaKey?: string; // set once transcoded
  posterKey?: string;
  createdAt: string;
}

// ---- Wire shapes (what the API returns to the browser) ----

export interface EventDTO {
  eventId: string;
  code: string;
  name: string;
  themes: Theme[];
  attendeeUrl: string;
  bigScreenUrl: string;
  createdAt: string;
  creatorIp?: string; // only populated on the admin sessions list
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
