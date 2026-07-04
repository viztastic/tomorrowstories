import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { S3Client } from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { config, DEFAULT_THEMES } from "./shared/config.js";
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
} from "./shared/db.js";
import { newEventCode, newEventId, newVideoId } from "./shared/ids.js";
import { eventToDTO, videoToDTO } from "./shared/dto.js";
import { badRequest, created, HttpError, json, notFound, ok, serverError } from "./shared/http.js";
import type { EventItem, VideoItem } from "./shared/types.js";

const s3 = new S3Client({ region: config.region });

const MAX_BYTES = 200 * 1024 * 1024; // 200 MB cap on a phone clip
const ALLOWED_EXT: Record<string, string> = {
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
  "video/x-matroska": "mkv",
  "video/3gpp": "3gp",
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
    // GET /admin/events  (shared-secret organizer console)
    if (method === "GET" && event.rawPath === "/admin/events") {
      return await adminList(event);
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
      // POST /events/{eventId}/uploads
      if (method === "POST" && event.rawPath.endsWith("/uploads")) {
        return await createUpload(p.eventId, event);
      }
      // GET /events/{eventId}/videos
      if (method === "GET" && event.rawPath.endsWith("/videos")) {
        return await listVideosRoute(p.eventId);
      }
      // POST /events/{eventId}/videos/{videoId}/like
      if (method === "POST" && p.videoId && event.rawPath.endsWith("/like")) {
        return await likeRoute(p.eventId, p.videoId);
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
  const body = parseBody(event);
  const name = String(body.name ?? "").trim() || "Tomorrow Stories";
  const eventId = newEventId();

  // Pick a short code that isn't already taken (collisions are astronomically
  // rare over 32^6, but check a few times to be safe).
  let code = newEventCode();
  for (let i = 0; i < 5; i++) {
    if (!(await getEventIdByCode(code))) break;
    code = newEventCode();
  }

  const item: EventItem = {
    PK: `EVENT#${eventId}`,
    SK: "META",
    eventId,
    code,
    name: name.slice(0, 80),
    themes: DEFAULT_THEMES,
    createdAt: new Date().toISOString(),
  };
  await putEvent(item);
  await putCodeMapping(code, eventId);
  return created(eventToDTO(item));
}

async function joinByCode(code: string): Promise<APIGatewayProxyResultV2> {
  const eventId = await getEventIdByCode(code);
  if (!eventId) return notFound("No event with that code");
  return ok({ eventId });
}

async function adminList(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  if (!config.adminPassword) return notFound("Admin console is disabled");
  const key = event.headers?.["x-admin-key"] ?? event.queryStringParameters?.key ?? "";
  if (key !== config.adminPassword) return json(401, { error: "Wrong password" });
  const events = (await listAllEvents()).map(eventToDTO);
  return ok({ events });
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
