import { describe, it, expect } from "vitest";
import { eventToDTO, videoToDTO } from "../src/shared/dto.js";
import type { EventItem, VideoItem } from "../src/shared/types.js";

const baseEvent: EventItem = {
  PK: "EVENT#abc",
  SK: "META",
  eventId: "abc",
  code: "XY12Z3",
  name: "Demo",
  themes: [{ id: "human", name: "Human & Machine", color: "#8B5CF6" }],
  createdAt: "2026-07-01T00:00:00Z",
};

describe("eventToDTO", () => {
  it("builds attendee + big-screen URLs from SITE_BASE_URL", () => {
    const dto = eventToDTO(baseEvent);
    expect(dto.attendeeUrl).toBe("https://app.example.com/e/abc");
    expect(dto.bigScreenUrl).toBe("https://app.example.com/e/abc/big");
    expect(dto.code).toBe("XY12Z3");
  });
});

describe("videoToDTO", () => {
  const base: VideoItem = {
    PK: "EVENT#abc",
    SK: "VIDEO#v1",
    eventId: "abc",
    videoId: "v1",
    title: "Hi",
    theme: "human",
    author: "Maya",
    status: "processing",
    durationSec: 30,
    likes: 3,
    rawKey: "raw/abc/v1.mp4",
    createdAt: "2026-07-01T00:00:00Z",
  };

  it("has null media/poster URLs while processing", () => {
    const dto = videoToDTO(base);
    expect(dto.mediaUrl).toBeNull();
    expect(dto.posterUrl).toBeNull();
    expect(dto.status).toBe("processing");
  });

  it("builds media/poster URLs from MEDIA_BASE_URL once transcoded", () => {
    const dto = videoToDTO({
      ...base,
      status: "live",
      mediaKey: "media/abc/v1/v1video.mp4",
      posterKey: "media/abc/v1/v1poster.0000000.jpg",
    });
    expect(dto.mediaUrl).toBe("https://cdn.example.com/media/abc/v1/v1video.mp4");
    expect(dto.posterUrl).toBe("https://cdn.example.com/media/abc/v1/v1poster.0000000.jpg");
  });
});
