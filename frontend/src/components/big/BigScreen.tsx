import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { Theme, VideoDTO } from "../../types";
import { ACCENT, BRAND_GRAD, FONT_DISPLAY, INK, MUTED, MUTED2, pairFor, stillBg, themeById } from "../../design";
import { Grain, Qr, Spinner } from "../common";
import { Thumb, VideoCard } from "../attendee/VideoCard";
import { useEventData } from "../../useEventData";
import { useMediaQuery } from "../../useMediaQuery";

const COLS = 6;
const WALL_ROWS = 3; // a static 6×3 grid fills the 16:9 stage — no scrolling
const REAL_CELLS = COLS * 2; // real clips live in the top 2 rows (always fully visible)
// Cap how many clips decode video at once so a big wall doesn't melt the projector.
const MAX_AUTOPLAY = 12;

type Cell =
  | { kind: "video"; v: VideoDTO; key: string; play: boolean }
  | { kind: "ph"; key: string; pair: [string, string] };

function fmtDurShort(sec: number): string {
  return `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;
}

export function BigScreen({ eventId }: { eventId: string }) {
  const data = useEventData(eventId, 4000);
  const isWide = useMediaQuery("(min-width: 900px)");
  const live = useMemo(() => data.videos.filter((v) => v.status === "live"), [data.videos]);

  const trending = useMemo(() => {
    const themes = data.event?.themes ?? [];
    const counts = new Map<string, number>();
    live.forEach((v) => counts.set(v.theme, (counts.get(v.theme) || 0) + 1));
    return themes
      .map((t) => ({ theme: t, count: counts.get(t.id) || 0 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);
  }, [data.event, live]);

  if (data.loading && !data.event) {
    return <div style={canvasCenter}><Spinner size={34} /></div>;
  }
  if (!data.event) {
    return (
      <div style={canvasCenter}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 30 }}>Event not found</div>
          <Link to="/" style={{ color: ACCENT, fontWeight: 700 }}>Back to start</Link>
        </div>
      </div>
    );
  }

  return isWide ? (
    <Projector event={data.event} live={live} trending={trending} />
  ) : (
    <OrganizerPanel eventId={eventId} event={data.event} live={live} trending={trending} />
  );
}

/* ------------------------------------------------------------------ mobile */

function OrganizerPanel({
  eventId,
  event,
  live,
  trending,
}: {
  eventId: string;
  event: { name: string; code: string; attendeeUrl: string; themes: Theme[] };
  live: VideoDTO[];
  trending: { theme: Theme; count: number }[];
}) {
  const nav = useNavigate();
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard?.writeText(event.attendeeUrl).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      },
      () => {}
    );
  }

  return (
    <div style={mobileCanvas}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#FF3D57", animation: "blink 1.2s infinite" }} />
        <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".14em", color: "#FF6B7E" }}>LIVE NOW</span>
      </div>
      <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 30, letterSpacing: "-.02em", lineHeight: 1.05, marginTop: 8 }}>{event.name}</div>
      <div style={{ fontSize: 13.5, color: MUTED, fontWeight: 600, marginTop: 6 }}>{live.length} stories from the room · updating live</div>

      {/* Share card */}
      <div style={shareCard}>
        <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 19, letterSpacing: "-.01em" }}>Get stories on the wall</div>
        <div style={{ fontSize: 13, color: MUTED, marginTop: 6, lineHeight: 1.45 }}>Show this QR, or share the link. Anyone who scans can post a 60-second story.</div>
        <div style={{ display: "flex", justifyContent: "center", marginTop: 18 }}>
          <div style={{ background: "#F4F1EC", borderRadius: 18, padding: 16 }}>
            <Qr value={event.attendeeUrl} size={200} />
          </div>
        </div>
        <div style={{ marginTop: 18 }}>
          <EventCode code={event.code} size={46} align="center" />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}>
          <button onClick={copy} style={secondaryBtn}>{copied ? "Link copied ✓" : "Copy attendee link"}</button>
          <button onClick={() => nav(`/e/${eventId}`)} style={primaryBtn}>Open the live wall</button>
        </div>
      </div>

      {/* Trending */}
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".08em", color: MUTED2, margin: "26px 0 12px" }}>TRENDING THEMES</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
        {trending.map(({ theme, count }) => (
          <div key={theme.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ background: theme.color, boxShadow: `0 0 8px ${theme.color}`, width: 10, height: 10, borderRadius: "50%", flex: "none" }} />
            <span style={{ flex: 1, fontSize: 14, fontWeight: 700 }}>{theme.name}</span>
            <span style={{ fontSize: 13, color: MUTED, fontWeight: 700 }}>{count}</span>
          </div>
        ))}
      </div>

      {/* Latest stories preview */}
      {live.length > 0 && (
        <>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".08em", color: MUTED2, margin: "26px 0 12px" }}>LATEST STORIES</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 11 }}>
            {live.slice(0, 6).map((v) => (
              <VideoCard key={v.id} video={v} theme={themeById(event.themes, v.theme)} onOpen={() => nav(`/e/${eventId}`)} />
            ))}
          </div>
        </>
      )}

      <div style={{ textAlign: "center", marginTop: 26 }}>
        <Link to="/" style={{ color: MUTED2, fontWeight: 700, fontSize: 13, textDecoration: "none" }}>Tomorrow Stories</Link>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- desktop */

function Projector({
  event,
  live,
  trending,
}: {
  event: { name: string; code: string; attendeeUrl: string; themes: Theme[] };
  live: VideoDTO[];
  trending: { theme: Theme; count: number }[];
}) {
  // Snapshot the clip into state (not derived from the live poll) so the focus
  // view stays open on the facilitator's intent even if a poll transiently drops
  // the clip from the list.
  const [focused, setFocused] = useState<VideoDTO | null>(null);
  const themes = event.themes.length ? event.themes : [{ id: "", name: "", color: "#4D7CFF" }];

  // Static 6×3 grid — no scrolling. The top 2 rows hold real clips, tiled/repeated
  // so a handful of clips still fill the wall AND each one stays permanently on
  // screen (no waiting for a scroll to circle back); the bottom row is gradient
  // placeholders for depth. The full list lives in the table below.
  const cells = useMemo<Cell[]>(() => {
    const REPEAT = 3; // each clip claims up to 3 spread slots → a few clips fill the wall
    const bySlot: (VideoDTO | null)[] = new Array(REAL_CELLS).fill(null);
    // Assign oldest-first: a newly posted clip is placed LAST and only takes
    // still-free slots, so existing clips keep their exact slot (and never remount
    // / restart) when someone new posts. Cells are keyed by slot index, so the
    // <video> nodes are reused across the 4s polls too.
    const ordered = [...live].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    for (const v of ordered) {
      let base = 0;
      for (let i = 0; i < v.id.length; i++) base = (base * 31 + v.id.charCodeAt(i)) >>> 0;
      let placed = 0;
      for (let r = 0; r < REAL_CELLS && placed < REPEAT; r++) {
        const slot = (base + r * 4) % REAL_CELLS;
        if (!bySlot[slot]) { bySlot[slot] = v; placed++; }
      }
    }
    const out: Cell[] = [];
    let playing = 0;
    for (let i = 0; i < COLS * WALL_ROWS; i++) {
      const v = i < REAL_CELLS ? bySlot[i] : null;
      if (v) {
        const play = playing < MAX_AUTOPLAY;
        if (play) playing++;
        out.push({ kind: "video", v, key: `cell-${i}`, play });
      } else {
        out.push({ kind: "ph", key: `cell-${i}`, pair: pairFor(themes[i % themes.length], `ph-${i}`) });
      }
    }
    return out;
  }, [live, themes]);

  return (
    <div style={{ background: canvasBg, color: INK, minHeight: "100vh" }}>
      <div style={canvasCenter}>
        <div style={stage}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "34px 30px 30px", minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#FF3D57", animation: "blink 1.2s infinite" }} />
                  <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: ".14em", color: "#FF6B7E", whiteSpace: "nowrap" }}>LIVE NOW</span>
                </div>
                <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 42, letterSpacing: "-.03em", lineHeight: 1, marginTop: 8, whiteSpace: "nowrap" }}>{event.name}</div>
                <div style={{ fontSize: 15, color: "#9E99AD", fontWeight: 600, marginTop: 8 }}>{live.length} stories from the room · updating live</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 34 }}>Live</div>
                <div style={{ fontSize: 13, color: MUTED, fontWeight: 600 }}>Main Stage</div>
              </div>
            </div>

            <div style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: `repeat(${COLS}, 1fr)`, gridTemplateRows: `repeat(${WALL_ROWS}, 1fr)`, gap: 12, marginTop: 22, overflow: "hidden" }}>
              {cells.map((c) =>
                c.kind === "video" ? (
                  <BigCard key={c.key} video={c.v} theme={themeById(event.themes, c.v.theme)} autoPlay={c.play} onOpen={() => setFocused(c.v)} />
                ) : (
                  <PlaceholderCard key={c.key} pair={c.pair} />
                )
              )}
            </div>
          </div>

        <aside style={sidebar}>
          <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 24, letterSpacing: "-.02em", lineHeight: 1.1 }}>
            Add your<br />60-second story
          </div>
          <div style={{ fontSize: 14, color: "#9E99AD", fontWeight: 500, marginTop: 10, lineHeight: 1.45 }}>
            Scan to record from your phone. It appears here in seconds.
          </div>
          <div style={{ marginTop: 22, background: "#F4F1EC", borderRadius: 18, padding: 16, alignSelf: "flex-start" }}>
            <Qr value={event.attendeeUrl} size={150} />
          </div>
          <div style={{ marginTop: 18 }}>
            <EventCode code={event.code} size={40} align="left" />
          </div>
          <div style={{ marginTop: "auto", paddingTop: 22 }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".08em", color: MUTED2, marginBottom: 12 }}>TRENDING THEMES</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
              {trending.map(({ theme, count }) => (
                <div key={theme.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ background: theme.color, boxShadow: `0 0 8px ${theme.color}`, width: 10, height: 10, borderRadius: "50%", flex: "none" }} />
                  <span style={{ flex: 1, fontSize: 13.5, fontWeight: 700 }}>{theme.name}</span>
                  <span style={{ fontSize: 13, color: MUTED, fontWeight: 700 }}>{count}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>
        </div>
      </div>
      {live.length > 0 && <FacilitatorTable live={live} themes={event.themes} onOpen={setFocused} />}
      {focused && (
        <FocusModal video={focused} theme={themeById(event.themes, focused.theme)} onClose={() => setFocused(null)} />
      )}
    </div>
  );
}

/**
 * The facilitator's full list, below the 100vh wall (scroll down). Every clip as a
 * row: first-frame thumbnail, title, author, theme — click to play it in focus.
 * Lets them go through stories sequentially without waiting on the ambient wall.
 */
function FacilitatorTable({ live, themes, onOpen }: { live: VideoDTO[]; themes: Theme[]; onOpen: (v: VideoDTO) => void }) {
  return (
    <div style={{ width: "100%", maxWidth: 1340, margin: "0 auto", padding: "34px 26px 72px" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 16 }}>
        <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 24, letterSpacing: "-.02em" }}>All stories</span>
        <span style={{ fontSize: 14, color: MUTED, fontWeight: 600 }}>{live.length} · newest first</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {live.map((v) => {
          const t = themeById(themes, v.theme);
          return (
            <button key={v.id} onClick={() => onOpen(v)} style={tableRow}>
              <TableThumb video={v} theme={t} />
              <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                <div style={{ fontWeight: 700, fontSize: 15.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{v.title}</div>
                <div style={{ fontSize: 13, color: MUTED, marginTop: 3 }}>{v.author}</div>
              </div>
              <span style={{ flex: "none", padding: "5px 12px", borderRadius: 999, fontSize: 12, fontWeight: 800, background: t.color, color: "#0C0A12", whiteSpace: "nowrap" }}>{t.name}</span>
              <span style={{ flex: "none", width: 48, textAlign: "right", fontSize: 12.5, color: MUTED2, fontWeight: 700 }}>{fmtDurShort(v.durationSec)}</span>
              <span style={{ flex: "none", width: 30, height: 30, borderRadius: "50%", background: "rgba(255,255,255,.06)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="13" height="13" viewBox="0 0 24 24"><path d="M8 5.5L18.5 12L8 18.5V5.5Z" fill="#F4F1EC" /></svg>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Small first-frame preview for the table. The <video> (metadata-only, #t=0.1 to
 * paint a frame) is mounted only once the row scrolls near the viewport, so a
 * 100-clip event doesn't spin up 100 media elements at once.
 */
function TableThumb({ video, theme }: { video: VideoDTO; theme: Theme }) {
  const ref = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || show || !video.mediaUrl) return;
    const io = new IntersectionObserver(
      (entries) => { if (entries.some((e) => e.isIntersecting)) { setShow(true); io.disconnect(); } },
      { rootMargin: "300px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [show, video.mediaUrl]);
  return (
    <div ref={ref} style={{ width: 58, height: 78, borderRadius: 10, overflow: "hidden", flex: "none", position: "relative", background: video.posterUrl ? `#000 url(${video.posterUrl}) center/cover` : stillBg(pairFor(theme, video.id)) }}>
      {show && video.mediaUrl && (
        <video
          src={`${video.mediaUrl}#t=0.1`}
          muted
          playsInline
          preload="metadata"
          tabIndex={-1}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none" }}
        />
      )}
    </div>
  );
}

