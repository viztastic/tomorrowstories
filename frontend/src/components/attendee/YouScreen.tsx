import type { Theme, VideoDTO } from "../../types";
import { BRAND_GRAD, FONT_DISPLAY, MUTED, MUTED2, themeById } from "../../design";
import { Thumb } from "./VideoCard";

export function YouScreen({
  themes,
  myVideos,
  follows,
  onOpen,
  onStartUpload,
}: {
  themes: Theme[];
  myVideos: VideoDTO[];
  follows: Record<string, boolean>;
  onOpen: (id: string) => void;
  onStartUpload: () => void;
}) {
  const followed = themes.filter((t) => follows[t.id]);
  return (
    <div style={{ padding: "14px 18px 8px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ width: 62, height: 62, borderRadius: "50%", background: BRAND_GRAD, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 800 }}>You</div>
        <div>
          <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 22 }}>You</div>
          <div style={{ fontSize: 13, color: MUTED }}>@you · Attendee</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
        <div style={{ flex: 1, padding: 14, borderRadius: 16, background: "rgba(var(--ts-neutral-rgb),.05)" }}>
          <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 24 }}>{myVideos.length}</div>
          <div style={{ fontSize: 12, color: MUTED, fontWeight: 600 }}>stories posted</div>
        </div>
        <div style={{ flex: 1, padding: 14, borderRadius: 16, background: "rgba(var(--ts-neutral-rgb),.05)" }}>
          <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 24 }}>{followed.length}</div>
          <div style={{ fontSize: 12, color: MUTED, fontWeight: 600 }}>themes followed</div>
        </div>
      </div>

      <div style={{ fontSize: 13, fontWeight: 700, color: MUTED, margin: "24px 0 12px" }}>YOUR STORIES</div>
      {myVideos.length > 0 ? (
        <div style={{ display: "flex", gap: 11, flexWrap: "wrap" }}>
          {myVideos.map((v) => (
            <div key={v.id} onClick={() => onOpen(v.id)} style={{ position: "relative", width: 150, aspectRatio: "9 / 14", borderRadius: 18, overflow: "hidden", cursor: "pointer" }}>
              <Thumb video={v} theme={themeById(themes, v.theme)} />
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,transparent 45%,rgba(0,0,0,.72))" }} />
              <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: 10, fontWeight: 700, fontSize: 13, lineHeight: 1.2 }}>{v.title}</div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ padding: "28px 18px", borderRadius: 18, border: "1px dashed rgba(var(--ts-neutral-rgb),.16)", textAlign: "center" }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Share your first story</div>
          <div style={{ fontSize: 13, color: MUTED, marginTop: 6, lineHeight: 1.4 }}>60 seconds. Your idea for tomorrow.</div>
          <button onClick={onStartUpload} style={{ marginTop: 14, padding: "12px 22px", borderRadius: 13, border: "none", background: BRAND_GRAD, color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>
            Record now
          </button>
        </div>
      )}

      <div style={{ fontSize: 13, fontWeight: 700, color: MUTED, margin: "26px 0 12px" }}>FOLLOWING</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 9 }}>
        {followed.length === 0 && <span style={{ fontSize: 13, color: MUTED2 }}>Not following any themes yet.</span>}
        {followed.map((t) => (
          <span key={t.id} style={{ padding: "8px 14px", borderRadius: 999, fontSize: 13, fontWeight: 700, border: `1px solid ${t.color}`, color: t.color, background: `${t.color}1a` }}>
            {t.name}
          </span>
        ))}
      </div>
    </div>
  );
}
