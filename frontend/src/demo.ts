// In-memory "backend" for demo mode (VITE_DEMO=1 or no /config.json). Lets the
// whole app run with no AWS — mirrors the seeded feel of the original prototype.

import type { CommentDTO, EventDTO, Theme, VideoDTO } from "./types";
import { THEMES } from "./design";
import { DEFAULT_PALETTE_ID } from "./palettes";
import { LockedError } from "./errors";

interface DemoEvent {
  event: EventDTO;
  videos: VideoDTO[];
  comments: CommentDTO[];
  password?: string; // plaintext is fine — demo store is in-memory only
}

const store = new Map<string, DemoEvent>();
// Events unlocked for this browser session (mirrors the real view-token flow).
const unlocked = new Set<string>();

/** Throw the same locked signal a real 401 would, unless unlocked this session. */
function gate(e: DemoEvent): void {
  if (e.password && !unlocked.has(e.event.eventId)) throw new LockedError();
}

const SEED: Omit<VideoDTO, "status" | "mediaUrl" | "posterUrl">[] = [
  { id: "1", theme: "human", author: "Maya Chen", title: "Teaching my grandma to talk to AI", durationSec: 52, likes: 2140, createdAt: "2026-07-01T13:58:00Z" },
  { id: "2", theme: "green", author: "Diego Alvarez", title: "The office that grows its own food", durationSec: 47, likes: 980, createdAt: "2026-07-01T13:55:00Z" },
  { id: "3", theme: "work", author: "Priya Nair", title: "Why I fired my calendar", durationSec: 38, likes: 412, createdAt: "2026-07-01T14:00:00Z" },
  { id: "4", theme: "create", author: "Sam Okoro", title: "Painting with sound waves", durationSec: 59, likes: 1520, createdAt: "2026-07-01T13:52:00Z" },
  { id: "5", theme: "health", author: "Lena Fischer", title: "My 90-year-old climbing coach", durationSec: 44, likes: 3010, createdAt: "2026-07-01T13:48:00Z" },
  { id: "6", theme: "city", author: "Tomas Rivera", title: "The bench that started a neighborhood", durationSec: 41, likes: 760, createdAt: "2026-07-01T13:45:00Z" },
  { id: "7", theme: "human", author: "Aisha Bello", title: "When the robot said no", durationSec: 55, likes: 620, createdAt: "2026-07-01T14:00:00Z" },
  { id: "8", theme: "green", author: "Erik Sund", title: "Concrete that eats carbon", durationSec: 50, likes: 1180, createdAt: "2026-07-01T13:42:00Z" },
  { id: "9", theme: "work", author: "Jordan Lee", title: "We work 4 hours. Here is how.", durationSec: 36, likes: 540, createdAt: "2026-07-01T14:00:00Z" },
  { id: "10", theme: "create", author: "Nina Volkova", title: "A font made from my heartbeat", durationSec: 48, likes: 2260, createdAt: "2026-07-01T13:38:00Z" },
  { id: "11", theme: "health", author: "Omar Haddad", title: "Prescribing forests, not pills", durationSec: 57, likes: 1890, createdAt: "2026-07-01T13:34:00Z" },
  { id: "12", theme: "city", author: "Grace Kim", title: "Turning a highway into a river", durationSec: 53, likes: 1340, createdAt: "2026-07-01T13:30:00Z" },
  { id: "13", theme: "human", author: "Ben Carter", title: "My AI co-founder quit", durationSec: 42, likes: 880, createdAt: "2026-07-01T13:26:00Z" },
  { id: "14", theme: "create", author: "Yuki Tanaka", title: "Dancing with a drone", durationSec: 39, likes: 1010, createdAt: "2026-07-01T14:00:00Z" },
  { id: "15", theme: "work", author: "Sofia Marin", title: "The meeting that became a walk", durationSec: 45, likes: 690, createdAt: "2026-07-01T13:20:00Z" },
];

function seedVideos(): VideoDTO[] {
  return SEED.map((v) => ({ ...v, status: "live", mediaUrl: null, posterUrl: null }));
}

function rid(n: number): string {
  const a = "0123456789abcdefghjkmnpqrstvwxyz";
  let s = "";
  for (let i = 0; i < n; i++) s += a[Math.floor(Math.random() * a.length)];
  return s;
}

