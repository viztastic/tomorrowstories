import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { Theme, VideoDTO } from "../../types";
import { ACCENT, BRAND_GRAD, FONT_DISPLAY, INK, MUTED, MUTED2, themeById } from "../../design";
import { Grain, Qr, Spinner } from "../common";
import { Thumb, VideoCard } from "../attendee/VideoCard";
import { useEventData } from "../../useEventData";
import { useMediaQuery } from "../../useMediaQuery";

const COLS = 6;
const HEIGHTS = [228, 268, 208, 248, 232, 258];
const DURS = [46, 58, 50, 62, 48, 56];
// Cap how many clips decode video at once so a big wall doesn't melt the projector.
const MAX_AUTOPLAY = 12;

/** Stable column for a video id — same id always lands in the same column. */
function colHash(id: string, n: number): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % n;
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
  // Use only as many columns as there are clips (up to COLS), so a handful of
  // videos fill a tidy centred grid instead of one sparse column.
  const nCols = Math.min(COLS, Math.max(1, live.length));
  // Only run the scrolling marquee (which clones each column to loop seamlessly)
  // once there are enough clips to actually overflow the stage. Below that we
  // show a static grid — otherwise a lone clip looks like a duplicate.
  const marquee = live.length > nCols * 3;
  // Cap concurrent decoders (projector perf); clips past the cap show their still.
  const playIds = useMemo(() => new Set(live.slice(0, MAX_AUTOPLAY).map((v) => v.id)), [live]);
  const columns = useMemo(() => {
    const cols: VideoDTO[][] = Array.from({ length: nCols }, () => []);
    // Assign by a stable hash of the id (not insertion order) so a newly posted
    // clip drops into its own column instead of reshuffling — and restarting —
    // every video already playing on the wall.
    live.forEach((v) => cols[colHash(v.id, nCols)].push(v));
    return cols;
  }, [live, nCols]);

  return (
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

          {live.length === 0 ? (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: MUTED2, fontWeight: 600, fontSize: 18, textAlign: "center", lineHeight: 1.5 }}>
              No stories yet — scan the code to be the first on the wall.
            </div>
          ) : (
            <div style={{ flex: 1, display: "flex", gap: 12, marginTop: 22, overflow: "hidden", justifyContent: "center", alignItems: marquee ? "stretch" : "flex-start", WebkitMaskImage: marquee ? "linear-gradient(180deg,transparent,#000 6%,#000 94%,transparent)" : "none" }}>
              {columns.map((colVids, ci) => {
                const anim = marquee ? `wall${ci % 2 ? "Down" : "Up"} ${DURS[ci % DURS.length]}s linear infinite` : undefined;
                // Clone the column only when scrolling (a few clips shouldn't read
                // as duplicates). The clone never decodes a second copy of the clip
                // — it shows the still — so the marquee doesn't double the decoders.
                const items = marquee
                  ? [
                      ...colVids.map((v) => ({ v, k: v.id, play: playIds.has(v.id) })),
                      ...colVids.map((v) => ({ v, k: `${v.id}#2`, play: false })),
                    ]
                  : colVids.map((v) => ({ v, k: v.id, play: playIds.has(v.id) }));
                return (
                  <div key={ci} style={{ flex: 1, maxWidth: 300, overflow: "hidden" }}>
                    <div style={{ animation: anim, display: "flex", flexDirection: "column", gap: 12 }}>
                      {items.map(({ v, k, play }, j) => (
                        <BigCard key={k} video={v} theme={themeById(event.themes, v.theme)} height={HEIGHTS[(ci + j) % HEIGHTS.length]} autoPlay={play} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
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

function BigCard({ video, theme, height, autoPlay }: { video: VideoDTO; theme: Theme; height: number; autoPlay: boolean }) {
  return (
    <div style={{ position: "relative", borderRadius: 14, overflow: "hidden", height }}>
      <Thumb video={video} theme={theme} autoPlay={autoPlay} />
      <Grain />
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,transparent 40%,rgba(0,0,0,.75))" }} />
      <div style={{ position: "absolute", top: 8, left: 8, display: "flex", alignItems: "center", gap: 5 }}>
        <span style={{ background: theme.color, boxShadow: `0 0 8px ${theme.color}`, width: 8, height: 8, borderRadius: "50%" }} />
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: 9 }}>
        <div style={{ fontWeight: 700, fontSize: 12.5, lineHeight: 1.2, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{video.title}</div>
        <div style={{ fontSize: 10.5, color: "#C9C6D4", marginTop: 3 }}>{video.author}</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ styles */

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
