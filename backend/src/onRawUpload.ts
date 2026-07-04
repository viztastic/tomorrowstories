import type { S3Event } from "aws-lambda";
import { MediaConvertClient, CreateJobCommand } from "@aws-sdk/client-mediaconvert";
import { config } from "./shared/config.js";
import { setVideoOutcome } from "./shared/db.js";

// MediaConvert now offers a single account-agnostic regional endpoint, so we hit
// it directly instead of the legacy (and flaky) DescribeEndpoints discovery.
let cachedClient: MediaConvertClient | null = null;
function mcClient(): MediaConvertClient {
  if (!cachedClient) {
    cachedClient = new MediaConvertClient({
      region: config.region,
      endpoint: `https://mediaconvert.${config.region}.amazonaws.com`,
    });
  }
  return cachedClient;
}

// raw/<eventId>/<videoId>.<ext>  ->  { eventId, videoId }
function parseKey(key: string): { eventId: string; videoId: string } | null {
  const m = /^raw\/([^/]+)\/([^/.]+)\.[^/]+$/.exec(decodeURIComponent(key.replace(/\+/g, " ")));
  return m ? { eventId: m[1], videoId: m[2] } : null;
}

/**
 * Builds a deliberately small, robust MediaConvert job: one 720p H.264 MP4.
 * (No frame-capture poster — that output is a common source of CreateJob
 * validation failures, and the UI already falls back to a gradient still when
 * a poster is absent. Fewer moving parts = fewer ways to get stuck.)
 */
function jobSettings(input: string, outDir: string) {
  return {
    Inputs: [
      {
        FileInput: input,
        AudioSelectors: { "Audio Selector 1": { DefaultSelection: "DEFAULT" as const } },
        VideoSelector: {},
        TimecodeSource: "ZEROBASED" as const,
      },
    ],
    OutputGroups: [
      {
        Name: "MP4",
        OutputGroupSettings: {
          Type: "FILE_GROUP_SETTINGS" as const,
          FileGroupSettings: { Destination: outDir },
        },
        Outputs: [
          {
            NameModifier: "video",
            ContainerSettings: { Container: "MP4" as const, Mp4Settings: {} },
            VideoDescription: {
              Height: 720,
              CodecSettings: {
                Codec: "H_264" as const,
                H264Settings: {
                  RateControlMode: "QVBR" as const,
                  QvbrSettings: { QvbrQualityLevel: 7 },
                  MaxBitrate: 3_000_000,
                },
              },
            },
            AudioDescriptions: [
              {
                CodecSettings: {
                  Codec: "AAC" as const,
                  AacSettings: { Bitrate: 96_000, CodingMode: "CODING_MODE_2_0" as const, SampleRate: 48_000 },
                },
              },
            ],
          },
        ],
      },
    ],
  };
}

export async function handler(event: S3Event): Promise<void> {
  for (const record of event.Records) {
    const key = record.s3.object.key;
    const parsed = parseKey(key);
    if (!parsed) {
      console.warn("Skipping unexpected key", key);
      continue;
    }
    const { eventId, videoId } = parsed;
    const input = `s3://${config.rawBucket}/${key}`;
    const outDir = `s3://${config.mediaBucket}/media/${eventId}/${videoId}/`;

    try {
      const client = mcClient();
      const res = await client.send(
        new CreateJobCommand({
          Role: config.mcRole,
          Queue: config.mcQueue || undefined,
          UserMetadata: { eventId, videoId },
          Settings: jobSettings(input, outDir),
        })
      );
      console.log("Started MediaConvert job", res.Job?.Id, "for", eventId, videoId);
    } catch (err) {
      // Never leave the clip spinning forever — surface a clear failure.
      console.error("Failed to start MediaConvert job for", eventId, videoId, err);
      await setVideoOutcome(eventId, videoId, { status: "failed" }).catch((e) =>
        console.error("Also failed to mark video failed", e)
      );
    }
  }
}
