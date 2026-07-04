import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { CSSProperties } from "react";
import type { LocalComment } from "../../types";
import { api } from "../../api";
import { ACCENT, BRAND_GRAD, CHIP_ON, CHIP_ON_INK, FONT_DISPLAY, HEADER_BG, INK, MUTED, MUTED2, OVERLAY_BG, PAGE_BG, themeById } from "../../design";
import { PaletteProvider } from "../../PaletteProvider";
import { Spinner } from "../common";
import { useEventData } from "../../useEventData";
import { useMediaQuery } from "../../useMediaQuery";
import { Wall } from "./Wall";
import { ThemesScreen } from "./ThemesScreen";
import { YouScreen } from "./YouScreen";
import { VideoView } from "./VideoView";
import { UploadFlow } from "./UploadFlow";

type Screen = "gallery" | "themes" | "video" | "upload" | "you";

function loadSet(key: string): Set<string> {
  try {
    return new Set<string>(JSON.parse(localStorage.getItem(key) || "[]"));
  } catch {
    return new Set();
  }
}
function saveSet(key: string, s: Set<string>) {
  try {
    localStorage.setItem(key, JSON.stringify([...s]));
  } catch {
    /* ignore */
  }
}

export function Attendee({ eventId }: { eventId: string }) {
  const data = useEventData(eventId, 5000);
  const isMobile = useMediaQuery("(max-width: 720px)");
  const [screen, setScreen] = useState<Screen>("gallery");
  const [activeTheme, setActiveTheme] = useState("all");
  const [sel, setSel] = useState<string | null>(null);
  const [follows, setFollows] = useState<Record<string, boolean>>({ green: true });
  const [comments, setComments] = useState<Record<string, LocalComment[]>>({});
  const [cdraft, setCdraft] = useState("");
  const [liked, setLiked] = useState<Set<string>>(() => loadSet(`ts:${eventId}:liked`));
  const [myIds, setMyIds] = useState<Set<string>>(() => loadSet(`ts:${eventId}:mine`));

  useEffect(() => saveSet(`ts:${eventId}:liked`, liked), [eventId, liked]);
  useEffect(() => saveSet(`ts:${eventId}:mine`, myIds), [eventId, myIds]);

  const themes = data.event?.themes ?? [];
  const current = useMemo(() => data.videos.find((v) => v.id === sel) || null, [data.videos, sel]);

  function toggleFollow(id: string) {
    setFollows((f) => ({ ...f, [id]: !f[id] }));
  }
  async function like(id: string) {
    if (liked.has(id)) return;
    setLiked((s) => new Set(s).add(id));
    data.bumpLike(id, (current?.likes ?? 0) + 1);
    try {
      const likes = await api.like(eventId, id);
      data.bumpLike(id, likes);
    } catch {
      /* keep optimistic value */
    }
  }
  function sendComment() {
    const t = cdraft.trim();
    if (!t || !sel) return;
    setComments((c) => ({ ...c, [sel]: [...(c[sel] || []), { n: "You", t, c: ACCENT }] }));
    setCdraft("");
  }

  const showTabs = screen === "gallery" || screen === "themes" || screen === "you";
  const myVideos = data.videos.filter((v) => myIds.has(v.id));
  const openUpload = () => setScreen("upload");

  if (data.loading && !data.event) {
    return (
      <Shell>
        <div style={centerBox}><Spinner size={30} /><div style={{ marginTop: 14, color: MUTED }}>Loading the wall…</div></div>
      </Shell>
    );
  }
  if (!data.event) {
    return (
      <Shell>
        <div style={centerBox}>
          <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 24 }}>Event not found</div>
          <div style={{ color: MUTED, marginTop: 8, maxWidth: 320, textAlign: "center" }}>
            This link may be wrong or the event has ended. Scan the QR on the big screen to join.
          </div>
          <Link to="/" style={{ marginTop: 18, color: ACCENT, fontWeight: 700 }}>Back to start</Link>
        </div>
      </Shell>
    );
  }

  const openVideo = (id: string) => { setSel(id); setScreen("video"); };

  return (
    <PaletteProvider paletteId={data.event.palette}>
    <div style={pageShell}>
      {/* ---- sticky header ---- */}
      <header style={headerStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
          <div style={{ width: 32, height: 32, flex: "none", borderRadius: 10, background: BRAND_GRAD, boxShadow: `0 6px 20px -6px ${ACCENT}` }} />
          <div style={{ display: "flex", flexDirection: "column", lineHeight: 1, minWidth: 0 }}>
            <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 17, letterSpacing: "-.01em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{data.event.name}</span>
            <span style={{ fontSize: 10, color: MUTED, fontWeight: 600, letterSpacing: ".05em", marginTop: 3 }}>CONFERENCE STORY WALL</span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {!isMobile && (
            <nav style={{ display: "flex", gap: 2, marginRight: 4 }}>
              <HeaderTab label="Wall" active={screen === "gallery"} onClick={() => setScreen("gallery")} />
              <HeaderTab label="Themes" active={screen === "themes"} onClick={() => setScreen("themes")} />
              <HeaderTab label="You" active={screen === "you"} onClick={() => setScreen("you")} />
            </nav>
          )}
          {!isMobile && (
            <button aria-label="Add your story" onClick={openUpload} style={addBtn}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M12 5V19M5 12H19" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" /></svg>
              Add story
            </button>
          )}
          <Link to={`/e/${eventId}/big`} style={bigLink}>Big screen ↗</Link>
        </div>
      </header>

      {/* ---- feed ---- */}
      <main style={{ flex: 1, width: "100%", maxWidth: 980, margin: "0 auto", padding: isMobile ? "0 0 calc(96px + env(safe-area-inset-bottom))" : "8px 0 48px" }}>
        {screen === "gallery" && (
          <Wall videos={data.videos} themes={themes} activeTheme={activeTheme} setActiveTheme={setActiveTheme} follows={follows} toggleFollow={toggleFollow} myIds={myIds} onOpen={openVideo} />
        )}
        {screen === "themes" && <ThemesScreen themes={themes} videos={data.videos} follows={follows} toggleFollow={toggleFollow} />}
        {screen === "you" && <YouScreen themes={themes} myVideos={myVideos} follows={follows} onOpen={openVideo} onStartUpload={openUpload} />}
      </main>

      {/* ---- mobile bottom nav + FAB ---- */}
      {isMobile && showTabs && (
        <>
          <button aria-label="Add your story" onClick={openUpload} style={fabFixed}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none"><path d="M12 5V19M5 12H19" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" /></svg>
          </button>
          <nav style={bottomNav}>
            <NavBtn label="Wall" active={screen === "gallery"} onClick={() => setScreen("gallery")}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><rect x="4" y="4" width="7" height="7" rx="1.6" stroke="currentColor" strokeWidth="1.8" /><rect x="13" y="4" width="7" height="7" rx="1.6" stroke="currentColor" strokeWidth="1.8" /><rect x="4" y="13" width="7" height="7" rx="1.6" stroke="currentColor" strokeWidth="1.8" /><rect x="13" y="13" width="7" height="7" rx="1.6" stroke="currentColor" strokeWidth="1.8" /></svg>
            </NavBtn>
            <NavBtn label="Themes" active={screen === "themes"} onClick={() => setScreen("themes")}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M4 7l8-3 8 3-8 3-8-3z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /><path d="M4 12l8 3 8-3M4 17l8 3 8-3" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></svg>
            </NavBtn>
            <NavBtn label="You" active={screen === "you"} onClick={() => setScreen("you")}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="3.4" stroke="currentColor" strokeWidth="1.8" /><path d="M5 20c0-3.6 3.1-5.5 7-5.5s7 1.9 7 5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
            </NavBtn>
          </nav>
        </>
      )}

      {/* ---- overlays ---- */}
      {screen === "video" && current && (
        <Overlay isMobile={isMobile}>
          <VideoView
            video={current}
            theme={themeById(themes, current.theme)}
            liked={liked.has(current.id)}
            onLike={() => like(current.id)}
            following={!!follows[current.theme]}
            onToggleFollow={() => toggleFollow(current.theme)}
            comments={comments[current.id] || []}
            commentDraft={cdraft}
            onCommentChange={setCdraft}
            onSendComment={sendComment}
            onBack={() => { setScreen("gallery"); setSel(null); }}
          />
        </Overlay>
      )}
      {screen === "upload" && (
        <Overlay isMobile={isMobile}>
          <UploadFlow
            eventId={eventId}
            themes={themes}
            onUploaded={(v) => { data.addLocal(v); setMyIds((s) => new Set(s).add(v.id)); }}
            onClose={() => { setScreen("gallery"); setActiveTheme("all"); }}
          />
        </Overlay>
      )}
    </div>
    </PaletteProvider>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div style={pageShell}>{children}</div>;
}

function Overlay({ isMobile, children }: { isMobile: boolean; children: React.ReactNode }) {
  if (isMobile) {
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 50, background: OVERLAY_BG, display: "flex", flexDirection: "column", paddingTop: "env(safe-area-inset-top)" }}>
        {children}
      </div>
    );
  }
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(4,3,10,.72)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 440, height: "min(880px, 92vh)", background: OVERLAY_BG, borderRadius: 28, overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 40px 120px -30px #000, 0 0 0 1px rgba(var(--ts-neutral-rgb),.06)" }}>
        {children}
      </div>
    </div>
  );
}

