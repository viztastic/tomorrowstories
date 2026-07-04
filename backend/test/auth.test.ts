import { describe, it, expect, beforeEach, vi } from "vitest";
import { mockClient } from "aws-sdk-client-mock";
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

// Presigned POST + Clerk are the two external deps createEvent/verify touch.
vi.mock("@aws-sdk/s3-presigned-post", () => ({
  createPresignedPost: vi.fn(async () => ({ url: "https://s3", fields: {} })),
}));
vi.mock("@clerk/backend", () => ({
  verifyToken: vi.fn(async (token: string) => {
    if (token === "owner-token") return { sub: "user_owner", email: "o@x.com" };
    if (token === "other-token") return { sub: "user_other" };
    throw new Error("invalid token");
  }),
}));

const ddb = mockClient(DynamoDBDocumentClient);

type EvOpts = { body?: unknown; path?: Record<string, string>; headers?: Record<string, string> };
function ev(method: string, rawPath: string, opts: EvOpts = {}): any {
  return {
    requestContext: { http: { method, sourceIp: "1.2.3.4" } },
    rawPath,
    pathParameters: opts.path ?? {},
    headers: opts.headers ?? {},
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    isBase64Encoded: false,
  };
}
const parse = (res: any) => ({ status: res.statusCode as number, body: JSON.parse(res.body) });

// Import the handler with CLERK_SECRET_KEY set so authEnabled() is true.
async function loadHandler() {
  vi.resetModules();
  vi.stubEnv("CLERK_SECRET_KEY", "sk_test_123");
  const mod = await import("../src/api.js");
  return mod.handler as (e: any) => Promise<any>;
}

const OWNED_EVENT = {
  PK: "EVENT#abc", SK: "META", eventId: "abc", code: "XY12Z3", name: "Demo",
  themes: [{ id: "human", name: "Human & Machine", color: "#8B5CF6" }],
  palette: "aurora", ownerId: "user_owner", createdAt: "2026-07-01T00:00:00Z",
};

beforeEach(() => { ddb.reset(); vi.unstubAllEnvs(); });

describe("organizer auth (Clerk configured)", () => {
  it("rejects event creation without a session token (401)", async () => {
    const handler = await loadHandler();
    const { status } = parse(await handler(ev("POST", "/events", { body: { name: "E" } })));
    expect(status).toBe(401);
  });

  it("creates an event owned by the signed-in organizer", async () => {
    const handler = await loadHandler();
    ddb.on(GetCommand).resolves({}); // no organizer profile yet, code free
    const puts: any[] = [];
    ddb.on(PutCommand).callsFake((input) => { puts.push(input.Item); return {}; });
    ddb.on(UpdateCommand).resolves({});

    const { status, body } = parse(
      await handler(ev("POST", "/events", { headers: { authorization: "Bearer owner-token" }, body: { name: "E" } }))
    );
    expect(status).toBe(201);
    expect(body.eventId).toMatch(/^[0-9a-z]{16}$/);
    // The persisted event carries the owner id + GSI keys (not exposed in the DTO).
    const eventItem = puts.find((i) => i.SK === "META");
    expect(eventItem.ownerId).toBe("user_owner");
    expect(eventItem.GSI1PK).toBe("ORG#user_owner");
  });

  it("forbids a non-owner from deleting someone else's event (403)", async () => {
    const handler = await loadHandler();
    ddb.on(GetCommand).resolves({ Item: OWNED_EVENT });
    const { status } = parse(
      await handler(ev("DELETE", "/events/abc", { path: { eventId: "abc" }, headers: { authorization: "Bearer other-token" } }))
    );
    expect(status).toBe(403);
  });

  it("rejects /me/events without a token (401)", async () => {
    const handler = await loadHandler();
    const { status } = parse(await handler(ev("GET", "/me/events")));
    expect(status).toBe(401);
  });
});
