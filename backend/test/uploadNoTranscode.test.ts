import { describe, it, expect, beforeEach, vi } from "vitest";
import { mockClient } from "aws-sdk-client-mock";
import { DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";

// Presign echoes the bucket/key so we can assert the target.
vi.mock("@aws-sdk/s3-presigned-post", () => ({
  createPresignedPost: vi.fn(async (_c: unknown, args: { Bucket: string; Key: string }) => ({
    url: `https://${args.Bucket}.s3.amazonaws.com`,
    fields: { key: args.Key, "Content-Type": "video/mp4" },
  })),
}));

// Force TRANSCODE=off via a mocked config.
vi.mock("../src/shared/config.js", () => ({
  config: {
    region: "ap-southeast-2",
    tableName: "T",
    rawBucket: "raw-bucket",
    mediaBucket: "media-bucket",
    mediaBaseUrl: "https://cdn.example.com",
    siteBaseUrl: "https://app.example.com",
    mcRole: "",
    mcQueue: "",
    adminPassword: "",
    transcode: false,
  },
  DEFAULT_THEMES: [{ id: "human", name: "Human & Machine", color: "#8B5CF6" }],
}));

const { handler } = await import("../src/api.js");
const ddb = mockClient(DynamoDBDocumentClient);

const EVENT = {
  PK: "EVENT#abc",
  SK: "META",
  eventId: "abc",
  code: "X",
  name: "D",
  themes: [{ id: "human", name: "Human & Machine", color: "#8B5CF6" }],
  createdAt: "2026-07-01T00:00:00Z",
};

function ev(body: unknown): any {
  return {
    requestContext: { http: { method: "POST" } },
    rawPath: "/events/abc/uploads",
    pathParameters: { eventId: "abc" },
    headers: {},
    body: JSON.stringify(body),
    isBase64Encoded: false,
  };
}

beforeEach(() => {
  ddb.reset();
  ddb.on(GetCommand).resolves({ Item: EVENT });
  ddb.on(PutCommand).resolves({});
});

describe("no-transcode upload (TRANSCODE=off)", () => {
  it("uploads to the media bucket and marks the clip live immediately", async () => {
    const res: any = await handler(ev({ title: "Hi", theme: "human", contentType: "video/mp4", durationSec: 3 }));
    const body = JSON.parse(res.body);
    expect(res.statusCode).toBe(201);
    expect(body.video.status).toBe("live");
    expect(body.video.mediaUrl).toContain("https://cdn.example.com/media/abc/");
    expect(body.upload.url).toContain("media-bucket");
  });
});
