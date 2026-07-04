import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";
import type { EventDTO, VideoDTO } from "./types";

export interface EventData {
  event: EventDTO | null;
  videos: VideoDTO[];
  loading: boolean;
  error: string | null;
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
  const localIds = useRef<Set<string>>(new Set());

  const load = useCallback(async () => {
    try {
      const { event: e, videos: v } = await api.listVideos(eventId);
      setEvent(e);
      // Keep any optimistic local videos that the server hasn't returned yet.
      setVideos((prev) => {
        const serverIds = new Set(v.map((x) => x.id));
        const keptLocal = prev.filter((x) => localIds.current.has(x.id) && !serverIds.has(x.id));
        return [...keptLocal, ...v].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
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

  return { event, videos, loading, error, refresh: load, addLocal, bumpLike };
}
