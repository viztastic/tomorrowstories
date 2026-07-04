import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import { DEMO } from "../config";
import { BRAND_GRAD, ACCENT, FONT_DISPLAY, INK, MUTED, MUTED2, PAGE_BG, THEMES } from "../design";
import { PaletteProvider } from "../PaletteProvider";
import { DEFAULT_PALETTE_ID } from "../palettes";
import { PalettePicker } from "./organizer/PalettePicker";
import { TopicEditor } from "./organizer/TopicEditor";
import { Spinner } from "./common";
import type { Theme } from "../types";

const page: React.CSSProperties = {
  minHeight: "100vh",
  background: PAGE_BG,
  color: INK,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: "calc(48px + env(safe-area-inset-top)) 20px calc(48px + env(safe-area-inset-bottom))",
  gap: 34,
};

const card: React.CSSProperties = {
  width: "100%",
  maxWidth: 460,
  background: "rgba(255,255,255,.04)",
  border: "1px solid rgba(255,255,255,.09)",
  borderRadius: 24,
  padding: 30,
};

const input: React.CSSProperties = {
  width: "100%",
  background: "rgba(255,255,255,.06)",
  border: "1px solid rgba(255,255,255,.1)",
  borderRadius: 14,
  padding: "15px 16px",
  color: INK,
  fontSize: 15,
  fontFamily: "inherit",
  outline: "none",
};

const primaryBtn: React.CSSProperties = {
  width: "100%",
  padding: 16,
  borderRadius: 15,
  border: "none",
  cursor: "pointer",
  fontFamily: "inherit",
  fontWeight: 800,
  fontSize: 15.5,
  color: "#fff",
  background: BRAND_GRAD,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 9,
};

const outlineBtn: React.CSSProperties = {
  width: "100%",
  padding: 15,
  borderRadius: 15,
  border: "1px solid rgba(255,255,255,.22)",
  cursor: "pointer",
  fontFamily: "inherit",
  fontWeight: 700,
  fontSize: 15,
  color: INK,
  background: "transparent",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 9,
};

const sectionLabel: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: ".07em",
  color: MUTED2,
  margin: "20px 0 10px",
};

const linkBtn: React.CSSProperties = {
  marginTop: 14,
  padding: 0,
  border: "none",
  background: "transparent",
  color: MUTED,
  fontWeight: 700,
  fontSize: 13,
  cursor: "pointer",
  fontFamily: "inherit",
  textAlign: "left",
};

export type LandingMode = "full" | "join" | "create";

