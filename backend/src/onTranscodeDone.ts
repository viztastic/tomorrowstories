import type { EventBridgeEvent } from "aws-lambda";
import { config } from "./shared/config.js";
import { setVideoOutcome } from "./shared/db.js";

interface OutputDetail {
  outputFilePaths?: string[];
  durationInMs?: number;
}
interface JobDetail {
  status: string; // COMPLETE | ERROR | ...
  userMetadata?: { eventId?: string; videoId?: string };
  outputGroupDetails?: { outputDetails?: OutputDetail[] }[];
}

// s3://<mediaBucket>/media/... -> media/...
function toKey(uri: string): string {
  const prefix = `s3://${config.mediaBucket}/`;
  return uri.startsWith(prefix) ? uri.slice(prefix.length) : uri;
}

export async function handler(
  event: EventBridgeEvent<"MediaConvert Job State Change", JobDetail>
): Promise<void> {
  const detail = event.detail;
  const eventId = detail.userMetadata?.eventId;
  const videoId = detail.userMetadata?.videoId;
  if (!eventId || !videoId) {
    console.warn("Job state change without metadata", detail.status);
    return;
  }

  if (detail.status !== "COMPLETE") {
    if (detail.status === "ERROR") {
      console.error("Transcode failed for", eventId, videoId);
      await setVideoOutcome(eventId, videoId, { status: "failed" });
    }
    return;
  }

  // Collect all produced file paths, then classify by extension.
  const paths: string[] = [];
  let durationSec: number | undefined;
  for (const g of detail.outputGroupDetails ?? []) {
    for (const o of g.outputDetails ?? []) {
      for (const fp of o.outputFilePaths ?? []) paths.push(fp);
      if (o.durationInMs && !durationSec) durationSec = Math.round(o.durationInMs / 1000);
    }
  }

  const mediaKey = paths.map(toKey).find((k) => k.endsWith(".mp4"));
  const posterKey = paths.map(toKey).find((k) => /\.(jpg|jpeg)$/i.test(k));

  if (!mediaKey) {
    console.error("Completed job produced no MP4", eventId, videoId, paths);
    await setVideoOutcome(eventId, videoId, { status: "failed" });
    return;
  }

  await setVideoOutcome(eventId, videoId, {
    status: "live",
    mediaKey,
    posterKey,
    durationSec,
  });
  console.log("Video live:", eventId, videoId, mediaKey);
}
