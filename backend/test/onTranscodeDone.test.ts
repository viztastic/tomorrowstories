import { describe, it, expect, beforeEach } from "vitest";
import { mockClient } from "aws-sdk-client-mock";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const ddb = mockClient(DynamoDBDocumentClient);
const { handler } = await import("../src/onTranscodeDone.js");

function jobEvent(status: string, paths: string[], durationInMs?: number): any {
  return {
    detail: {
      status,
      userMetadata: { eventId: "evt1", videoId: "vid1" },
      outputGroupDetails: [{ outputDetails: [{ outputFilePaths: paths, durationInMs }] }],
    },
  };
}

beforeEach(() => {
  ddb.reset();
  ddb.on(UpdateCommand).resolves({});
});

describe("onTranscodeDone", () => {
  it("marks the video LIVE with its media key on COMPLETE", async () => {
    await handler(jobEvent("COMPLETE", ["s3://media-bucket/media/evt1/vid1/vid1video.mp4"], 2000));
    const u = ddb.commandCalls(UpdateCommand);
    expect(u).toHaveLength(1);
    const vals = u[0].args[0].input.ExpressionAttributeValues!;
    expect(vals[":s"]).toBe("live");
    expect(vals[":m"]).toBe("media/evt1/vid1/vid1video.mp4");
    expect(vals[":d"]).toBe(2); // durationInMs → seconds
  });

  it("marks the video FAILED on ERROR", async () => {
    await handler(jobEvent("ERROR", []));
    const u = ddb.commandCalls(UpdateCommand);
    expect(u).toHaveLength(1);
    expect(u[0].args[0].input.ExpressionAttributeValues![":s"]).toBe("failed");
  });

  it("marks FAILED if a completed job somehow produced no MP4", async () => {
    await handler(jobEvent("COMPLETE", ["s3://media-bucket/media/evt1/vid1/vid1poster.0000000.jpg"]));
    const u = ddb.commandCalls(UpdateCommand);
    expect(u).toHaveLength(1);
    expect(u[0].args[0].input.ExpressionAttributeValues![":s"]).toBe("failed");
  });

  it("ignores unrelated status changes (still PROGRESSING)", async () => {
    await handler(jobEvent("PROGRESSING", []));
    expect(ddb.commandCalls(UpdateCommand)).toHaveLength(0);
  });
});
