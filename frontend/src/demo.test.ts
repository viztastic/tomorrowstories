import { describe, it, expect } from "vitest";
import { demo } from "./demo";

describe("demo store", () => {
  it("creates an event with a 16-char id and 6-char code", () => {
    const ev = demo.createEvent("My Event");
    expect(ev.eventId).toMatch(/^[0-9a-z]{16}$/);
    expect(ev.code).toMatch(/^[0-9A-Z]{6}$/);
    expect(ev.name).toBe("My Event");
  });

  it("seeds an event with sample stories", () => {
    const ev = demo.createEvent("Seeded");
    const { videos } = demo.listVideos(ev.eventId);
    expect(videos.length).toBeGreaterThan(0);
    expect(videos.every((v) => v.status === "live")).toBe(true);
  });

  it("addVideo prepends a new live story", () => {
    const ev = demo.createEvent("Add");
    const before = demo.listVideos(ev.eventId).videos.length;
    const v = demo.addVideo(ev.eventId, { title: "Mine", theme: "human", author: "You", durationSec: 30 });
    const after = demo.listVideos(ev.eventId).videos;
    expect(after.length).toBe(before + 1);
    expect(after[0].id).toBe(v.id);
    expect(after[0].title).toBe("Mine");
  });

  it("like increments the count", () => {
    const ev = demo.createEvent("Likes");
    const first = demo.listVideos(ev.eventId).videos[0];
    const before = first.likes; // capture before like() mutates the stored object
    const n = demo.like(ev.eventId, first.id);
    expect(n).toBe(before + 1);
  });

  it("resolveCode finds an event by its code, case-insensitively", () => {
    const ev = demo.createEvent("Code");
    expect(demo.resolveCode(ev.code)).toBe(ev.eventId);
    expect(demo.resolveCode(ev.code.toLowerCase())).toBe(ev.eventId);
  });

  it("resolveCode throws on an unknown code", () => {
    expect(() => demo.resolveCode("ZZZZZZ")).toThrow();
  });

  it("listAllEvents returns created sessions", () => {
    const ev = demo.createEvent("Admin List Event");
    const all = demo.listAllEvents();
    expect(all.some((e) => e.eventId === ev.eventId)).toBe(true);
    expect(all.every((e) => typeof e.attendeeUrl === "string")).toBe(true);
  });
});

describe("demo store — view lock", () => {
  it("locks reads once a password is set and unlocks with the right one", () => {
    const ev = demo.createEvent("Lockable");
    const updated = demo.updateEvent(ev.eventId, { viewPassword: "pw12" });
    expect(updated.locked).toBe(true);

    expect(() => demo.listVideos(ev.eventId)).toThrow();
    demo.unlock(ev.eventId, "pw12");
    expect(demo.listVideos(ev.eventId).videos.length).toBeGreaterThan(0);
  });

  it("rejects the wrong password", () => {
    const ev = demo.createEvent("Lockable2");
    demo.updateEvent(ev.eventId, { viewPassword: "pw12" });
    expect(() => demo.unlock(ev.eventId, "nope")).toThrow(/incorrect/i);
  });

  it("removing the password re-opens the wall", () => {
    const ev = demo.createEvent("Lockable3");
    demo.updateEvent(ev.eventId, { viewPassword: "pw12" });
    demo.updateEvent(ev.eventId, { viewPassword: null });
    expect(demo.updateEvent(ev.eventId, {}).locked).toBe(false);
    expect(() => demo.listVideos(ev.eventId)).not.toThrow();
  });
});