export function Landing({ mode = "full" }: { mode?: LandingMode }) {
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [palette, setPalette] = useState(DEFAULT_PALETTE_ID);
  const [topics, setTopics] = useState<Theme[]>(THEMES);
  const [showCustomize, setShowCustomize] = useState(false);
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [joinRaw, setJoinRaw] = useState("");
  const [err, setErr] = useState<{ scope: "join" | "create"; msg: string } | null>(null);

  async function join() {
    const raw = joinRaw.trim();
    if (!raw) {
      setErr({ scope: "join", msg: "Enter the event code, or paste the event link." });
      return;
    }
    setErr(null);
    // 1) a full link containing /e/<id>
    const linkMatch = /\/e\/([a-z0-9]+)/i.exec(raw);
    if (linkMatch) return nav(`/e/${linkMatch[1]}`);
    // 2) a full event id pasted on its own
    if (/^[a-z0-9]{12,}$/i.test(raw)) return nav(`/e/${raw.toLowerCase()}`);
    // 3) otherwise treat it as a short event code and look it up
    setJoining(true);
    try {
      const id = await api.resolveCode(raw);
      nav(`/e/${id}`);
    } catch {
      setErr({ scope: "join", msg: "We couldn’t find that event. Double-check the code and try again." });
      setJoining(false);
    }
  }

  async function create() {
    setCreating(true);
    setErr(null);
    try {
      const ev = await api.createEvent(name.trim() || "Tomorrow Stories", { palette, themes: topics });
      nav(`/e/${ev.eventId}/big`);
    } catch (e) {
      setErr({ scope: "create", msg: e instanceof Error ? e.message : "Could not create event" });
      setCreating(false);
    }
  }

  const showJoin = mode !== "create";
  const showCreate = mode !== "join";

  const joinCard = (
    <div style={card}>
      <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 23, letterSpacing: "-.02em" }}>Join the wall</div>
      <div style={{ fontSize: 14, color: MUTED, marginTop: 8, lineHeight: 1.5 }}>
        Scan the QR on the big screen, or enter the event code shown beneath it.
      </div>
      {err?.scope === "join" && <ErrLine msg={err.msg} />}
      <input
        style={{ ...input, marginTop: err?.scope === "join" ? 10 : 20 }}
        placeholder="Event code (or link)"
        value={joinRaw}
        onChange={(e) => setJoinRaw(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && join()}
        autoCapitalize="characters"
        autoCorrect="off"
        aria-invalid={err?.scope === "join"}
      />
      <button style={{ ...primaryBtn, marginTop: 12 }} onClick={join} disabled={joining}>
        {joining ? <Spinner size={18} /> : null}
        {joining ? "Joining…" : "Join event"}
      </button>
    </div>
  );

  // On the dedicated /create page this is the only action, so it gets the
  // filled CTA. On the combined "/" page it stays the outlined secondary.
  const createPrimary = mode === "create";
  const createCard = (
    <div style={card}>
      {mode === "full" && <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".09em", color: MUTED2 }}>FOR ORGANIZERS</div>}
      <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: createPrimary ? 23 : 20, letterSpacing: "-.02em", marginTop: mode === "full" ? 8 : 0 }}>Start an event</div>
      <div style={{ fontSize: 13.5, color: MUTED, marginTop: 6, lineHeight: 1.5 }}>
        Create a private story wall with its own QR code for your venue’s big screen.
      </div>
      {err?.scope === "create" && <ErrLine msg={err.msg} />}
      <input
        style={{ ...input, marginTop: err?.scope === "create" ? 10 : 18 }}
        placeholder="Event name (optional)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && create()}
      />

      <div style={sectionLabel}>WALL & APP THEME</div>
      <PalettePicker value={palette} onChange={setPalette} />

      <button type="button" onClick={() => setShowCustomize((v) => !v)} style={linkBtn}>
        {showCustomize ? "− Hide topic customization" : "+ Customize the topics attendees pick"}
      </button>
      {showCustomize && (
        <div style={{ marginTop: 4 }}>
          <TopicEditor themes={topics} onChange={setTopics} />
        </div>
      )}

      <button style={{ ...(createPrimary ? primaryBtn : outlineBtn), marginTop: 16 }} onClick={create} disabled={creating}>
        {creating ? <Spinner size={18} /> : null}
        {creating ? "Creating…" : "Create event & open big screen"}
      </button>
    </div>
  );

  return (
    // While the organizer is on a create surface, preview the selected palette
    // live across the page; on join-only it renders the default look.
    <PaletteProvider paletteId={showCreate ? palette : undefined}>
    <div style={page}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 13, background: BRAND_GRAD, boxShadow: `0 6px 20px -6px ${ACCENT}` }} />
        <div style={{ display: "flex", flexDirection: "column", lineHeight: 1 }}>
          <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 24, letterSpacing: "-.01em" }}>Tomorrow Stories</span>
          <span style={{ fontSize: 11, color: MUTED, fontWeight: 600, letterSpacing: ".04em", marginTop: 4 }}>CONFERENCE STORY WALL</span>
        </div>
      </div>

      {showJoin && joinCard}
      {showCreate && createCard}

      {DEMO && <div style={{ color: MUTED2, fontSize: 12 }}>Demo mode — no backend; data is seeded and in-memory.</div>}
      {mode === "full" && (
        <Link to="/admin" style={{ color: MUTED2, fontSize: 12, fontWeight: 700, textDecoration: "none" }}>Organizer console →</Link>
      )}
    </div>
    </PaletteProvider>
  );
}

function ErrLine({ msg }: { msg: string }) {
  return (
    <div
      style={{
        marginTop: 14,
        padding: "10px 13px",
        borderRadius: 12,
        background: "rgba(255,61,87,.12)",
        border: "1px solid rgba(255,61,87,.35)",
        color: "#FF9DB0",
        fontSize: 13,
        fontWeight: 600,
        lineHeight: 1.4,
      }}
    >
      {msg}
    </div>
  );
}
