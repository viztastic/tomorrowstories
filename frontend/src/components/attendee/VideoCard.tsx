import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { Theme, VideoDTO } from "../../types";
import { fmtLikes, initials, pairFor, stillBg } from "../../design";
import { Grain, PlayBadge, Spinner } from "../common";

/**
 * The video still. Backdrop is always the poster (if transcoded) or the theme
 * gradient, so there's never a blank/black card. When `autoPlay` is set and the
 * clip is live, the real muted clip loops on top and fades in once it's actually
 * playing — used on the big screen so the wall shows moving video, not stills.
 *
 * Playback is driven explicitly with `.play()` rather than the `autoPlay`
 * attribute, which is unreliable in a React SPA (the element mounts mid-render,
 * inside an animated column). And in no-transcode mode a clip's record is marked
 * "live" the instant it's created — before the phone finishes the S3 upload — so
 * the first loads can 404. So we retry `.load()` + `.play()` with backoff until
 * the object lands and playback actually starts; only then does it fade in. This
 * is why the wall now fills in on its own, with no page refresh needed.
 */
export function Thumb({ video, theme, autoPlay = false }: { video: VideoDTO; theme: Theme; autoPlay?: boolean }) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLVideoElement>(null);
  const attempts = useRef(0);
  const pending = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backdrop = video.posterUrl
    ? `#000 url(${video.posterUrl}) center/cover no-repeat`
    : stillBg(pairFor(theme, video.id));
  const canPlay = autoPlay && !!video.mediaUrl && video.status === "live";

  useEffect(() => {
    if (!canPlay) { setVisible(false); return; }
    const el = ref.current;
    if (!el) return;
    let cancelled = false;
    attempts.current = 0;
    pending.current = false;
    const clear = () => { if (timer.current) { clearTimeout(timer.current); timer.current = null; } };
    // `error` (a 404 while still uploading) and the play() rejection can both fire
    // for one failed load; `pending` collapses them into a single retry so the
    // 40-attempt (~a few minutes) budget isn't burned twice per cycle.
    const schedule = () => {
      if (cancelled || pending.current || attempts.current >= 40) return;
      pending.current = true;
      attempts.current += 1;
      clear();
      const delay = Math.min(1200 + attempts.current * 600, 6000);
      timer.current = setTimeout(() => {
        pending.current = false;
        if (cancelled || !ref.current) return;
        ref.current.load(); // re-fetch — the object may have just finished uploading
        kick();
      }, delay);
    };
    const kick = () => {
      if (cancelled || !ref.current) return;
      const p = ref.current.play();
      if (p) p.then(() => { attempts.current = 0; }, () => schedule());
    };
    const onErr = () => { setVisible(false); schedule(); };
    el.addEventListener("error", onErr);
    kick();
    return () => { cancelled = true; clear(); el.removeEventListener("error", onErr); };
  }, [canPlay, video.mediaUrl]);

  return (
    <div style={{ position: "absolute", inset: 0, background: backdrop }}>
      {canPlay && (
        <video
          ref={ref}
          src={video.mediaUrl!}
          muted
          loop
          playsInline
          preload="auto"
          onPlaying={() => { attempts.current = 0; setVisible(true); }}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: visible ? 1 : 0,
            transition: "opacity .6s ease",
          }}
        />
      )}
    </div>
  );
}

const overlayBase: CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  flexDirection: "column",
  gap: 8,
  alignItems: "center",
  justifyContent: "center",
  padding: 12,
  textAlign: "center",
  background: "rgba(0,0,0,.4)",
  pointerEvents: "none",
};

function ProcessingOverlay({ long }: { long: boolean }) {
  return (
    <div style={overlayBase}>
      <Spinner size={22} />
      <span style={{ fontSize: 11.5, fontWeight: 700, color: "#F4F1EC", textShadow: "0 1px 6px rgba(0,0,0,.6)" }}>
        {long ? "Still processing…" : "Processing…"}
      </span>
      {long && <span style={{ fontSize: 10, color: "#D9D6E0" }}>hang tight, almost there</span>}
    </div>
  );
}

function FailedOverlay() {
  return (
    <div style={{ ...overlayBase, background: "rgba(40,6,14,.6)" }}>
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="9" stroke="#FF7A9C" strokeWidth="1.8" />
        <path d="M12 7.5V13" stroke="#FF7A9C" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="12" cy="16.3" r="1" fill="#FF7A9C" />
      </svg>
      <span style={{ fontSize: 11.5, fontWeight: 700, color: "#FF9DB0" }}>Couldn’t process</span>
      <span style={{ fontSize: 10, color: "#D9D6E0" }}>try uploading again</span>
    </div>
  );
}

const avatar = (pair: [string, string]): CSSProperties => ({
  background: `linear-gradient(135deg,${pair[0]},${pair[1]})`,
  width: 19,
  height: 19,
  borderRadius: "50%",
  flex: "none",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 8.5,
  fontWeight: 800,
  color: "#fff",
});

export function VideoCard({
  video,
  theme,
  mine,
  onOpen,
}: {
  video: VideoDTO;
  theme: Theme;
  mine?: boolean;
  onOpen: () => void;
}) {
  const pair = pairFor(theme, video.id);
  const processing = video.status === "processing";
  const failed = video.status === "failed";
  const ageSec = (Date.now() - new Date(video.createdAt).getTime()) / 1000;
  const longProcessing = processing && ageSec > 150;
  return (
    <div
      onClick={onOpen}
      style={{
        position: "relative",
        aspectRatio: "9 / 14",
        borderRadius: 18,
        overflow: "hidden",
        cursor: "pointer",
        boxShadow: "0 12px 26px -14px rgba(0,0,0,.7)",
      }}
    >
      <Thumb video={video} theme={theme} />
      <Grain />
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,rgba(0,0,0,.05) 40%,rgba(0,0,0,.72))" }} />
      {failed ? <FailedOverlay /> : processing ? <ProcessingOverlay long={longProcessing} /> : <PlayBadge size={44} />}
      <div style={{ position: "absolute", top: 9, right: 9, background: "rgba(0,0,0,.42)", backdropFilter: "blur(4px)", padding: "3px 8px", borderRadius: 999, fontSize: 11, fontWeight: 700 }}>
        {fmtDurShort(video.durationSec)}
      </div>
      {mine && (
        <div style={{ position: "absolute", top: 9, left: 9, background: "#F4F1EC", color: "#0C0A12", padding: "3px 8px", borderRadius: 999, fontSize: 10, fontWeight: 800, letterSpacing: ".03em" }}>
          YOURS
        </div>
      )}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "11px 11px 12px" }}>
        <div
          style={{
            fontWeight: 700,
            fontSize: 13.5,
            lineHeight: 1.22,
            letterSpacing: "-.01em",
            textShadow: "0 1px 8px rgba(0,0,0,.5)",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {video.title}
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
            <span style={avatar(pair)}>{initials(video.author)}</span>
            <span style={{ fontSize: 11.5, color: "#D9D6E0", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{video.author}</span>
          </div>
          <span style={{ fontSize: 11, color: "#D9D6E0", fontWeight: 700, whiteSpace: "nowrap" }}>&#9829; {fmtLikes(video.likes)}</span>
        </div>
      </div>
    </div>
  );
}

function fmtDurShort(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