/** Full-screen focus view: play one clip with sound; click outside / ✕ / Esc to close. */
function FocusModal({ video, theme, onClose }: { video: VideoDTO; theme: Theme; onClose: () => void }) {
  const ref = useRef<HTMLVideoElement>(null);
  const retries = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [onClose]);

  // A clip can be tapped inside its brief upload window (record is live before the
  // S3 object lands). A <video> that errored won't re-fetch itself, so retry with
  // backoff; until the first frame is ready we show a loading state, not a dead frame.
  function handleError() {
    if (retries.current >= 20) return;
    const delay = Math.min(1500 + retries.current * 1000, 8000);
    retries.current += 1;
    timer.current = setTimeout(() => ref.current?.load(), delay);
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(4,3,10,.9)", backdropFilter: "blur(12px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 28, animation: "rise .25s ease" }}>
      <button onClick={onClose} aria-label="Close" style={{ position: "fixed", top: 22, right: 24, width: 52, height: 52, borderRadius: "50%", border: "1px solid rgba(255,255,255,.18)", background: "rgba(255,255,255,.08)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M6 6L18 18M18 6L6 18" stroke="#F4F1EC" strokeWidth="2.2" strokeLinecap="round" /></svg>
      </button>
      <div onClick={(e) => e.stopPropagation()} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18, width: "100%", maxWidth: "min(520px, 94vw)" }}>
        <div style={{ position: "relative", width: "100%", aspectRatio: "9 / 16", maxHeight: "76vh", borderRadius: 24, overflow: "hidden", background: "#000", boxShadow: "0 50px 130px -30px #000" }}>
          {video.mediaUrl && (
            <video
              ref={ref}
              src={video.mediaUrl}
              poster={video.posterUrl ?? undefined}
              controls
              autoPlay
              playsInline
              onPlaying={() => { retries.current = 0; setReady(true); }}
              onLoadedData={() => setReady(true)}
              onError={handleError}
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", background: "#000" }}
            />
          )}
          {!ready && (
            <div style={{ position: "absolute", inset: 0, background: stillBg(pairFor(theme, video.id)), display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
              <Spinner size={30} />
              <span style={{ fontSize: 13, fontWeight: 700, color: "#F4F1EC" }}>Loading…</span>
            </div>
          )}
        </div>
        <div style={{ textAlign: "center", maxWidth: 520 }}>
          <span style={{ display: "inline-block", padding: "5px 13px", borderRadius: 999, fontSize: 13, fontWeight: 800, background: theme.color, color: "#0C0A12" }}>{theme.name}</span>
          <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 26, letterSpacing: "-.02em", marginTop: 12 }}>{video.title}</div>
          <div style={{ fontSize: 15, color: MUTED, fontWeight: 600, marginTop: 6 }}>{video.author}</div>
        </div>
      </div>
    </div>
  );
}

