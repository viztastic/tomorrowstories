// Shared domain types for Tomorrow Stories.
// The frontend keeps a parallel copy in frontend/src/types.ts — keep the wire
// shapes (VideoDTO / EventDTO) in sync between the two.

export interface Theme {
  id: string;
  name: string;
  color: string;
}

export type VideoStatus = "processing" | "live" | "failed";

export type Plan = "free" | "paid" | "unlimited";

/**
 * DynamoDB item for an organizer account. PK=ORG#<clerkUserId>, SK=PROFILE.
 * Created lazily on the organizer's first authenticated request.
 */
export interface OrganizerItem {
  PK: string;
  SK: "PROFILE";
  organizerId: string; // Clerk user id (the `sub` claim)
  email?: string;
  plan: Plan;
  eventsCount: number; // owned events, for quota checks
  createdAt: string;
  stripeCustomerId?: string; // reserved for billing (unused for now)
}

/** DynamoDB item for an event. PK=EVENT#<id>, SK=META */
export interface EventItem {
  PK: string;
  SK: "META";
  eventId: string;
  code: string; // short human-friendly display code
  name: string;
  themes: Theme[]; // topic buckets attendees choose from
  palette?: string; // visual palette id (color skin); undefined = default. See config.PALETTE_IDS
  ownerId?: string; // Clerk user id of the organizer who owns it (undefined = legacy)
  // GSI1 (owner → events) attributes; set whenever ownerId is set.
  GSI1PK?: string; // ORG#<ownerId>
  GSI1SK?: string; // <createdAt>#<eventId>
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

/** DynamoDB item for a comment. PK=EVENT#<id>, SK=CMT#<videoId>#<createdAt>#<commentId> */
export interface CommentItem {
  PK: string;
  SK: string;
  eventId: string;
  videoId: string;
  commentId: string;
  author: string; // required display name
  text: string;
  createdAt: string;
}

// ---- Wire shapes (what the API returns to the browser) ----

export interface EventDTO {
  eventId: string;
  code: string;
  name: string;
  themes: Theme[];
  palette: string; // visual palette id (always resolved to a concrete id in the DTO)
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

export interface CommentDTO {
  id: string;
  videoId: string;
  author: string;
  text: string;
  createdAt: string;
}
