import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  BatchWriteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { config } from "./config.js";
import { DEFAULT_PLAN } from "./plans.js";
import type { CommentItem, EventItem, OrganizerItem, VideoItem } from "./types.js";

const doc = DynamoDBDocumentClient.from(new DynamoDBClient({ region: config.region }), {
  marshallOptions: { removeUndefinedValues: true },
});

const eventPK = (eventId: string) => `EVENT#${eventId}`;
const videoSK = (videoId: string) => `VIDEO#${videoId}`;
const orgPK = (userId: string) => `ORG#${userId}`;

/** GSI1 (owner → their events, newest first). Callers stamp these on the event. */
export const ownerGsiKeys = (ownerId: string, createdAt: string, eventId: string) => ({
  GSI1PK: orgPK(ownerId),
  GSI1SK: `${createdAt}#${eventId}`,
});

export async function putEvent(event: EventItem): Promise<void> {
  await doc.send(new PutCommand({ TableName: config.tableName, Item: event }));
}

const codePK = (code: string) => `CODE#${code.toUpperCase()}`;

/** Store a short-code → eventId lookup so people can join by typing the code. */
export async function putCodeMapping(code: string, eventId: string): Promise<void> {
  await doc.send(
    new PutCommand({
      TableName: config.tableName,
      Item: { PK: codePK(code), SK: "CODE", eventId, createdAt: new Date().toISOString() },
    })
  );
}

/** Resolve a short code to its eventId (null if unknown). */
export async function getEventIdByCode(code: string): Promise<string | null> {
  const res = await doc.send(
    new GetCommand({ TableName: config.tableName, Key: { PK: codePK(code), SK: "CODE" } })
  );
  return (res.Item?.eventId as string) ?? null;
}

export async function getEvent(eventId: string): Promise<EventItem | null> {
  const res = await doc.send(
    new GetCommand({
      TableName: config.tableName,
      Key: { PK: eventPK(eventId), SK: "META" },
    })
  );
  return (res.Item as EventItem) ?? null;
}

export async function putVideo(video: VideoItem): Promise<void> {
  await doc.send(new PutCommand({ TableName: config.tableName, Item: video }));
}

export async function getVideo(eventId: string, videoId: string): Promise<VideoItem | null> {
  const res = await doc.send(
    new GetCommand({
      TableName: config.tableName,
      Key: { PK: eventPK(eventId), SK: videoSK(videoId) },
    })
  );
  return (res.Item as VideoItem) ?? null;
}

// ------------------------------------------------------------- organizers

export async function getOrganizer(userId: string): Promise<OrganizerItem | null> {
  const res = await doc.send(
    new GetCommand({ TableName: config.tableName, Key: { PK: orgPK(userId), SK: "PROFILE" } })
  );
  return (res.Item as OrganizerItem) ?? null;
}

/**
 * Get the organizer profile, creating it on first sight (default free plan).
 * Idempotent — a concurrent create just overwrites with identical defaults.
 */
export async function ensureOrganizer(userId: string, email?: string): Promise<OrganizerItem> {
  const existing = await getOrganizer(userId);
  if (existing) return existing;
  const item: OrganizerItem = {
    PK: orgPK(userId),
    SK: "PROFILE",
    organizerId: userId,
    email,
    plan: DEFAULT_PLAN,
    eventsCount: 0,
    createdAt: new Date().toISOString(),
  };
  await doc.send(new PutCommand({ TableName: config.tableName, Item: item }));
  return item;
}

/** Atomically adjust an organizer's owned-event counter (never below 0). */
export async function bumpOrganizerEvents(userId: string, delta: number): Promise<void> {
  await doc.send(
    new UpdateCommand({
      TableName: config.tableName,
      Key: { PK: orgPK(userId), SK: "PROFILE" },
      UpdateExpression: "SET eventsCount = if_not_exists(eventsCount, :z) + :d",
      ExpressionAttributeValues: { ":d": delta, ":z": 0 },
    })
  );
}

/** An organizer's own events, newest first, via GSI1 (no full-table scan). */
export async function listMyEvents(ownerId: string): Promise<EventItem[]> {
  const items: EventItem[] = [];
  let ExclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const res = await doc.send(
      new QueryCommand({
        TableName: config.tableName,
        IndexName: "GSI1",
        KeyConditionExpression: "GSI1PK = :pk",
        ExpressionAttributeValues: { ":pk": orgPK(ownerId) },
        ScanIndexForward: false, // GSI1SK starts with createdAt → newest first
        ExclusiveStartKey,
      })
    );
    items.push(...((res.Items as EventItem[]) ?? []));
    ExclusiveStartKey = res.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (ExclusiveStartKey);
  return items;
}

