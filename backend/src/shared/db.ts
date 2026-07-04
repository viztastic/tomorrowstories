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
import type { EventItem, VideoItem } from "./types.js";

const doc = DynamoDBDocumentClient.from(new DynamoDBClient({ region: config.region }), {
  marshallOptions: { removeUndefinedValues: true },
});

const eventPK = (eventId: string) => `EVENT#${eventId}`;
const videoSK = (videoId: string) => `VIDEO#${videoId}`;

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

/** Every event (admin console). Scans for META items — fine at conference scale. */
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
export async function deleteEvent(eventId: string, code: string, videoIds: string[]): Promise<void> {
  const keys: Record<string, string>[] = [
    ...videoIds.map((id) => ({ PK: eventPK(eventId), SK: videoSK(id) })),
    { PK: eventPK(eventId), SK: "META" },
    { PK: codePK(code), SK: "CODE" },
  ];
  for (let i = 0; i < keys.length; i += 25) {
    let batch = keys.slice(i, i + 25).map((Key) => ({ DeleteRequest: { Key } }));
    for (let attempt = 0; attempt < 8 && batch.length; attempt++) {
      const res = await doc.send(new BatchWriteCommand({ RequestItems: { [config.tableName]: batch } }));
      batch = (res.UnprocessedItems?.[config.tableName] ?? []) as typeof batch;
      if (batch.length) await sleep(2 ** attempt * 50);
    }
    if (batch.length) throw new Error(`deleteEvent: ${batch.length} item(s) left unprocessed for ${eventId}`);
  }
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