function makeEvent(eventId: string, name: string, opts: { palette?: string; themes?: Theme[] } = {}): DemoEvent {
  const event: EventDTO = {
    eventId,
    code: rid(6).toUpperCase(),
    name,
    themes: opts.themes?.length ? opts.themes : THEMES,
    palette: opts.palette ?? DEFAULT_PALETTE_ID,
    attendeeUrl: `${location.origin}/e/${eventId}`,
    bigScreenUrl: `${location.origin}/e/${eventId}/big`,
    createdAt: new Date().toISOString(),
    locked: false,
  };
  return { event, videos: seedVideos(), comments: [] };
}

function ensure(eventId: string): DemoEvent {
  let e = store.get(eventId);
  if (!e) {
    e = makeEvent(eventId, eventId === "demo" ? "Tomorrow Stories" : "Demo Conference");
    store.set(eventId, e);
  }
  return e;
}

export const demo = {
  createEvent(name: string, opts: { palette?: string; themes?: Theme[] } = {}): EventDTO {
    const eventId = rid(16);
    const e = makeEvent(eventId, name || "Tomorrow Stories", opts);
    store.set(eventId, e);
    return e.event;
  },
  updateEvent(eventId: string, patch: { name?: string; palette?: string; themes?: Theme[]; viewPassword?: string | null }): EventDTO {
    const e = ensure(eventId);
    if (patch.name !== undefined) e.event.name = patch.name;
    if (patch.palette !== undefined) e.event.palette = patch.palette;
    if (patch.themes !== undefined) e.event.themes = patch.themes;
    if (patch.viewPassword !== undefined) {
      if (patch.viewPassword === null || patch.viewPassword === "") {
        e.password = undefined;
        unlocked.delete(eventId);
      } else {
        e.password = patch.viewPassword;
      }
      e.event.locked = !!e.password;
    }
    return e.event;
  },
  /** Verify a locked event's password; returns a placeholder token on success. */
  unlock(eventId: string, password: string): string {
    const e = ensure(eventId);
    if (e.password && password !== e.password) throw new Error("Incorrect password");
    unlocked.add(eventId);
    return "demo-view-token";
  },
  getEvent(eventId: string): EventDTO {
    const e = ensure(eventId);
    gate(e);
    return e.event;
  },
  resolveCode(code: string): string {
    const up = code.toUpperCase();
    for (const e of store.values()) if (e.event.code === up) return e.event.eventId;
    throw new Error("No event with that code");
  },
  listAllEvents(): EventDTO[] {
    ensure("demo"); // make sure there's always at least the sample session
    return [...store.values()].map((e) => e.event);
  },
  listVideos(eventId: string): { event: EventDTO; videos: VideoDTO[] } {
    const e = ensure(eventId);
    gate(e);
    return { event: e.event, videos: e.videos };
  },
  addVideo(eventId: string, meta: { title: string; theme: string; author: string; durationSec: number }): VideoDTO {
    const e = ensure(eventId);
    const v: VideoDTO = {
      id: rid(10),
      title: meta.title,
      theme: meta.theme,
      author: meta.author || "You",
      status: "live",
      durationSec: meta.durationSec || 47,
      likes: 0,
      mediaUrl: null,
      posterUrl: null,
      createdAt: new Date().toISOString(),
    };
    e.videos = [v, ...e.videos];
    return v;
  },
  like(eventId: string, videoId: string): number {
    const e = ensure(eventId);
    const v = e.videos.find((x) => x.id === videoId);
    if (v) v.likes += 1;
    return v?.likes ?? 0;
  },
  listComments(eventId: string, videoId: string): CommentDTO[] {
    return ensure(eventId).comments.filter((c) => c.videoId === videoId);
  },
  addComment(eventId: string, videoId: string, c: { author: string; text: string }): CommentDTO {
    const e = ensure(eventId);
    const comment: CommentDTO = { id: rid(8), videoId, author: c.author, text: c.text, createdAt: new Date().toISOString() };
    e.comments = [...e.comments, comment];
    return comment;
  },
  listEventComments(eventId: string): CommentDTO[] {
    return ensure(eventId).comments;
  },
  deleteEvent(eventId: string): void {
    store.delete(eventId);
  },
};
