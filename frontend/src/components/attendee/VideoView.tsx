import { useState } from "react";
import type { CSSProperties } from "react";
import type { CommentDTO, Theme, VideoDTO } from "../../types";
import { BRAND_GRAD, DANGER_INK, fmtDur, fmtLikes, initials, INK, MUTED, ON_ACCENT, OVERLAY_BG, pairFor, stillBg } from "../../design";
import { Grain, PlayBadge } from "../common";

const avatarBig = (pair: [string, string]): CSSProperties => ({
  background: `linear-gradient(135deg,${pair[0]},${pair[1]})`,
  width: 42,
  height: 42,
  borderRadius: "50%",
  flex: "none",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 14,
  fontWeight: 800,
  color: "#fff",
});

// Deterministic avatar colour for a commenter's name.
const CMT_COLORS = ["#7B2FF7", "#EC4899", "#F59E0B", "#22D3EE", "#2FD37E", "#4D7CFF"];
function cmtColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return CMT_COLORS[h % CMT_COLORS.length];
}

export function VideoView({
  video,
  theme,
  liked,
  onLike,
  following,
  onToggleFollow,
  comments,
  onSubmitComment,
  defaultName,
  onBack,
}: {
  video: VideoDTO;
  theme: Theme;
  liked: boolean;
  onLike: () => void;
  following: boolean;
  onToggleFollow: () => void;
  comments: CommentDTO[];
  onSubmitComment: (author: string, text: string) => void;
  defaultName?: string;
  onBack: () => void;
}) {
  const pair = pairFor(theme, video.id);
  const [name, setName] = useState(defaultName || "");
  const [text, setText] = useState("");
  const canSend = name.trim().length > 0 && text.trim().length > 0;
  function send() {
    if (!canSend) return;
    onSubmitComment(name.trim(), text.trim());
    setText("");
  }
  return (
    <div style={{ height: "100%", width: "100%", display: "flex", flexDirection: "column", background: OVERLAY_BG }}>
      <div style={{ flex: "none", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 16px" }}>
        <button onClick={onBack} style={{ width: 38, height: 38, borderRadius: "50%", background: "rgba(var(--ts-neutral-rgb),.07)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: INK }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M15 5L8 12L15 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div style={{ padding: "6px 13px", borderRadius: 999, fontSize: 12.5, fontWeight: 800, background: theme.color, color: ON_ACCENT, whiteSpace: "nowrap" }}>{theme.name}</div>
        <div style={{ width: 38, height: 38, borderRadius: "50%", background: "rgba(var(--ts-neutral-rgb),.07)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <circle cx="5" cy="12" r="1.7" fill="currentColor" />
            <circle cx="12" cy="12" r="1.7" fill="currentColor" />
            <circle cx="19" cy="12" r="1.7" fill="currentColor" />
          </svg>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "0 16px 12px" }}>
        <div style={{ position: "relative", borderRadius: 22, overflow: "hidden", aspectRatio: "10 / 13", boxShadow: "0 20px 50px -22px rgba(0,0,0,.8)", background: "#000" }}>
          {video.mediaUrl ? (
            <video
              src={video.mediaUrl}
              poster={video.posterUrl ?? undefined}
              controls
              playsInline
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", background: "#000" }}
            />
          ) : (
            <>
              <div style={{ position: "absolute", inset: 0, background: video.posterUrl ? `#000 url(${video.posterUrl}) center/cover` : stillBg(pair) }} />
              <Grain />
              <PlayBadge size={62} />
              <div style={{ position: "absolute", left: 14, right: 14, bottom: 14 }}>
                <div style={{ height: 3, borderRadius: 2, background: "rgba(var(--ts-neutral-rgb),.28)" }}>
                  <div style={{ width: "38%", height: "100%", borderRadius: 2, background: "#fff" }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 700, color: "#fff", marginTop: 6, textShadow: "0 1px 4px rgba(0,0,0,.5)" }}>
                  <span>0:00</span>
                  <span>{fmtDur(video.durationSec)}</span>
                </div>
              </div>
            </>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 11, marginTop: 14 }}>
          <span style={avatarBig(pair)}>{initials(video.author)}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{video.author}</div>
            <div style={{ fontSize: 12.5, color: MUTED }}>@{video.author.split(" ")[0].toLowerCase()}</div>
          </div>
          <button
            onClick={onToggleFollow}
            style={{ padding: "9px 16px", borderRadius: 999, fontSize: 12.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", border: "1px solid " + (following ? theme.color : "rgba(var(--ts-neutral-rgb),.16)"), background: following ? theme.color : "transparent", color: following ? ON_ACCENT : INK }}
          >
            {following ? "Following" : "Follow theme"}
          </button>
        </div>

        <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 700, fontSize: 20, lineHeight: 1.2, letterSpacing: "-.01em", marginTop: 14 }}>{video.title}</div>

        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <button
            onClick={onLike}
            style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: 11, borderRadius: 14, border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: 14, background: liked ? "rgba(255,61,87,.16)" : "rgba(var(--ts-neutral-rgb),.06)", color: liked ? DANGER_INK : INK }}
          >
            <span style={{ fontSize: 17 }}>&#9829;</span>
            {fmtLikes(video.likes)}
          </button>
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: 11, borderRadius: 14, background: "rgba(var(--ts-neutral-rgb),.06)", fontWeight: 700, fontSize: 14 }}>
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
              <path d="M4 5h16v11H9l-4 3.5V16H4V5z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
            </svg>
            {comments.length}
          </div>
          <div style={{ flex: "none", display: "flex", alignItems: "center", justifyContent: "center", padding: "11px 15px", borderRadius: 14, background: "rgba(var(--ts-neutral-rgb),.06)" }}>
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
              <path d="M4 12v7a1 1 0 001 1h14a1 1 0 001-1v-7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              <path d="M12 15V3M12 3L8 7M12 3l4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>

        <div style={{ fontSize: 13, fontWeight: 700, color: MUTED, margin: "20px 0 10px" }}>{comments.length} comment{comments.length === 1 ? "" : "s"}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {comments.length === 0 && <div style={{ fontSize: 13, color: MUTED }}>Be the first to comment.</div>}
          {comments.map((c) => (
            <div key={c.id} style={{ display: "flex", gap: 10 }}>
              <span style={{ background: cmtColor(c.author), width: 30, height: 30, borderRadius: "50%", flex: "none", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, color: "#fff" }}>{initials(c.author)}</span>
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 700 }}>{c.author}</div>
                <div style={{ fontSize: 13.5, color: MUTED, lineHeight: 1.35, marginTop: 2 }}>{c.text}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ flex: "none", display: "flex", flexDirection: "column", gap: 8, padding: "10px 14px calc(10px + env(safe-area-inset-bottom))", borderTop: "1px solid rgba(var(--ts-neutral-rgb),.07)", background: OVERLAY_BG }}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name (shown with your comment)"
          aria-label="Your name"
          maxLength={60}
          style={{ width: "100%", background: "rgba(var(--ts-neutral-rgb),.06)", border: "1px solid rgba(var(--ts-neutral-rgb),.09)", borderRadius: 999, padding: "10px 16px", color: INK, fontSize: 13.5, fontFamily: "inherit", outline: "none" }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Add a comment..."
            style={{ flex: 1, minWidth: 0, background: "rgba(var(--ts-neutral-rgb),.06)", border: "1px solid rgba(var(--ts-neutral-rgb),.09)", borderRadius: 999, padding: "11px 16px", color: INK, fontSize: 14, fontFamily: "inherit", outline: "none" }}
          />
          <button onClick={send} disabled={!canSend} aria-label="Post comment" style={{ width: 42, height: 42, borderRadius: "50%", border: "none", background: BRAND_GRAD, display: "flex", alignItems: "center", justifyContent: "center", cursor: canSend ? "pointer" : "not-allowed", opacity: canSend ? 1 : 0.5, flex: "none" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M4 12L20 4L14 20L11 13L4 12Z" fill="#fff" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
