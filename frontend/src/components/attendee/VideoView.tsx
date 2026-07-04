import type { CSSProperties } from "react";
import type { LocalComment, Theme, VideoDTO } from "../../types";
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

export function VideoView({
  video,
  theme,
  liked,
  onLike,
  following,
  onToggleFollow,
  comments,
  commentDraft,
  onCommentChange,
  onSendComment,
  onBack,
}: {
  video: VideoDTO;
  theme: Theme;
  liked: boolean;
  onLike: () => void;
  following: boolean;
  onToggleFollow: () => void;
  comments: LocalComment[];
  commentDraft: string;
  onCommentChange: (v: string) => void;
  onSendComment: () => void;
  onBack: () => void;
}) {
  const pair = pairFor(theme, video.id);
  return (
    <div style={{ height: "100%", width: "100%", display: "flex", flexDirection: "column", background: OVERLAY_BG }}>
      <div style={{ flex: "none", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 16px" }}>
        <button onClick={onBack} style={{ width: 38, height: 38, borderRadius: "50%", background: "rgba(255,255,255,.07)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M15 5L8 12L15 19" stroke="#F4F1EC" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div style={{ padding: "6px 13px", borderRadius: 999, fontSize: 12.5, fontWeight: 800, background: theme.color, color: ON_ACCENT, whiteSpace: "nowrap" }}>{theme.name}</div>
        <div style={{ width: 38, height: 38, borderRadius: "50%", background: "rgba(255,255,255,.07)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <circle cx="5" cy="12" r="1.7" fill="#F4F1EC" />
            <circle cx="12" cy="12" r="1.7" fill="#F4F1EC" />
            <circle cx="19" cy="12" r="1.7" fill="#F4F1EC" />
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
                <div style={{ height: 3, borderRadius: 2, background: "rgba(255,255,255,.28)" }}>
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
            style={{ padding: "9px 16px", borderRadius: 999, fontSize: 12.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", border: "1px solid " + (following ? theme.color : "rgba(255,255,255,.16)"), background: following ? theme.color : "transparent", color: following ? ON_ACCENT : INK }}
          >
            {following ? "Following" : "Follow theme"}
          </button>
        </div>

        <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 700, fontSize: 20, lineHeight: 1.2, letterSpacing: "-.01em", marginTop: 14 }}>{video.title}</div>

        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <button
            onClick={onLike}
            style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: 11, borderRadius: 14, border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: 14, background: liked ? "rgba(255,61,87,.16)" : "rgba(255,255,255,.06)", color: liked ? DANGER_INK : INK }}
          >
            <span style={{ fontSize: 17 }}>&#9829;</span>
            {fmtLikes(video.likes)}
          </button>
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: 11, borderRadius: 14, background: "rgba(255,255,255,.06)", fontWeight: 700, fontSize: 14 }}>
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
              <path d="M4 5h16v11H9l-4 3.5V16H4V5z" stroke="#C9C6D4" strokeWidth="1.7" strokeLinejoin="round" />
            </svg>
            {comments.length}
          </div>
          <div style={{ flex: "none", display: "flex", alignItems: "center", justifyContent: "center", padding: "11px 15px", borderRadius: 14, background: "rgba(255,255,255,.06)" }}>
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
              <path d="M4 12v7a1 1 0 001 1h14a1 1 0 001-1v-7" stroke="#C9C6D4" strokeWidth="1.7" strokeLinecap="round" />
              <path d="M12 15V3M12 3L8 7M12 3l4 4" stroke="#C9C6D4" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>

        <div style={{ fontSize: 13, fontWeight: 700, color: MUTED, margin: "20px 0 10px" }}>{comments.length} comments</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {comments.map((c, i) => (
            <div key={i} style={{ display: "flex", gap: 10 }}>
              <span style={{ background: c.c, width: 30, height: 30, borderRadius: "50%", flex: "none", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, color: "#fff" }}>{initials(c.n)}</span>
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 700 }}>{c.n}</div>
                <div style={{ fontSize: 13.5, color: "#D9D6E0", lineHeight: 1.35, marginTop: 2 }}>{c.t}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 9, padding: "10px 14px calc(10px + env(safe-area-inset-bottom))", borderTop: "1px solid rgba(255,255,255,.07)", background: OVERLAY_BG }}>
        <input
          value={commentDraft}
          onChange={(e) => onCommentChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSendComment()}
          placeholder="Add a comment..."
          style={{ flex: 1, background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.09)", borderRadius: 999, padding: "11px 16px", color: "#F4F1EC", fontSize: 14, fontFamily: "inherit", outline: "none" }}
        />
        <button onClick={onSendComment} style={{ width: 42, height: 42, borderRadius: "50%", border: "none", background: BRAND_GRAD, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flex: "none" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M4 12L20 4L14 20L11 13L4 12Z" fill="#fff" />
          </svg>
        </button>
      </div>
    </div>
  );
}
