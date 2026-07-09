import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { config, DEFAULT_THEMES, DEFAULT_PALETTE_ID, PALETTE_IDS } from "./shared/config.js";
import {
  getEvent,
  putEvent,
  putVideo,
  getVideo,
  listVideos,
  incrementLikes,
  putCodeMapping,
  getEventIdByCode,
  listAllEvents,
  listMyEvents,
  deleteEvent,
  deleteVideos,
  updateEvent,
  ensureOrganizer,
  getOrganizer,
  bumpOrganizerEvents,
  ownerGsiKeys,
  putComment,
  listVideoComments,
  listEventComments,
} from "./shared/db.js";
import { newEventCode, newEventId, newVideoId, newCommentId } from "./shared/ids.js";
import { normalizeThemes } from "./shared/themes.js";
import { normalizeCustomPalette } from "./shared/customPalette.js";
import { authEnabled, requireOrganizer, requireOwner, isSuperAdmin } from "./shared/auth.js";
import type { OrganizerIdentity } from "./shared/auth.js";
import { limitsFor } from "./shared/plans.js";
import { eventToDTO, videoToDTO, commentToDTO } from "./shared/dto.js";
import { badRequest, created, HttpError, json, notFound, ok, serverError } from "./shared/http.js";
import type { CommentItem, EventItem, VideoItem } from "./shared/types.js";

const s3 = new S3Client({ region: config.region });

const MAX_BYTES = 200 * 1024 * 1024; // 200 MB cap on a phone clip
const ALLOWED_EXT: Record<string, string> = {
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
  "video/x-matroska": "mkv",
  "video/3gpp": "3gp",
};

// Big-screen wallpaper uploads (custom palettes). Images only, smaller cap.
const MAX_IMAGE_BYTES = 15 * 1024 * 1024; // 15 MB
const ALLOWED_IMAGE_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function handler(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
  const method = event.requestContext.http.method;
  if (method === "OPTIONS") return json(204, {});

  try {
    const p = event.pathParameters ?? {};

    // POST /events
    if (method === "POST" && event.rawPath === "/events") {
      return await createEvent(event);
    }
    // GET /admin/events  (all events — super-admin / legacy shared-secret)
    if (method === "GET" && event.rawPath === "/admin/events") {
      return await adminList(event);
    }
    // GET /me/events  (an organizer's own events)
    if (method === "GET" && event.rawPath === "/me/events") {
      return await myEventsRoute(event);
    }
    // GET /join/{code}
    if (method === "GET" && p.code) {
      return await joinByCode(p.code);
    }
    if (p.eventId) {
      // GET /events/{eventId}
      if (method === "GET" && !p.videoId && event.rawPath.endsWith(`/events/${p.eventId}`)) {
        return await getEventRoute(p.eventId);
      }
      // DELETE /events/{eventId}  (admin: remove the event + its videos + files)
      if (method === "DELETE" && !p.videoId && event.rawPath.endsWith(`/events/${p.eventId}`)) {
        return await deleteEventRoute(p.eventId, event);
      }
      // PATCH /events/{eventId}  (organizer: edit name / palette / topic buckets)
      if (method === "PATCH" && !p.videoId && event.rawPath.endsWith(`/events/${p.eventId}`)) {
        return await patchEventRoute(p.eventId, event);
      }
      // POST /events/{eventId}/uploads
      if (method === "POST" && event.rawPath.endsWith("/uploads")) {
        return await createUpload(p.eventId, event);
      }
      // POST /events/{eventId}/wallpaper  (organizer: presigned custom-palette image)
      if (method === "POST" && event.rawPath.endsWith("/wallpaper")) {
        return await createWallpaperUpload(p.eventId, event);
      }
      // GET /events/{eventId}/videos
      if (method === "GET" && event.rawPath.endsWith("/videos")) {
        return await listVideosRoute(p.eventId);
      }
      // POST /events/{eventId}/videos/delete  (organizer: bulk-remove selected stories)
      if (method === "POST" && !p.videoId && event.rawPath.endsWith("/videos/delete")) {
        return await bulkDeleteVideosRoute(p.eventId, event);
      }
      // DELETE /events/{eventId}/videos/{videoId}  (organizer: remove one story + its file)
      if (method === "DELETE" && p.videoId && event.rawPath.endsWith(`/videos/${p.videoId}`)) {
        return await deleteVideosRoute(p.eventId, [p.videoId], event);
      }
      // POST /events/{eventId}/videos/{videoId}/like
      if (method === "POST" && p.videoId && event.rawPath.endsWith("/like")) {
        return await likeRoute(p.eventId, p.videoId);
      }
      // .../videos/{videoId}/comments  (public: add / list a video's comments)
      if (p.videoId && event.rawPath.endsWith("/comments")) {
        if (method === "POST") return await createComment(p.eventId, p.videoId, event);
        if (method === "GET") return await listVideoCommentsRoute(p.eventId, p.videoId);
      }
      // GET /events/{eventId}/comments  (all comments — powers the archive)
      if (method === "GET" && !p.videoId && event.rawPath.endsWith(`/events/${p.eventId}/comments`)) {
        return await listEventCommentsRoute(p.eventId);
      }
    }
    return notFound("Unknown route");
  } catch (err) {
    if (err instanceof HttpError) return json(err.status, { error: err.message });
    console.error("Unhandled error", err);
    return serverError();
  }
}