function HeaderTab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{ padding: "8px 14px", borderRadius: 999, border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: 14, color: active ? CHIP_ON_INK : MUTED, background: active ? CHIP_ON : "transparent" }}
    >
      {label}
    </button>
  );
}

function NavBtn({ label, active, onClick, children }: { label: string; active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, color: active ? ACCENT : MUTED2, fontFamily: "inherit", flex: 1 }}>
      {children}
      <span style={{ fontSize: 10.5, fontWeight: 700 }}>{label}</span>
    </button>
  );
}

const pageShell: CSSProperties = {
  minHeight: "100dvh",
  background: PAGE_BG,
  backgroundAttachment: "fixed",
  color: INK,
  display: "flex",
  flexDirection: "column",
};
const headerStyle: CSSProperties = {
  position: "sticky",
  top: 0,
  zIndex: 30,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  padding: "calc(env(safe-area-inset-top) + 12px) 16px 12px",
  background: HEADER_BG,
  backdropFilter: "blur(12px)",
  borderBottom: "1px solid rgba(var(--ts-neutral-rgb),.06)",
};
const bigLink: CSSProperties = { fontSize: 12.5, color: MUTED, fontWeight: 700, textDecoration: "none", padding: "8px 12px", borderRadius: 999, border: "1px solid rgba(var(--ts-neutral-rgb),.12)", background: "rgba(var(--ts-neutral-rgb),.04)", whiteSpace: "nowrap" };
const addBtn: CSSProperties = { display: "flex", alignItems: "center", gap: 7, padding: "9px 15px", borderRadius: 999, border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 800, fontSize: 13.5, color: "#fff", background: BRAND_GRAD };
const bottomNav: CSSProperties = {
  position: "fixed",
  left: 0,
  right: 0,
  bottom: 0,
  zIndex: 30,
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-around",
  padding: "12px 24px calc(10px + env(safe-area-inset-bottom))",
  borderTop: "1px solid rgba(var(--ts-neutral-rgb),.07)",
  background: HEADER_BG,
  backdropFilter: "blur(12px)",
};
const fabFixed: CSSProperties = {
  position: "fixed",
  right: 18,
  bottom: "calc(84px + env(safe-area-inset-bottom))",
  zIndex: 31,
  width: 56,
  height: 56,
  borderRadius: "50%",
  border: "none",
  background: BRAND_GRAD,
  boxShadow: `0 12px 30px -8px ${ACCENT}`,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
};
const centerBox: CSSProperties = { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 30, minHeight: "60vh" };
