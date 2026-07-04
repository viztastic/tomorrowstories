import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { DEMO } from "../config";
import { ACCENT, BRAND_GRAD, FONT_DISPLAY, INK, MUTED, MUTED2 } from "../design";
import { Spinner } from "./common";
import type { EventDTO } from "../types";

const KEY = "ts:adminKey";

export function Admin() {
  const [savedKey, setSavedKey] = useState(() => sessionStorage.getItem(KEY) || "");
  const [authed, setAuthed] = useState(false);
  const [events, setEvents] = useState<EventDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState("");
  const [err, setErr] = useState<string | null>(null);

  async function load(k: string) {
    if (!k) return;
    setLoading(true);
    setErr(null);
    try {
      const evs = await api.adminListEvents(k);
      setEvents(evs);
      setAuthed(true);
      sessionStorage.setItem(KEY, k);
      setSavedKey(k);
    } catch {
      setErr("That password didn’t work.");
      setAuthed(false);
      sessionStorage.removeItem(KEY);
    } finally {
      setLoading(false);
    }
  }

  // Auto-unlock if we already have a key from this browser session.
  useEffect(() => {
    if (savedKey) load(savedKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function signOut() {
    sessionStorage.removeItem(KEY);
    setSavedKey("");
    setAuthed(false);
    setEvents([]);
    setInput("");
  }

  if (!authed) {
    return (
      <div style={page}>
        <Header />
        <div style={{ ...card, maxWidth: 420 }}>
          <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 22, letterSpacing: "-.02em" }}>Organizer console</div>
          <div style={{ fontSize: 13.5, color: MUTED, marginTop: 8, lineHeight: 1.5 }}>Enter the admin password to see every session and its links.</div>
          {err && <div style={errBox}>{err}</div>}
          <input
            type="password"
            style={{ ...input8, marginTop: err ? 10 : 18 }}
            placeholder="Admin password"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load(input.trim())}
            autoFocus
          />
          <button style={{ ...primaryBtn, marginTop: 12 }} onClick={() => load(input.trim())} disabled={loading}>
            {loading ? <Spinner size={18} /> : null}
            {loading ? "Checking…" : "Unlock"}
          </button>
          {DEMO && <div style={{ color: MUTED2, fontSize: 12, marginTop: 14 }}>Demo mode — any password works.</div>}
        </div>
      </div>
    );
  }

  return (
    <div style={page}>
      <Header />
      <div style={{ width: "100%", maxWidth: 780 }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, marginBottom: 18 }}>
          <div>
            <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 26, letterSpacing: "-.02em" }}>Sessions</div>
            <div style={{ fontSize: 13, color: MUTED, marginTop: 4 }}>{events.length} event{events.length === 1 ? "" : "s"}</div>
          </div>
          <button onClick={signOut} style={ghostBtn}>Lock</button>
        </div>

        {events.length === 0 && <div style={{ color: MUTED2, padding: "40px 0", textAlign: "center" }}>No sessions yet.</div>}

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {events.map((e) => (
            <SessionCard key={e.eventId} ev={e} />
          ))}
        </div>
      </div>
    </div>
  );
}

function SessionCard({ ev }: { ev: EventDTO }) {
  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 18 }}>{ev.name}</span>
        <span style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: ".08em", color: "#0C0A12", background: "#F4F1EC", padding: "3px 9px", borderRadius: 999 }}>{ev.code}</span>
        <span style={{ fontSize: 12, color: MUTED2, marginLeft: "auto" }}>{fmtDate(ev.createdAt)}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
        <LinkRow label="Attendee" url={ev.attendeeUrl} />
        <LinkRow label="Big screen" url={ev.bigScreenUrl} />
      </div>
    </div>
  );
}

function LinkRow({ label, url }: { label: string; url: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard?.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }
  return (
    <div style={linkRow}>
      <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".06em", color: MUTED2, width: 78, flex: "none" }}>{label.toUpperCase()}</span>
      <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: "#C9C6D4", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{url}</span>
      <button onClick={copy} style={chip}>{copied ? "Copied ✓" : "Copy"}</button>
      <a href={url} target="_blank" rel="noreferrer" style={{ ...chip, textDecoration: "none", display: "inline-flex", alignItems: "center" }}>Open</a>
    </div>
  );
}

function Header() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 30 }}>
      <div style={{ width: 38, height: 38, borderRadius: 12, background: BRAND_GRAD, boxShadow: `0 6px 20px -6px ${ACCENT}` }} />
      <div style={{ display: "flex", flexDirection: "column", lineHeight: 1 }}>
        <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 20, letterSpacing: "-.01em" }}>Tomorrow Stories</span>
        <Link to="/" style={{ fontSize: 11, color: MUTED, fontWeight: 600, letterSpacing: ".04em", marginTop: 4, textDecoration: "none" }}>ADMIN · BACK TO SITE ↗</Link>
      </div>
    </div>
  );
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

const page: CSSProperties = {
  minHeight: "100dvh",
  background: "radial-gradient(1300px 740px at 50% -8%, #223159, #0C1024 60%)",
  color: INK,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  padding: "calc(40px + env(safe-area-inset-top)) 18px calc(40px + env(safe-area-inset-bottom))",
};
const card: CSSProperties = { width: "100%", background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.09)", borderRadius: 20, padding: 20 };
const input8: CSSProperties = { width: "100%", background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 14, padding: "14px 16px", color: INK, fontSize: 15, fontFamily: "inherit", outline: "none" };
const primaryBtn: CSSProperties = { width: "100%", padding: 15, borderRadius: 14, border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 800, fontSize: 15, color: "#fff", background: BRAND_GRAD, display: "flex", alignItems: "center", justifyContent: "center", gap: 9 };
const ghostBtn: CSSProperties = { padding: "9px 16px", borderRadius: 999, border: "1px solid rgba(255,255,255,.16)", background: "transparent", color: INK, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" };
const chip: CSSProperties = { flex: "none", padding: "7px 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,.14)", background: "rgba(255,255,255,.05)", color: INK, fontWeight: 700, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" };
const linkRow: CSSProperties = { display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.06)", borderRadius: 12, padding: "9px 11px" };
const errBox: CSSProperties = { marginTop: 14, padding: "10px 13px", borderRadius: 12, background: "rgba(255,61,87,.12)", border: "1px solid rgba(255,61,87,.35)", color: "#FF9DB0", fontSize: 13, fontWeight: 600 };
