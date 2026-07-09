import { DEMO, getApiUrl } from "./config";
import { demo } from "./demo";
import type { CommentDTO, CustomPalette, EventDTO, Theme, VideoDTO } from "./types";

/** Organizer-editable event settings (create options + PATCH body).
 *  customPalette: an object switches the event to a custom skin; `null` clears it
 *  (revert to the named `palette`); undefined leaves it untouched. */
export interface EventSettings {
  name?: string;
  palette?: string;
  themes?: Theme[];
  customPalette?: CustomPalette | null;
}

/** The API stores the wallpaper as an S3 key; the client renders it from a URL.
 *  On the wire we send the key: a fresh upload carries it explicitly, otherwise
 *  we recover it from the CDN URL's path (media/<eventId>/wallpaper-*). A blob:
 *  preview URL yields no `media/` key, so it's dropped rather than sent. */
function toCustomPaletteBody(cp: CustomPalette | null | undefined) {
  if (cp == null) return cp; // null clears it; undefined is dropped by JSON.stringify
  let wallpaperKey = cp.wallpaperKey;
  if (!wallpaperKey && cp.wallpaper) {
    try {
      wallpaperKey = new URL(cp.wallpaper).pathname.replace(/^\//, "") || undefined;
    } catch {
      wallpaperKey = undefined;
    }
  }
  if (wallpaperKey && !wallpaperKey.startsWith("media/")) wallpaperKey = undefined;
  return { page: cp.page, stage: cp.stage, qr: cp.qr, accent: cp.accent, wallpaperKey };
}

export interface PresignedPost {
  url: string;
  fields: Record<string, string>;
}

export interface UploadMeta {
  title: string;
  theme: string;
  author: string;
  durationSec: number;
  contentType: string;
}

// The auth layer registers a getter that returns the current Clerk session
// token (or null). Kept as a module-level hook so api calls don't each need it
// threaded through. See auth.tsx.
let tokenGetter: (() => Promise<string | null>) | null = null;
export function setTokenGetter(fn: (() => Promise<string | null>) | null) {
  tokenGetter = fn;
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const base = await getApiUrl();
  if (!base) throw new Error("No API configured");
  const token = tokenGetter ? await tokenGetter() : null;
  const res = await fetch(base + path, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error || `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  async createEvent(name: string, opts: { palette?: string; themes?: Theme[] } = {}): Promise<EventDTO> {
    if (DEMO || !(await getApiUrl())) return demo.createEvent(name, opts);
    // undefined palette/themes are dropped by JSON.stringify, so the backend
    // falls back to its defaults — an organizer who doesn't customize is unchanged.
    return req<EventDTO>("/events", {
      method: "POST",
      body: JSON.stringify({ name, palette: opts.palette, themes: opts.themes }),
    });
  },

  /** Organizer: edit an event's name / palette / topic buckets (Bearer session). */
  async updateEvent(eventId: string, patch: EventSettings): Promise<EventDTO> {
    if (DEMO || !(await getApiUrl())) return demo.updateEvent(eventId, patch);
    const body = {
      ...patch,
      // Map the custom palette's wallpaper URL → S3 key for the wire (see above).
      ...(patch.customPalette !== undefined ? { customPalette: toCustomPaletteBody(patch.customPalette) } : {}),
    };
    return req<EventDTO>(`/events/${eventId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },

  /**
   * Organizer: upload a big-screen wallpaper image for a custom palette. Presigns
   * an S3 POST, uploads the file, and returns its durable S3 key (the caller pairs
   * it with a local object URL for preview, and sends the key on save). Bearer
   * session; owner-only on the backend. In demo mode there's no server key.
   */
  async uploadWallpaper(eventId: string, file: File, onProgress?: (pct: number) => void): Promise<string | null> {
    if (DEMO || !(await getApiUrl())) {
      onProgress?.(100);
      return null; // demo: no server round-trip; caller previews via object URL only
    }
    const { key, upload } = await req<{ key: string; upload: PresignedPost }>(
      `/events/${eventId}/wallpaper`,
      { method: "POST", body: JSON.stringify({ contentType: file.type }) }
    );
    await postToS3(upload, file, onProgress);
    return key;
  },

  async getEvent(eventId: string): Promise<EventDTO> {
    if (DEMO || !(await getApiUrl())) return demo.getEvent(eventId);
    return req<EventDTO>(`/events/${eventId}`);
  },

  /** Resolve a short event code (e.g. "NWM08S") to its eventId. */
  async resolveCode(code: string): Promise<string> {
    if (DEMO || !(await getApiUrl())) return demo.resolveCode(code);
    const r = await req<{ eventId: string }>(`/join/${encodeURIComponent(code.toUpperCase())}`);
    return r.eventId;
  },

  /** Organizer: list the events I own (Bearer session; demo returns all). */
  async myEvents(): Promise<EventDTO[]> {
    if (DEMO || !(await getApiUrl())) return demo.listAllEvents();
    const r = await req<{ events: EventDTO[] }>("/me/events");
    return r.events;
  },

  async listVideos(eventId: string): Promise<{ event: EventDTO; videos: VideoDTO[] }> {
    if (DEMO || !(await getApiUrl())) return demo.listVideos(eventId);
    return req<{ event: EventDTO; videos: VideoDTO[] }>(`/events/${eventId}/videos`);
  },

  async like(eventId: string, videoId: string): Promise<number> {
    if (DEMO || !(await getApiUrl())) return demo.like(eventId, videoId);
    const r = await req<{ likes: number }>(`/events/${eventId}/videos/${videoId}/like`, { method: "POST" });
    return r.likes;
  },

  /** Comments on one video, oldest first. */
  async listComments(eventId: string, videoId: string): Promise<CommentDTO[]> {
    if (DEMO || !(await getApiUrl())) return demo.listComments(eventId, videoId);
    const r = await req<{ comments: CommentDTO[] }>(`/events/${eventId}/videos/${videoId}/comments`);
    return r.comments;
  },

  /** Post a comment (name required). */
  async addComment(eventId: string, videoId: string, c: { author: string; text: string }): Promise<CommentDTO> {
    if (DEMO || !(await getApiUrl())) return demo.addComment(eventId, videoId, c);
    return req<CommentDTO>(`/events/${eventId}/videos/${videoId}/comments`, { method: "POST", body: JSON.stringify(c) });
  },

  /** Every comment in an event — used by the archive export. */
  async listEventComments(eventId: string): Promise<CommentDTO[]> {
    if (DEMO || !(await getApiUrl())) return demo.listEventComments(eventId);
    const r = await req<{ comments: CommentDTO[] }>(`/events/${eventId}/comments`);
    return r.comments;
  },

  /** Organizer: delete an event and all its videos + files (Bearer session). */
  async deleteEvent(eventId: string): Promise<void> {
    if (DEMO || !(await getApiUrl())) {
      demo.deleteEvent(eventId);
      return;
    }
    await req<{ deleted: boolean }>(`/events/${eventId}`, { method: "DELETE" });
  },

  /** Organizer: delete a single story (metadata + file) (Bearer session). */
  async deleteVideo(eventId: string, videoId: string): Promise<void> {
    if (DEMO || !(await getApiUrl())) {
      demo.deleteVideos(eventId, [videoId]);
      return;
    }
    await req<{ deleted: number }>(`/events/${eventId}/videos/${videoId}`, { method: "DELETE" });
  },

  /** Organizer: bulk-delete the selected stories. Returns how many were removed. */
  async deleteVideos(eventId: string, videoIds: string[]): Promise<number> {
    if (DEMO || !(await getApiUrl())) return demo.deleteVideos(eventId, videoIds);
    const r = await req<{ deleted: number }>(`/events/${eventId}/videos/delete`, {
      method: "POST",
      body: JSON.stringify({ videoIds }),
    });
    return r.deleted;
  },

  /**
   * Full upload: create the video record + presigned POST, then PUT the file to
   * S3. In demo mode it just registers the clip locally. Returns the new video.
   */
  async upload(
    eventId: string,
    meta: UploadMeta,
    file: File | null,
    onProgress?: (pct: number) => void
  ): Promise<VideoDTO> {
    if (DEMO || !(await getApiUrl())) {
      onProgress?.(100);
      return demo.addVideo(eventId, meta);
    }
    const { video, upload } = await req<{ video: VideoDTO; upload: PresignedPost }>(
      `/events/${eventId}/uploads`,
      { method: "POST", body: JSON.stringify(meta) }
    );
    if (file) await postToS3(upload, file, onProgress);
    return video;
  },
};

/**
 * Builds the multipart form for an S3 presigned POST. The signed policy already
 * includes Content-Type in `upload.fields`, so we must NOT append it again — a
 * duplicate breaks the signature and S3 returns 403. `file` must be appended last.
 */
export function buildS3Form(upload: PresignedPost, file: File): FormData {
  const form = new FormData();
  for (const [k, v] of Object.entries(upload.fields)) form.append(k, v);
  form.append("file", file);
  return form;
}

function postToS3(upload: PresignedPost, file: File, onProgress?: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const form = buildS3Form(upload, file);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", upload.url);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`));
    xhr.onerror = () => reject(new Error("Upload network error"));
    xhr.send(form);
  });
}
