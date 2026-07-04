import type { CSSProperties } from "react";
import type { Theme, VideoDTO } from "../../types";
import { CHIP_ON, CHIP_ON_INK, FONT_DISPLAY, MUTED, MUTED2, ON_ACCENT, themeById } from "../../design";
import { VideoCard } from "./VideoCard";

function chipStyle(on: boolean, fill: string): CSSProperties {
  return {
    padding: "9px 15px",
    borderRadius: 999,
    whiteSpace: "nowrap",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "inherit",
    border: "1px solid " + (on ? fill : "rgba(var(--ts-neutral-rgb),.13)"),
    background: on ? fill : "rgba(var(--ts-neutral-rgb),.04)",
    color: on ? CHIP_ON_INK : MUTED,
  };
}

function followStyle(on: boolean, color: string): CSSProperties {
  return {
    padding: "6px 14px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "inherit",
    border: "1px solid " + (on ? color : "rgba(var(--ts-neutral-rgb),.14)"),
    background: on ? color : "transparent",
    color: on ? ON_ACCENT : MUTED,
  };
}

export function Wall({
  videos,
  themes,
  activeTheme,
  setActiveTheme,
  follows,
  toggleFollow,
  myIds,
  onOpen,
}: {
  videos: VideoDTO[];
  themes: Theme[];
  activeTheme: string;
  setActiveTheme: (id: string) => void;
  follows: Record<string, boolean>;
  toggleFollow: (id: string) => void;
  myIds: Set<string>;
  onOpen: (id: string) => void;
}) {
  const chips = [{ id: "all", name: "All", color: "#F4F1EC" }, ...themes];
  const shown = activeTheme === "all" ? themes : themes.filter((t) => t.id === activeTheme);
  const groups = shown
    .map((t) => ({ theme: t, vids: videos.filter((v) => v.theme === t.id) }))
    .filter((g) => g.vids.length);

  return (
    <div style={{ paddingBottom: 8 }}>
      <div style={{ padding: "6px 18px 10px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 26, letterSpacing: "-.02em" }}>The Wall</div>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 3 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#2FD37E", animation: "blink 1.6s infinite" }} />
            <span style={{ fontSize: 12, color: MUTED, fontWeight: 600 }}>{videos.length} stories · updating live</span>
          </div>
        </div>
        <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(var(--ts-neutral-rgb),.06)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <circle cx="11" cy="11" r="7" stroke="#C9C6D4" strokeWidth="1.8" />
            <path d="M16.5 16.5L21 21" stroke="#C9C6D4" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, overflowX: "auto", padding: "6px 18px 14px" }}>
        {chips.map((c) => {
          const on = activeTheme === c.id;
          const fill = c.id === "all" ? CHIP_ON : c.color;
          return (
            <button key={c.id} style={chipStyle(on, fill)} onClick={() => setActiveTheme(c.id)}>
              {c.name}
            </button>
          );
        })}
      </div>

      {groups.length === 0 && (
        <div style={{ padding: "50px 24px", textAlign: "center", color: MUTED2, fontWeight: 600, lineHeight: 1.5 }}>
          No stories yet. Tap the + to add the first one.
        </div>
      )}

      {groups.map(({ theme, vids }) => {
        const fol = !!follows[theme.id];
        return (
          <div key={theme.id}>
            <div style={{ padding: "8px 18px 4px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <span style={{ width: 11, height: 11, borderRadius: "50%", background: theme.color, boxShadow: `0 0 12px ${theme.color}` }} />
                <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16 }}>{theme.name}</span>
                <span style={{ fontSize: 12, color: MUTED2, fontWeight: 600 }}>{vids.length}</span>
              </div>
              <button style={followStyle(fol, theme.color)} onClick={() => toggleFollow(theme.id)}>
                {fol ? "Following" : "Follow"}
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 190px))", justifyContent: "center", gap: 11, padding: "6px 18px 18px" }}>
              {vids.map((v) => (
                <VideoCard key={v.id} video={v} theme={themeById(themes, v.theme)} mine={myIds.has(v.id)} onOpen={() => onOpen(v.id)} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
