import { describe, it, expect, beforeEach, vi } from "vitest";
import { mockClient } from "aws-sdk-client-mock";
import { BatchWriteCommand, DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from "@aws-sdk/client-s3";

// Mock the presigned-POST generator so createUpload doesn't hit S3.
vi.mock("@aws-sdk/s3-presigned-post", () => ({
  createPresignedPost: vi.fn(async () => ({ url: "https://raw-bucket.s3.amazonaws.com", fields: { key: "raw/x" } })),
}));

import { handler } from "../src/api.js";
import { hashPassword } from "../src/shared/lock.js";

const ddb = mockClient(DynamoDBDocumentClient);
const s3 = mockClient(S3Client);

type EvOpts = { body?: unknown; path?: Record<string, string>; headers?: Record<string, string> };
function ev(method: string, rawPath: string, opts: EvOpts = {}): any {
  return {
    requestContext: { http: { method } },
    rawPath,
    pathParameters: opts.path ?? {},
    headers: opts.headers ?? {},
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    isBase64Encoded: false,
  };
}

const THEME_EVENT = {
  PK: "EVENT#abc",
  SK: "META",
  eventId: "abc",
  code: "XY12Z3",
  name: "Demo",
  themes: [{ id: "human", name: "Human & Machine", color: "#8B5CF6" }],
  createdAt: "2026-07-01T00:00:00Z",
};

function parse(res: any) {
  return { status: res.statusCode as number, body: JSON.parse(res.body) };
}

beforeEach(() => { ddb.reset(); s3.reset(); });

describe("POST /events", () => {
  it("creates an event and writes both the event and the code mapping", async () => {
    ddb.on(GetCommand).resolves({}); // code-uniqueness check: not taken
    ddb.on(PutCommand).resolves({});

    const { status, body } = parse(await handler(ev("POST", "/events", { body: { name: "My Event" } })));

    expect(status).toBe(201);
    expect(body.eventId).toMatch(/^[0-9a-z]{16}$/);
    expect(body.code).toMatch(/^[0-9A-Z]{6}$/);
    expect(body.attendeeUrl).toContain(`/e/${body.eventId}`);
    // one Put for the event, one for the CODE# mapping
    expect(ddb.commandCalls(PutCommand)).toHaveLength(2);
  });
});

describe("POST /events with custom topics + palette", () => {
  it("stores normalized custom topics and the chosen palette", async () => {
    ddb.on(GetCommand).resolves({}); // code not taken
    const puts: any[] = [];
    ddb.on(PutCommand).callsFake((input) => { puts.push(input); return {}; });

    const { status, body } = parse(
      await handler(
        ev("POST", "/events", {
          body: { name: "E", palette: "rally", themes: [{ name: "Big Ideas", color: "#112233" }] },
        })
      )
    );
    expect(status).toBe(201);
    expect(body.palette).toBe("rally");
    expect(body.themes).toEqual([{ id: "big-ideas", name: "Big Ideas", color: "#112233" }]);
  });

  it("falls back to defaults when palette is unknown and themes are omitted", async () => {
    ddb.on(GetCommand).resolves({});
    ddb.on(PutCommand).resolves({});
    const { body } = parse(await handler(ev("POST", "/events", { body: { name: "E", palette: "bogus" } })));
    expect(body.palette).toBe("aurora");
    expect(body.themes.length).toBe(6);
  });
});

describe("PATCH /events/{id}", () => {
  it("401s without the admin key", async () => {
    const { status } = parse(
      await handler(ev("PATCH", "/events/abc", { path: { eventId: "abc" }, headers: { "x-admin-key": "nope" }, body: { palette: "marine" } }))
    );
    expect(status).toBe(401);
  });

  it("updates palette + topics for an existing event", async () => {
    ddb.on(GetCommand).resolves({ Item: THEME_EVENT });
    ddb.on(QueryCommand).resolves({ Items: [] }); // no videos → removal allowed
    ddb.on(UpdateCommand).resolves({
      Attributes: { ...THEME_EVENT, palette: "marine", themes: [{ id: "new", name: "New", color: "#123456" }] },
    });
    const { status, body } = parse(
      await handler(
        ev("PATCH", "/events/abc", {
          path: { eventId: "abc" },
          headers: { "x-admin-key": "s3cr3t-admin-key" },
          body: { palette: "marine", themes: [{ name: "New", color: "#123456" }] },
        })
      )
    );
    expect(status).toBe(200);
    expect(body.palette).toBe("marine");
  });

  it("rejects removing a topic that still has videos", async () => {
    ddb.on(GetCommand).resolves({ Item: THEME_EVENT }); // has topic "human"
    ddb.on(QueryCommand).resolves({
      Items: [{ eventId: "abc", videoId: "v1", theme: "human", title: "A", author: "M", status: "live", durationSec: 5, likes: 0, rawKey: "r", createdAt: "2026-07-01T00:00:00Z" }],
    });
    const { status, body } = parse(
      await handler(
        ev("PATCH", "/events/abc", {
          path: { eventId: "abc" },
          headers: { "x-admin-key": "s3cr3t-admin-key" },
          body: { themes: [{ name: "Something Else", color: "#123456" }] }, // drops "human"
        })
      )
    );
    expect(status).toBe(400);
    expect(body.error).toMatch(/still has/i);
  });
});

describe("GET /join/{code}", () => {
  it("resolves a known code to its eventId", async () => {
    ddb.on(GetCommand).resolves({ Item: { eventId: "abc" } });
    const { status, body } = parse(await handler(ev("GET", "/join/XY12Z3", { path: { code: "XY12Z3" } })));
    expect(status).toBe(200);
    expect(body.eventId).toBe("abc");
  });

  it("404s an unknown code", async () => {
    ddb.on(GetCommand).resolves({});
    const { status } = parse(await handler(ev("GET", "/join/NOPE12", { path: { code: "NOPE12" } })));
    expect(status).toBe(404);
  });
});

describe("GET /events/{id}/videos", () => {
  it("returns live + processing videos as DTOs", async () => {
    ddb.on(GetCommand).resolves({ Item: THEME_EVENT });
    ddb.on(QueryCommand).resolves({
      Items: [
        { eventId: "abc", videoId: "v1", title: "A", theme: "human", author: "M", status: "live", durationSec: 30, likes: 2, rawKey: "r", mediaKey: "media/abc/v1/v1video.mp4", createdAt: "2026-07-01T00:00:02Z" },
        { eventId: "abc", videoId: "v2", title: "B", theme: "human", author: "N", status: "processing", durationSec: 20, likes: 0, rawKey: "r2", createdAt: "2026-07-01T00:00:01Z" },
      ],
    });

    const { status, body } = parse(await handler(ev("GET", "/events/abc/videos", { path: { eventId: "abc" } })));
    expect(status).toBe(200);
    expect(body.videos).toHaveLength(2);
    expect(body.videos[0].mediaUrl).toContain("https://cdn.example.com/media/abc/v1/");
    expect(body.videos[1].mediaUrl).toBeNull();
  });

  it("404s when the event doesn't exist", async () => {
    ddb.on(GetCommand).resolves({});
    const { status } = parse(await handler(ev("GET", "/events/ghost/videos", { path: { eventId: "ghost" } })));
    expect(status).toBe(404);
  });
});

describe("POST like", () => {
  it("increments and returns the new like count", async () => {
    ddb.on(GetCommand).resolves({ Item: { eventId: "abc", videoId: "v1" } });
    ddb.on(UpdateCommand).resolves({ Attributes: { likes: 5 } });
    const { status, body } = parse(
      await handler(ev("POST", "/events/abc/videos/v1/like", { path: { eventId: "abc", videoId: "v1" } }))
    );
    expect(status).toBe(200);
    expect(body.likes).toBe(5);
  });
});

describe("POST /events/{id}/uploads", () => {
  beforeEach(() => {
    ddb.on(GetCommand).resolves({ Item: THEME_EVENT });
    ddb.on(PutCommand).resolves({});
  });

  it("creates a video record + presigned upload", async () => {
    const { status, body } = parse(
      await handler(
        ev("POST", "/events/abc/uploads", {
          path: { eventId: "abc" },
          body: { title: "My clip", theme: "human", contentType: "video/mp4", durationSec: 40 },
        })
      )
    );
    expect(status).toBe(201);
    expect(body.video.status).toBe("processing");
    expect(body.upload.url).toContain("s3");
  });

  it("rejects a missing title", async () => {
    const { status } = parse(
      await handler(ev("POST", "/events/abc/uploads", { path: { eventId: "abc" }, body: { theme: "human", contentType: "video/mp4" } }))
    );
    expect(status).toBe(400);
  });

  it("rejects an unknown theme", async () => {
    const { status } = parse(
      await handler(ev("POST", "/events/abc/uploads", { path: { eventId: "abc" }, body: { title: "x", theme: "nope", contentType: "video/mp4" } }))
    );
    expect(status).toBe(400);
  });

  it("rejects an unsupported content type", async () => {
    const { status } = parse(
      await handler(ev("POST", "/events/abc/uploads", { path: { eventId: "abc" }, body: { title: "x", theme: "human", contentType: "application/pdf" } }))
    );
    expect(status).toBe(400);
  });
});

describe("GET /admin/events", () => {
  it("401s without the right password", async () => {
    const { status } = parse(await handler(ev("GET", "/admin/events", { headers: { "x-admin-key": "nope" } })));
    expect(status).toBe(401);
  });

  it("returns all sessions with the right password", async () => {
    ddb.on(ScanCommand).resolves({ Items: [THEME_EVENT] });
    const { status, body } = parse(
      await handler(ev("GET", "/admin/events", { headers: { "x-admin-key": "s3cr3t-admin-key" } }))
    );
    expect(status).toBe(200);
    expect(body.events).toHaveLength(1);
    expect(body.events[0].attendeeUrl).toContain("/e/abc");
  });
});

describe("DELETE /events/{id}", () => {
  it("401s without the admin password", async () => {
    const { status } = parse(
      await handler(ev("DELETE", "/events/abc", { path: { eventId: "abc" }, headers: { "x-admin-key": "nope" } }))
    );
    expect(status).toBe(401);
  });

  it("404s a missing event", async () => {
    ddb.on(GetCommand).resolves({});
    const { status } = parse(
      await handler(ev("DELETE", "/events/ghost", { path: { eventId: "ghost" }, headers: { "x-admin-key": "s3cr3t-admin-key" } }))
    );
    expect(status).toBe(404);
  });

  it("deletes the event metadata, its videos, and its raw+media files", async () => {
    ddb.on(GetCommand).resolves({ Item: THEME_EVENT });
    ddb.on(QueryCommand).resolves({
      Items: [
        { eventId: "abc", videoId: "v1", title: "A", theme: "human", author: "M", status: "live", durationSec: 30, likes: 0, rawKey: "media/abc/v1.mov", mediaKey: "media/abc/v1.mov", createdAt: "2026-07-01T00:00:02Z" },
        { eventId: "abc", videoId: "v2", title: "B", theme: "human", author: "N", status: "live", durationSec: 20, likes: 0, rawKey: "media/abc/v2.mov", mediaKey: "media/abc/v2.mov", createdAt: "2026-07-01T00:00:01Z" },
      ],
    });
    ddb.on(BatchWriteCommand).resolves({});
    s3.on(ListObjectsV2Command).resolves({ Contents: [{ Key: "media/abc/v1.mov" }], IsTruncated: false });
    s3.on(DeleteObjectsCommand).resolves({});

    const { status, body } = parse(
      await handler(ev("DELETE", "/events/abc", { path: { eventId: "abc" }, headers: { "x-admin-key": "s3cr3t-admin-key" } }))
    );

    expect(status).toBe(200);
    expect(body.deleted).toBe(true);
    expect(body.videos).toBe(2);
    // one BatchWrite (meta + code + 2 videos = 4 keys, one chunk)
    expect(ddb.commandCalls(BatchWriteCommand).length).toBeGreaterThanOrEqual(1);
    // both prefixes (media/ and raw/) listed + purged
    expect(s3.commandCalls(ListObjectsV2Command).length).toBe(2);
    expect(s3.commandCalls(DeleteObjectsCommand).length).toBe(2);
  });
});

describe("comments", () => {
  const VIDEO = { eventId: "abc", videoId: "v1", title: "A", theme: "human", author: "M", status: "live", durationSec: 5, likes: 0, rawKey: "r", createdAt: "2026-07-01T00:00:00Z" };

  it("adds a comment when name + text are present", async () => {
    ddb.on(GetCommand).resolves({ Item: VIDEO });
    ddb.on(PutCommand).resolves({});
    const { status, body } = parse(
      await handler(ev("POST", "/events/abc/videos/v1/comments", { path: { eventId: "abc", videoId: "v1" }, body: { author: "Sam", text: "Loved this" } }))
    );
    expect(status).toBe(201);
    expect(body.author).toBe("Sam");
    expect(body.text).toBe("Loved this");
    expect(body.videoId).toBe("v1");
  });

  it("rejects a comment with no name (name is required)", async () => {
    ddb.on(GetCommand).resolves({ Item: VIDEO });
    const { status } = parse(
      await handler(ev("POST", "/events/abc/videos/v1/comments", { path: { eventId: "abc", videoId: "v1" }, body: { text: "hi" } }))
    );
    expect(status).toBe(400);
  });

  it("rejects an empty comment", async () => {
    ddb.on(GetCommand).resolves({ Item: VIDEO });
    const { status } = parse(
      await handler(ev("POST", "/events/abc/videos/v1/comments", { path: { eventId: "abc", videoId: "v1" }, body: { author: "Sam", text: "  " } }))
    );
    expect(status).toBe(400);
  });

  it("lists a video's comments", async () => {
    ddb.on(GetCommand).resolves({ Item: THEME_EVENT }); // unlocked event → view gate passes
    ddb.on(QueryCommand).resolves({
      Items: [{ eventId: "abc", videoId: "v1", commentId: "c1", author: "Sam", text: "Nice", createdAt: "2026-07-01T00:00:01Z" }],
    });
    const { status, body } = parse(
      await handler(ev("GET", "/events/abc/videos/v1/comments", { path: { eventId: "abc", videoId: "v1" } }))
    );
    expect(status).toBe(200);
    expect(body.comments).toHaveLength(1);
    expect(body.comments[0].author).toBe("Sam");
  });
});

describe("view lock (password-gated wall)", () => {
  const LOCK = hashPassword("letmein");
  const LOCKED_EVENT = { ...THEME_EVENT, lock: LOCK };

  it("PATCH viewPassword sets the lock and reports locked=true", async () => {
    ddb.on(GetCommand).resolves({ Item: THEME_EVENT });
    ddb.on(UpdateCommand).resolves({ Attributes: { ...THEME_EVENT, lock: LOCK } });
    const { status, body } = parse(
      await handler(
        ev("PATCH", "/events/abc", {
          path: { eventId: "abc" },
          headers: { "x-admin-key": "s3cr3t-admin-key" },
          body: { viewPassword: "letmein" },
        })
      )
    );
    expect(status).toBe(200);
    expect(body.locked).toBe(true);
  });

  it("PATCH rejects a too-short password", async () => {
    ddb.on(GetCommand).resolves({ Item: THEME_EVENT });
    const { status } = parse(
      await handler(
        ev("PATCH", "/events/abc", {
          path: { eventId: "abc" },
          headers: { "x-admin-key": "s3cr3t-admin-key" },
          body: { viewPassword: "ab" },
        })
      )
    );
    expect(status).toBe(400);
  });

  it("blocks GET /events/{id}/videos with 401 locked when no token is sent", async () => {
    ddb.on(GetCommand).resolves({ Item: LOCKED_EVENT });
    const { status, body } = parse(
      await handler(ev("GET", "/events/abc/videos", { path: { eventId: "abc" } }))
    );
    expect(status).toBe(401);
    expect(body.locked).toBe(true);
  });

  it("blocks GET /events/{id} with 401 locked when no token is sent", async () => {
    ddb.on(GetCommand).resolves({ Item: LOCKED_EVENT });
    const { status, body } = parse(
      await handler(ev("GET", "/events/abc", { path: { eventId: "abc" } }))
    );
    expect(status).toBe(401);
    expect(body.locked).toBe(true);
  });

  it("the wrong password is rejected with 401", async () => {
    ddb.on(GetCommand).resolves({ Item: LOCKED_EVENT });
    const { status } = parse(
      await handler(ev("POST", "/events/abc/unlock", { path: { eventId: "abc" }, body: { password: "nope" } }))
    );
    expect(status).toBe(401);
  });

  it("unlock returns a token that opens the wall", async () => {
    ddb.on(GetCommand).resolves({ Item: LOCKED_EVENT });
    ddb.on(QueryCommand).resolves({ Items: [] }); // listVideos → empty

    const unlockRes = parse(
      await handler(ev("POST", "/events/abc/unlock", { path: { eventId: "abc" }, body: { password: "letmein" } }))
    );
    expect(unlockRes.status).toBe(200);
    const token = unlockRes.body.token as string;
    expect(token).toMatch(/^\d+\./);

    const videosRes = parse(
      await handler(ev("GET", "/events/abc/videos", { path: { eventId: "abc" }, headers: { "x-view-token": token } }))
    );
    expect(videosRes.status).toBe(200);
    expect(Array.isArray(videosRes.body.videos)).toBe(true);
  });

  it("a stale/garbage token is still refused", async () => {
    ddb.on(GetCommand).resolves({ Item: LOCKED_EVENT });
    const { status, body } = parse(
      await handler(ev("GET", "/events/abc/videos", { path: { eventId: "abc" }, headers: { "x-view-token": "0.deadbeef" } }))
    );
    expect(status).toBe(401);
    expect(body.locked).toBe(true);
  });

  it("PATCH viewPassword:null removes the lock (re-opens the wall)", async () => {
    ddb.on(GetCommand).resolves({ Item: LOCKED_EVENT });
    ddb.on(UpdateCommand).resolves({ Attributes: { ...THEME_EVENT } }); // lock gone
    const { status, body } = parse(
      await handler(
        ev("PATCH", "/events/abc", {
          path: { eventId: "abc" },
          headers: { "x-admin-key": "s3cr3t-admin-key" },
          body: { viewPassword: null },
        })
      )
    );
    expect(status).toBe(200);
    expect(body.locked).toBe(false);
  });

  it("an event with no lock stays open (no token needed)", async () => {
    ddb.on(GetCommand).resolves({ Item: THEME_EVENT });
    ddb.on(QueryCommand).resolves({ Items: [] });
    const { status } = parse(
      await handler(ev("GET", "/events/abc/videos", { path: { eventId: "abc" } }))
    );
    expect(status).toBe(200);
  });

  it("gates the comments route too (no videoId leak from a locked event)", async () => {
    ddb.on(GetCommand).resolves({ Item: LOCKED_EVENT });
    const { status, body } = parse(
      await handler(ev("GET", "/events/abc/comments", { path: { eventId: "abc" } }))
    );
    expect(status).toBe(401);
    expect(body.locked).toBe(true);
  });
});

describe("routing", () => {
  it("CORS preflight returns 204", async () => {
    const res: any = await handler(ev("OPTIONS", "/events"));
    expect(res.statusCode).toBe(204);
  });

  it("unknown route returns 404", async () => {
    const { status } = parse(await handler(ev("GET", "/nonsense")));
    expect(status).toBe(404);
  });
});