function parseBody(event: APIGatewayProxyEventV2): Record<string, unknown> {
  if (!event.body) return {};
  const raw = event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : event.body;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new HttpError(400, "Invalid JSON body");
  }
}

async function createEvent(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  // Auth mode: only signed-in organizers create events (they own them).
  // Legacy mode (no Clerk): open creation, ownerless — unchanged behavior.
  const identity = authEnabled() ? await requireOrganizer(event) : null;

  if (identity) {
    const org = await ensureOrganizer(identity.userId, identity.email);
    const limits = limitsFor(org.plan);
    if (org.eventsCount >= limits.maxEvents) {
      return json(402, {
        error: `Your ${org.plan} plan allows ${limits.maxEvents} event${limits.maxEvents === 1 ? "" : "s"}. Upgrade to create more.`,
      });
    }
  }

  const body = parseBody(event);
  const name = String(body.name ?? "").trim() || "Tomorrow Stories";
  const eventId = newEventId();

  // Custom topic buckets are optional — an organizer who doesn't customize gets
  // the default set. normalizeThemes throws a 400 on a malformed custom array.
  const themes = body.themes === undefined ? DEFAULT_THEMES : normalizeThemes(body.themes);

  // Visual skin: a custom palette (organizer's own colours) wins over a named
  // one and stamps the reserved "custom" id; otherwise a validated named id.
  let palette = PALETTE_IDS.includes(String(body.palette)) ? String(body.palette) : DEFAULT_PALETTE_ID;
  let customPalette: EventItem["customPalette"];
  if (body.customPalette != null) {
    customPalette = normalizeCustomPalette(body.customPalette, eventId);
    palette = "custom";
  }

  // Pick a short code that isn't already taken (collisions are astronomically
  // rare over 32^6, but check a few times to be safe).
  let code = newEventCode();
  for (let i = 0; i < 5; i++) {
    if (!(await getEventIdByCode(code))) break;
    code = newEventCode();
  }

  const createdAt = new Date().toISOString();
  const item: EventItem = {
    PK: `EVENT#${eventId}`,
    SK: "META",
    eventId,
    code,
    name: name.slice(0, 80),
    themes,
    palette,
    ...(customPalette ? { customPalette } : {}),
    ...(identity ? { ownerId: identity.userId, ...ownerGsiKeys(identity.userId, createdAt, eventId) } : {}),
    createdAt,
    creatorIp: event.requestContext.http.sourceIp,
  };
  await putEvent(item);
  await putCodeMapping(code, eventId);
  if (identity) await bumpOrganizerEvents(identity.userId, 1);
  return created(eventToDTO(item));
}

/**
 * Edit an event's mutable settings: name, visual palette, and topic buckets.
 * Guarded by the shared admin secret today; in the auth phase this single call
 * site swaps to an organizer-ownership check. Removing a topic that still has
 * clips is rejected so those clips never orphan.
 */
