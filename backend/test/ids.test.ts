import { describe, it, expect } from "vitest";
import { newEventId, newEventCode, newVideoId } from "../src/shared/ids.js";

describe("id generation", () => {
  it("event id is 16 lowercase base32 chars", () => {
    const id = newEventId();
    expect(id).toHaveLength(16);
    expect(id).toMatch(/^[0-9a-hjkmnp-tv-z]{16}$/); // Crockford base32, lowercased
  });

  it("event code is 6 uppercase base32 chars", () => {
    const code = newEventCode();
    expect(code).toHaveLength(6);
    expect(code).toMatch(/^[0-9A-HJKMNP-TV-Z]{6}$/);
  });

  it("video id is 10 lowercase chars", () => {
    expect(newVideoId()).toMatch(/^[0-9a-hjkmnp-tv-z]{10}$/);
  });

  it("event ids are effectively unique", () => {
    const set = new Set(Array.from({ length: 2000 }, () => newEventId()));
    expect(set.size).toBe(2000);
  });
});
