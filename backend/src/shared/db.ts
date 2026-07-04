import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
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
