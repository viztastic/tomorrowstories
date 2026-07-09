import { config, DEFAULT_PALETTE_ID } from "./config.js";
import type { CommentItem, CommentDTO, EventItem, EventDTO, VideoItem, VideoDTO } from "./types.js";

export function eventToDTO(e: EventItem, opts: { admin?: boolean } = {}): EventDTO {
  return {
    eventId: e.eventId,
    code: e.code,
    name: e.name,
    themes: e.themes,
    // Legacy events created before palettes have no `palette` — resolve to the
    // default so the client always receives a concrete id.
    palette: e.palette || DEFAULT_PALETTE_ID,
    // Custom skin (if any): expand the stored wallpaper key to a CDN URL so the
    // client can paint it directly.
    ...(e.customPalette
      ? {
          customPalette: {
            page: e.customPalette.page,
            stage: e.customPalette.stage,
            qr: e.customPalette.qr,
            accent: e.customPalette.accent,
            ...(e.customPalette.wallpaperKey
              ? { wallpaper: `${config.mediaBaseUrl}/${e.customPalette.wallpaperKey}` }
              : {}),
          },
        }
      : {}),
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

export function commentToDTO(c: CommentItem): CommentDTO {
  return {
    id: c.commentId,
    videoId: c.videoId,
    author: c.author,
    text: c.text,
    createdAt: c.createdAt,
  };
}