async function patchEventRoute(
  eventId: string,
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
  const identity = await requireManager(event);
  const e = await getEvent(eventId);
  if (!e) return notFound("Event not found");
  if (identity) requireOwner(e, identity);

  const body = parseBody(event);
  const patch: {
    name?: string;
    palette?: string;
    themes?: EventItem["themes"];
    customPalette?: EventItem["customPalette"] | null;
  } = {};

  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) return badRequest("Event name cannot be empty");
    patch.name = name.slice(0, 80);
  }

  // Custom palette takes precedence: an object switches the event to the "custom"
  // skin; explicit null clears it and falls back to the named palette in the body
  // (or the current one). Undefined leaves whatever's stored.
  if (body.customPalette === null) {
    patch.customPalette = null;
    if (body.palette !== undefined) {
      if (!PALETTE_IDS.includes(String(body.palette))) return badRequest("Unknown palette");
      patch.palette = String(body.palette);
    }
  } else if (body.customPalette !== undefined) {
    patch.customPalette = normalizeCustomPalette(body.customPalette, eventId);
    patch.palette = "custom";
  } else if (body.palette !== undefined) {
    if (!PALETTE_IDS.includes(String(body.palette))) return badRequest("Unknown palette");
    patch.palette = String(body.palette);
    // Switching to a named palette drops any stored custom skin.
    patch.customPalette = null;
  }

  if (body.themes !== undefined) {
    const themes = normalizeThemes(body.themes);
    // Guard against orphaning clips: a topic id that still has videos can't be
    // removed. Renames/recolors keep the id (see normalizeThemes) so they pass.
    const keptIds = new Set(themes.map((t) => t.id));
    const removed = e.themes.filter((t) => !keptIds.has(t.id));
    if (removed.length) {
      const videos = await listVideos(eventId);
      for (const t of removed) {
        const count = videos.filter((v) => v.theme === t.id).length;
        if (count > 0) {
          return badRequest(`Topic “${t.name}” still has ${count} ${count === 1 ? "story" : "stories"} — reassign or keep it`);
        }
      }
    }
    patch.themes = themes;
  }

  if (Object.keys(patch).length === 0) return badRequest("Nothing to update");

  const updated = await updateEvent(eventId, patch);
  return ok(eventToDTO(updated, { admin: true }));
}

async function joinByCode(code: string): Promise<APIGatewayProxyResultV2> {
  const eventId = await getEventIdByCode(code);
  if (!eventId) return notFound("No event with that code");
  return ok({ eventId });
}

/** Shared-secret guard for the organizer console. Throws 404 if disabled, 401 if wrong. */
function requireAdmin(event: APIGatewayProxyEventV2): void {
  if (!config.adminPassword) throw new HttpError(404, "Admin console is disabled");
  const key = event.headers?.["x-admin-key"] ?? event.queryStringParameters?.key ?? "";
  if (key !== config.adminPassword) throw new HttpError(401, "Wrong password");
}

/**
 * Guard for event-management routes. When Clerk is configured, requires a valid
 * organizer session and returns their identity. Otherwise (local/demo, or before
 * Clerk is set up) falls back to the legacy shared-password guard and returns
 * null — the caller then skips ownership checks (password = full access).
 */
async function requireManager(event: APIGatewayProxyEventV2): Promise<OrganizerIdentity | null> {
  if (authEnabled()) return await requireOrganizer(event);
  requireAdmin(event);
  return null;
}

async function adminList(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const identity = await requireManager(event);
  // In auth mode, the all-events list is super-admin only.
  if (identity && !isSuperAdmin(identity.userId)) throw new HttpError(403, "Super-admin access only");
  const events = (await listAllEvents()).map((e) => eventToDTO(e, { admin: true }));
  return ok({ events });
}

/** An organizer's own events (requires a Clerk session). */
async function myEventsRoute(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const identity = await requireOrganizer(event);
  const events = (await listMyEvents(identity.userId)).map((e) => eventToDTO(e, { admin: true }));
  return ok({ events });
}

async function deleteEventRoute(
  eventId: string,
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
  const identity = await requireManager(event);
  const e = await getEvent(eventId);
  if (!e) return notFound("Event not found");
  if (identity) requireOwner(e, identity);
  const videos = await listVideos(eventId);
  const comments = await listEventComments(eventId);
  // Metadata first, then the files. If a file delete fails the metadata is
  // already gone, so the event disappears from the wall/admin either way.
  await deleteEvent(eventId, e.code, videos.map((v) => v.videoId), comments.map((c) => c.SK));
  await Promise.all([
    deletePrefix(config.mediaBucket, `media/${eventId}/`),
    deletePrefix(config.rawBucket, `raw/${eventId}/`),
  ]);
  // Free the owner's event-quota slot.
  if (e.ownerId) await bumpOrganizerEvents(e.ownerId, -1);
  return ok({ deleted: true, videos: videos.length });
}

