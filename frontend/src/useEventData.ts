import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";
import { LockedError } from "./errors";
import type { EventDTO, VideoDTO } from "./types";

export interface EventData {
  event: EventDTO | null;
  videos: VideoDTO[];
  loading: boolean;
  error: string | null;
  /** The wall is password-locked and we don't hold a valid view token yet. */
  locked: boolean;
  refresh: () => void;
  /** Optimistically merge a just-created video so it shows instantly. */
  addLocal: (v: VideoDTO) => void;
  bumpLike: (id: string, likes: number) => void;
}

/** Polls the event's videos on an interval (Wall + Big Screen realtime in v1). */
export function useEventData(eventId: string, pollMs = 5000): EventData {
  const [event, setEvent] = useState<EventDTO | null>(null);
  const [videos, setVideos] = useState<VideoDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const localIds = useRef<Set<string>>(new Set());
  // Monotonic request id so a slow in-flight poll can't clobber a newer result —
  // e.g. after unlocking, a poll that started pre-token (→ LockedError) must not
  // overwrite the refresh that already succeeded and flip the gate back on.
  const seq = useRef(0);

  const load = useCallback(async () => {
    const id = ++seq.current;
    try {
      const { event: e, videos: v } = await api.listVideos(eventId);
      if (id !== seq.current) return;
      setEvent(e);
      // Keep any optimistic local videos that the server hasn't returned yet.
      setVideos((prev) => {
        const serverIds = new Set(v.map((x) => x.id));
        const keptLocal = prev.filter((x) => localIds.current.has(x.id) && !serverIds.has(x.id));
        return [...keptLocal, ...v].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      });
      setLocked(false);
      setError(null);
    } catch (err) {
      if (id !== seq.current) return;
      // A locked wall isn't an error state — the caller shows the unlock prompt.
      if (err instanceof LockedError) {
        setLocked(true);
        setError(null);
      } else {
        setError(err instanceof Error ? err.message : "Failed to load");
      }
    } finally {
      if (id === seq.current) setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    setLoading(true);
    load();
    const t = setInterval(load, pollMs);
    return () => clearInterval(t);
  }, [load, pollMs]);

  const addLocal = useCallback((v: VideoDTO) => {
    localIds.current.add(v.id);
    setVideos((prev) => [v, ...prev.filter((x) => x.id !== v.id)]);
  }, []);

  const bumpLike = useCallback((id: string, likes: number) => {
    setVideos((prev) => prev.map((v) => (v.id === id ? { ...v, likes } : v)));
  }, []);

  return { event, videos, loading, error, locked, refresh: load, addLocal, bumpLike };
}
