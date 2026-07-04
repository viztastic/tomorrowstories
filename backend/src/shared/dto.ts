import { config } from "./config.js";
import type { EventItem, EventDTO, VideoItem, VideoDTO } from "./types.js";

export function eventToDTO(e: EventItem, opts: { admin?: boolean } = {}): EventDTO {
  return {
    eventId: e.eventId,
    code: e.code,
    name: e.name,
    themes: e.themes,
    attendeeUrl: `${config.siteBaseUrl}/e/${e.eventId}`,
    bigScreenUrl: `${config.siteBaseUrl}/e/${e.eventId}/big`,
    createdAt: e.createdAt,
    // Creator IP is PII-ish — only surface it on the admin console, never to attendees.
    ...(opts.admin && e.creatorIp ? { creatorIp: e.creatorIp } : {}),
  };
}

export function videoToDTO(v: VideoItem): VideoDTO {
  return {
    id: v.videoId,
    title: v.title,
    theme: v.theme,
    author: v.author,
    status: v.status,
    durationSec: v.durationSec,
    likes: v.likes,
    mediaUrl: v.mediaKey ? `${config.mediaBaseUrl}/${v.mediaKey}` : null,
    posterUrl: v.posterKey ? `${config.mediaBaseUrl}/${v.posterKey}` : null,
    createdAt: v.createdAt,
  };
}