/**
 * Bulk-delete the stories named in the request body: `{ videoIds: string[] }`.
 * Organizer-only (same guard as the single delete, applied in deleteVideosRoute).
 */
async function bulkDeleteVideosRoute(
  eventId: string,
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
  const body = parseBody(event);
  const ids = Array.isArray(body.videoIds) ? [...new Set(body.videoIds.map(String))] : [];
  if (!ids.length) return badRequest("No stories selected");
  return deleteVideosRoute(eventId, ids, event);
}

/**
 * Remove one or more videos from an event (metadata + comments + files) while
 * leaving the event itself. Guarded by the organizer/owner check. Unknown ids are
 * silently ignored; only videos that still exist are removed and counted. Files
 * live under per-video key prefixes (`raw/<eventId>/<videoId>` and
 * `media/<eventId>/<videoId>` — the latter covers both the no-transcode single
 * object and the transcode output folder), so a prefix purge cleans each one.
 */
async function deleteVideosRoute(
  eventId: string,
  videoIds: string[],
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
  const identity = await requireManager(event);
  const e = await getEvent(eventId);
  if (!e) return notFound("Event not found");
  if (identity) requireOwner(e, identity);

  const wanted = new Set(videoIds);
  const targets = (await listVideos(eventId)).filter((v) => wanted.has(v.videoId));
  if (!targets.length) return notFound("No matching stories");

  // Drop the deleted videos' comments too, so none orphan under the event.
  const targetIds = new Set(targets.map((v) => v.videoId));
  const comments = (await listEventComments(eventId)).filter((c) => targetIds.has(c.videoId));

  await deleteVideos(eventId, [...targetIds], comments.map((c) => c.SK));
  await Promise.all(
    targets.flatMap((v) => [
      deletePrefix(config.rawBucket, `raw/${eventId}/${v.videoId}`),
      deletePrefix(config.mediaBucket, `media/${eventId}/${v.videoId}`),
    ])
  );
  return ok({ deleted: targets.length });
}

/** Delete every object under a key prefix (paged; 1000 keys per DeleteObjects call). */
async function deletePrefix(bucket: string, prefix: string): Promise<void> {
  let token: string | undefined;
  do {
    const list = await s3.send(
      new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: token })
    );
    const objects = (list.Contents ?? []).map((o) => ({ Key: o.Key! }));
    if (objects.length) {
      const del = await s3.send(
        new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: objects, Quiet: true } })
      );
      if (del.Errors?.length) {
        throw new Error(`Failed to delete ${del.Errors.length} object(s) from ${bucket}`);
      }
    }
    token = list.IsTruncated ? list.NextContinuationToken : undefined;
  } while (token);
}

async function getEventRoute(eventId: string): Promise<APIGatewayProxyResultV2> {
  const e = await getEvent(eventId);
  if (!e) return notFound("Event not found");
  return ok(eventToDTO(e));
}

async function createUpload(
  eventId: string,
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
  const e = await getEvent(eventId);
  if (!e) return notFound("Event not found");

  // Plan quota (owned events only): cap clips per event by the owner's plan.
  // Legacy/ownerless events and unlimited plans skip the extra reads.
  if (e.ownerId) {
    const limits = limitsFor((await getOrganizer(e.ownerId))?.plan);
    if (Number.isFinite(limits.maxClipsPerEvent)) {
      const count = (await listVideos(eventId)).length;
      if (count >= limits.maxClipsPerEvent) {
        return json(403, { error: "This event has reached its story limit." });
      }
    }
  }

  const body = parseBody(event);
  const title = String(body.title ?? "").trim();
  const theme = String(body.theme ?? "").trim();
  const author = String(body.author ?? "").trim() || "Anonymous";
  const contentType = String(body.contentType ?? "");
  const durationSec = Math.min(Math.max(Number(body.durationSec) || 0, 0), 90);

  if (!title) return badRequest("A title is required");
  if (!e.themes.some((t) => t.id === theme)) return badRequest("Unknown theme");
  const ext = ALLOWED_EXT[contentType];
  if (!ext) return badRequest("Unsupported video type");

  const videoId = newVideoId();

  // No-transcode mode (TRANSCODE=off): upload straight into the media bucket and
  // mark the clip live immediately — no MediaConvert. Used when the account can't
  // use MediaConvert. Trade-off: the original codec must play in the viewer's
  // browser (fine for H.264; iPhone HEVC may not play everywhere).
  const useTranscode = config.transcode;
  const key = useTranscode ? `raw/${eventId}/${videoId}.${ext}` : `media/${eventId}/${videoId}.${ext}`;
  const bucket = useTranscode ? config.rawBucket : config.mediaBucket;

  const presigned = await createPresignedPost(s3, {
    Bucket: bucket,
    Key: key,
    Conditions: [
      ["content-length-range", 1, MAX_BYTES],
      ["eq", "$Content-Type", contentType],
    ],
    Fields: { "Content-Type": contentType },
    Expires: 600,
  });

  const video: VideoItem = {
    PK: `EVENT#${eventId}`,
    SK: `VIDEO#${videoId}`,
    eventId,
    videoId,
    title: title.slice(0, 120),
    theme,
    author: author.slice(0, 60),
    status: useTranscode ? "processing" : "live",
    durationSec,
    likes: 0,
    rawKey: key,
    ...(useTranscode ? {} : { mediaKey: key }),
    createdAt: new Date().toISOString(),
  };
  await putVideo(video);

  return created({ video: videoToDTO(video), upload: presigned });
}