/** Decorative gradient panel that keeps the canvas full when there are few clips. */
function PlaceholderCard({ pair }: { pair: [string, string] }) {
  return (
    <div aria-hidden style={{ position: "relative", borderRadius: 14, overflow: "hidden", width: "100%", height: "100%", background: stillBg(pair) }}>
      <Grain />
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,rgba(0,0,0,.04),rgba(0,0,0,.34))" }} />
    </div>
  );
}

/** Prominent, classy event-code display — the type-it-in alternative to the QR. */
function EventCode({ code, size, align = "left" }: { code: string; size: number; align?: "left" | "center" }) {
  const host = typeof window !== "undefined" ? window.location.host : "";
  return (
    <div style={{ textAlign: align }}>
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".16em", color: MUTED2 }}>OR ENTER CODE</div>
      <div
        style={{
          fontFamily: FONT_DISPLAY,
          fontWeight: 800,
          fontSize: size,
          letterSpacing: ".06em",
          lineHeight: 1,
          marginTop: 8,
          color: INK,
        }}
      >
        {code}
      </div>
      <div style={{ fontSize: 12.5, color: MUTED, marginTop: 8, fontWeight: 600 }}>
        at {host}/join
      </div>
    </div>
  );
}

function BigCard({ video, theme, autoPlay, onOpen }: { video: VideoDTO; theme: Theme; autoPlay: boolean; onOpen?: () => void }) {
  return (
    <div onClick={onOpen} style={{ position: "relative", borderRadius: 14, overflow: "hidden", width: "100%", height: "100%", minHeight: 0, cursor: onOpen ? "pointer" : "default" }}>
      <Thumb video={video} theme={theme} autoPlay={autoPlay} />
      <Grain />
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,transparent 40%,rgba(0,0,0,.75))" }} />
      <div style={{ position: "absolute", top: 8, left: 8, display: "flex", alignItems: "center", gap: 5 }}>
        <span style={{ background: theme.color, boxShadow: `0 0 8px ${theme.color}`, width: 8, height: 8, borderRadius: "50%" }} />
      </div>
      {onOpen && (
        <div style={{ position: "absolute", top: 7, right: 7, width: 22, height: 22, borderRadius: 7, background: "rgba(0,0,0,.42)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M9 4H4v5M15 4h5v5M15 20h5v-5M9 20H4v-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
      )}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: 9 }}>
        <div style={{ fontWeight: 700, fontSize: 12.5, lineHeight: 1.2, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{video.title}</div>
        <div style={{ fontSize: 10.5, color: "#C9C6D4", marginTop: 3 }}>{video.author}</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ styles */

const tableRow: CSSProperties = { display: "flex", alignItems: "center", gap: 14, width: "100%", padding: "10px 14px", borderRadius: 14, border: "1px solid rgba(255,255,255,.07)", background: "rgba(255,255,255,.03)", cursor: "pointer", fontFamily: "inherit", color: INK };
const canvasBg = "radial-gradient(1300px 740px at 50% -8%, #223159, #0C1024 60%)";
const canvasCenter: CSSProperties = { minHeight: "100vh", background: canvasBg, color: INK, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 };
const mobileCanvas: CSSProperties = {
  minHeight: "100vh",
  background: canvasBg,
  color: INK,
  padding: "calc(20px + env(safe-area-inset-top)) 18px calc(28px + env(safe-area-inset-bottom))",
};
const shareCard: CSSProperties = { marginTop: 20, background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.09)", borderRadius: 22, padding: 22 };
const primaryBtn: CSSProperties = { width: "100%", padding: 14, borderRadius: 14, border: "none", background: BRAND_GRAD, color: "#fff", fontWeight: 800, fontSize: 15, cursor: "pointer", fontFamily: "inherit" };
const secondaryBtn: CSSProperties = { width: "100%", padding: 14, borderRadius: 14, border: "1px solid rgba(255,255,255,.16)", background: "rgba(255,255,255,.04)", color: INK, fontWeight: 700, fontSize: 14.5, cursor: "pointer", fontFamily: "inherit" };
const stage: CSSProperties = {
  width: "100%",
  maxWidth: 1340,
  aspectRatio: "16 / 9",
  borderRadius: 24,
  overflow: "hidden",
  position: "relative",
  background: "radial-gradient(120% 100% at 50% 0%, #1a1428, #08060e)",
  border: "1px solid rgba(255,255,255,.08)",
  boxShadow: "0 40px 100px -40px #000",
  display: "flex",
};
const sidebar: CSSProperties = {
  width: 300,
  flex: "none",
  background: "rgba(255,255,255,.03)",
  borderLeft: "1px solid rgba(255,255,255,.07)",
  padding: "34px 26px",
  display: "flex",
  flexDirection: "column",
};