/** Every event (super-admin console). Scans for META items — fine at conference scale. */
export async function listAllEvents(): Promise<EventItem[]> {
  const items: EventItem[] = [];
  let ExclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const res = await doc.send(
      new ScanCommand({
        TableName: config.tableName,
        FilterExpression: "SK = :meta",
        ExpressionAttributeValues: { ":meta": "META" },
        ExclusiveStartKey,
      })
    );
    items.push(...((res.Items as EventItem[]) ?? []));
    ExclusiveStartKey = res.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (ExclusiveStartKey);
  return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** All videos for an event, newest first. Single-partition query. */
export async function listVideos(eventId: string): Promise<VideoItem[]> {
  const items: VideoItem[] = [];
  let ExclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const res = await doc.send(
      new QueryCommand({
        TableName: config.tableName,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :v)",
        ExpressionAttributeValues: { ":pk": eventPK(eventId), ":v": "VIDEO#" },
        ExclusiveStartKey,
      })
    );
    items.push(...((res.Items as VideoItem[]) ?? []));
    ExclusiveStartKey = res.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (ExclusiveStartKey);

  return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Mark a video live (or failed) after transcode. */
export async function setVideoOutcome(
  eventId: string,
  videoId: string,
  fields: { status: "live" | "failed"; mediaKey?: string; posterKey?: string; durationSec?: number }
): Promise<void> {
  const sets = ["#s = :s"];
  const names: Record<string, string> = { "#s": "status" };
  const values: Record<string, unknown> = { ":s": fields.status };
  if (fields.mediaKey !== undefined) {
    sets.push("mediaKey = :m");
    values[":m"] = fields.mediaKey;
  }
  if (fields.posterKey !== undefined) {
    sets.push("posterKey = :p");
    values[":p"] = fields.posterKey;
  }
  if (fields.durationSec !== undefined) {
    sets.push("durationSec = :d");
    values[":d"] = fields.durationSec;
  }
  await doc.send(
    new UpdateCommand({
      TableName: config.tableName,
      Key: { PK: eventPK(eventId), SK: videoSK(videoId) },
      UpdateExpression: "SET " + sets.join(", "),
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
    })
  );
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Delete an entire event: every video item, then the META item + short-code
 * mapping LAST. Ordering matters: if a chunk fails after retries we throw, and
 * because META is deleted last the event still resolves and stays re-deletable —
 * never leaving orphaned videos under a vanished event. Batched in chunks of 25
 * (BatchWrite's limit) with exponential backoff on UnprocessedItems.
 */
export async function deleteEvent(
  eventId: string,
  code: string,
  videoIds: string[],
  commentSKs: string[] = []
): Promise<void> {
  const keys: Record<string, string>[] = [
    ...videoIds.map((id) => ({ PK: eventPK(eventId), SK: videoSK(id) })),
    ...commentSKs.map((sk) => ({ PK: eventPK(eventId), SK: sk })),
    { PK: eventPK(eventId), SK: "META" },
    { PK: codePK(code), SK: "CODE" },
  ];
  await batchDelete(keys, `deleteEvent ${eventId}`);
}

/**
 * Delete specific videos (and their comments) from an event, leaving the event
 * itself intact. Used by the organizer's per-story and bulk delete. `videoIds`
 * and `commentSKs` name the exact rows to remove — the caller resolves which
 * comments belong to the deleted videos.
 */
export async function deleteVideos(
  eventId: string,
  videoIds: string[],
  commentSKs: string[] = []
): Promise<void> {
  const keys: Record<string, string>[] = [
    ...videoIds.map((id) => ({ PK: eventPK(eventId), SK: videoSK(id) })),
    ...commentSKs.map((sk) => ({ PK: eventPK(eventId), SK: sk })),
  ];
  if (!keys.length) return;
  await batchDelete(keys, `deleteVideos ${eventId}`);
}

/**
 * BatchWrite a list of primary keys as DeleteRequests, 25 at a time (the
 * BatchWrite limit), retrying UnprocessedItems with exponential backoff. Keys
 * are processed in array order, so callers that need a delete ordering (e.g.
 * event META last) can rely on it.
 */
async function batchDelete(keys: Record<string, string>[], label: string): Promise<void> {
  for (let i = 0; i < keys.length; i += 25) {
    let batch = keys.slice(i, i + 25).map((Key) => ({ DeleteRequest: { Key } }));
    for (let attempt = 0; attempt < 8 && batch.length; attempt++) {
      const res = await doc.send(new BatchWriteCommand({ RequestItems: { [config.tableName]: batch } }));
      batch = (res.UnprocessedItems?.[config.tableName] ?? []) as typeof batch;
      if (batch.length) await sleep(2 ** attempt * 50);
    }
    if (batch.length) throw new Error(`${label}: ${batch.length} item(s) left unprocessed`);
  }
}

/**
 * Patch mutable fields on an event's META item (name / palette / topic buckets).
 * Only provided fields are written. Fails if the event doesn't exist. Returns
 * the full updated item so the caller can DTO it.
 */
export async function updateEvent(
  eventId: string,
  // customPalette: an object sets it; `null` removes it (event reverts to a
  // named palette); undefined leaves it untouched.
  patch: {
    name?: string;
    palette?: string;
    themes?: EventItem["themes"];
    customPalette?: EventItem["customPalette"] | null;
  }
): Promise<EventItem> {
  const sets: string[] = [];
  const removes: string[] = [];
  const names: Record<string, string> = {};
  const values: Record<string, unknown> = {};
  if (patch.name !== undefined) {
    sets.push("#n = :n");
    names["#n"] = "name";
    values[":n"] = patch.name;
  }
  if (patch.palette !== undefined) {
    sets.push("palette = :p");
    values[":p"] = patch.palette;
  }
  if (patch.themes !== undefined) {
    sets.push("themes = :t");
    values[":t"] = patch.themes;
  }
  if (patch.customPalette === null) {
    removes.push("customPalette");
  } else if (patch.customPalette !== undefined) {
    sets.push("customPalette = :cp");
    values[":cp"] = patch.customPalette;
  }
  const clauses = [sets.length ? "SET " + sets.join(", ") : "", removes.length ? "REMOVE " + removes.join(", ") : ""]
    .filter(Boolean)
    .join(" ");
  const res = await doc.send(
    new UpdateCommand({
      TableName: config.tableName,
      Key: { PK: eventPK(eventId), SK: "META" },
      UpdateExpression: clauses,
      ExpressionAttributeNames: Object.keys(names).length ? names : undefined,
      ExpressionAttributeValues: Object.keys(values).length ? values : undefined,
      ConditionExpression: "attribute_exists(PK)",
      ReturnValues: "ALL_NEW",
    })
  );
  return res.Attributes as EventItem;
}

/** Atomic like increment; returns the new total. */
export async function incrementLikes(eventId: string, videoId: string): Promise<number> {
  const res = await doc.send(
    new UpdateCommand({
      TableName: config.tableName,
      Key: { PK: eventPK(eventId), SK: videoSK(videoId) },
      UpdateExpression: "SET likes = if_not_exists(likes, :z) + :one",
      ExpressionAttributeValues: { ":one": 1, ":z": 0 },
      ConditionExpression: "attribute_exists(PK)",
      ReturnValues: "UPDATED_NEW",
    })
  );
  return (res.Attributes?.likes as number) ?? 0;
}

// ---------------------------------------------------------------- comments
// Comments live in the event partition under SK = CMT#<videoId>#<createdAt>#<id>,
// so a single-partition query returns them oldest-first (natural reading order).

export async function putComment(c: CommentItem): Promise<void> {
  await doc.send(new PutCommand({ TableName: config.tableName, Item: c }));
}

/** Query helper shared by the per-video and whole-event comment reads. */
async function queryComments(eventId: string, skPrefix: string): Promise<CommentItem[]> {
  const items: CommentItem[] = [];
  let ExclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const res = await doc.send(
      new QueryCommand({
        TableName: config.tableName,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
        ExpressionAttributeValues: { ":pk": eventPK(eventId), ":sk": skPrefix },
        ExclusiveStartKey,
      })
    );
    items.push(...((res.Items as CommentItem[]) ?? []));
    ExclusiveStartKey = res.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (ExclusiveStartKey);
  return items; // SK sort → oldest first
}

/** Comments on one video, oldest first. */
export function listVideoComments(eventId: string, videoId: string): Promise<CommentItem[]> {
  return queryComments(eventId, `CMT#${videoId}#`);
}

/** Every comment in an event (for the archive export). */
export function listEventComments(eventId: string): Promise<CommentItem[]> {
  return queryComments(eventId, "CMT#");
}
