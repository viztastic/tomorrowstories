import type { CSSProperties } from "react";
import type { Theme, VideoDTO } from "../../types";
import { FONT_DISPLAY, INK, MUTED, ON_ACCENT, pairFor } from "../../design";

function followStyle(on: boolean): CSSProperties {
  return {
    padding: "7px 15px",
    borderRadius: 999,
    fontSize: 12.5,
    fontWeight: 800,
    cursor: "pointer",
    fontFamily: "inherit",
    border: "none",
    background: on ? ON_ACCENT : "rgba(255,255,255,.92)",
    color: on ? INK : ON_ACCENT,
  };
}

export function ThemesScreen({
  themes,
  videos,
  follows,
  toggleFollow,
}: {
  themes: Theme[];
  videos: VideoDTO[];
  follows: Record<string, boolean>;
  toggleFollow: (id: string) => void;
}) {
  return (
    <div style={{ padding: "6px 18px 8px" }}>
      <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 26, letterSpacing: "-.02em", padding: "0 0 4px" }}>Themes</div>
      <div style={{ fontSize: 13, color: MUTED, fontWeight: 500, marginBottom: 18 }}>Follow the conversations you care about.</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
        {themes.map((t) => {
          const fol = !!follows[t.id];
          const themed = videos.filter((v) => v.theme === t.id);
          const dots = themed.slice(0, 3);
          return (
            <div
              key={t.id}
              style={{
                position: "relative",
                borderRadius: 20,
                overflow: "hidden",
                padding: 18,
                minHeight: 112,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                background: `linear-gradient(135deg,${t.color}, ${t.color}22)`,
              }}
            >
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(120deg,rgba(0,0,0,.15),rgba(0,0,0,.5))" }} />
              <div style={{ position: "relative", display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 20, letterSpacing: "-.01em" }}>{t.name}</div>
                  <div style={{ fontSize: 12.5, color: "rgba(255,255,255,.82)", fontWeight: 600, marginTop: 3 }}>{themed.length} stories</div>
                </div>
                <button style={followStyle(fol)} onClick={() => toggleFollow(t.id)}>
                  {fol ? "Following" : "Follow"}
                </button>
              </div>
              <div style={{ position: "relative", display: "flex", gap: 5 }}>
                {dots.map((v) => {
                  const pair = pairFor(t, v.id);
                  return <span key={v.id} style={{ background: `linear-gradient(158deg,${pair[0]},${pair[1]})`, width: 34, height: 44, borderRadius: 8 }} />;
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
