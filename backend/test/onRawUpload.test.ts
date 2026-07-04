import { describe, it, expect, beforeEach, vi } from "vitest";
import { mockClient } from "aws-sdk-client-mock";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { MediaConvertClient, CreateJobCommand } from "@aws-sdk/client-mediaconvert";

const ddb = mockClient(DynamoDBDocumentClient);
const mc = mockClient(MediaConvertClient);

const { handler } = await import("../src/onRawUpload.js");

function s3Event(key: string): any {
  return { Records: [{ s3: { object: { key } } }] };
}

beforeEach(() => {
  ddb.reset();
  mc.reset();
});

describe("onRawUpload → MediaConvert", () => {
  it("starts a transcode job for a valid raw key", async () => {
    mc.on(CreateJobCommand).resolves({ Job: { Id: "job-1" } });
    await handler(s3Event("raw/evt1/vid1.mp4"));
    expect(mc.commandCalls(CreateJobCommand)).toHaveLength(1);
    // Success path must NOT touch the video status.
    expect(ddb.commandCalls(UpdateCommand)).toHaveLength(0);
  });

  it("marks the video FAILED (never leaves it spinning) if the job can't start", async () => {
    mc.on(CreateJobCommand).rejects(new Error("BadRequestException: invalid settings"));
    await handler(s3Event("raw/evt1/vid1.mp4"));
    const updates = ddb.commandCalls(UpdateCommand);
    expect(updates).toHaveLength(1);
    expect(updates[0].args[0].input.ExpressionAttributeValues?.[":s"]).toBe("failed");
  });

  it("ignores keys that aren't raw uploads", async () => {
    mc.on(CreateJobCommand).resolves({ Job: { Id: "x" } });
    await handler(s3Event("something/else.txt"));
    expect(mc.commandCalls(CreateJobCommand)).toHaveLength(0);
  });
});