/**
 * Presigned POST for a big-screen wallpaper image (custom palettes). Organizer-
 * only, and only for their own event. The image lands under the event's media
 * prefix (media/<eventId>/wallpaper-*), so it's served by CloudFront /media/* and
 * cleaned up with the rest of the event's files on delete. The client then PATCHes
 * the event's customPalette with the returned key.
 */
async function createWallpaperUpload(
  eventId: string,
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
  const identity = await requireManager(event);
  const e = await getEvent(eventId);
  if (!e) return notFound("Event not found");
  if (identity) requireOwner(e, identity);

  const body = parseBody(event);
  const contentType = String(body.contentType ?? "");
  const ext = ALLOWED_IMAGE_EXT[contentType];
  if (!ext) return badRequest("Unsupported image type (use JPEG, PNG or WebP)");

  const key = `media/${eventId}/wallpaper-${newVideoId()}.${ext}`;
  const presigned = await createPresignedPost(s3, {
    Bucket: config.mediaBucket,
    Key: key,
    Conditions: [
      ["content-length-range", 1, MAX_IMAGE_BYTES],
      ["eq", "$Content-Type", contentType],
    ],
    Fields: { "Content-Type": contentType },
    Expires: 600,
  });

  return created({ key, upload: presigned });
}

async function listVideosRoute(eventId: string): Promise<APIGatewayProxyResultV2> {
  const e = await getEvent(eventId);
  if (!e) return notFound("Event not found");
  const videos = (await listVideos(eventId)).map(videoToDTO);
  return ok({ event: eventToDTO(e), videos });
}

async function likeRoute(eventId: string, videoId: string): Promise<APIGatewayProxyResultV2> {
  const v = await getVideo(eventId, videoId);
  if (!v) return notFound("Video not found");
  const likes = await incrementLikes(eventId, videoId);
  return ok({ likes });
}

/** Public: an attendee posts a comment on a video. Name is required. */
async function createComment(
  eventId: string,
  videoId: string,
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
  const v = await getVideo(eventId, videoId);
  if (!v) return notFound("Video not found");

  const body = parseBody(event);
  const author = String(body.author ?? "").trim();
  const text = String(body.text ?? "").trim();
  if (!author) return badRequest("A name is required to comment");
  if (!text) return badRequest("Comment can’t be empty");

  const createdAt = new Date().toISOString();
  const commentId = newCommentId();
  const item: CommentItem = {
    PK: `EVENT#${eventId}`,
    SK: `CMT#${videoId}#${createdAt}#${commentId}`,
    eventId,
    videoId,
    commentId,
    author: author.slice(0, 60),
    text: text.slice(0, 500),
    createdAt,
  };
  await putComment(item);
  return created(commentToDTO(item));
}

async function listVideoCommentsRoute(eventId: string, videoId: string): Promise<APIGatewayProxyResultV2> {
  const comments = (await listVideoComments(eventId, videoId)).map(commentToDTO);
  return ok({ comments });
}

async function listEventCommentsRoute(eventId: string): Promise<APIGatewayProxyResultV2> {
  const comments = (await listEventComments(eventId)).map(commentToDTO);
  return ok({ comments });
}
