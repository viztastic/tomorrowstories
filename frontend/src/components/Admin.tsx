import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { ACCENT, BRAND_GRAD, CHIP_ON, CHIP_ON_INK, FONT_DISPLAY, INK, MUTED, MUTED2 } from "../design";
import { Spinner } from "./common";
import { OrganizerButton } from "../auth";
import { PalettePicker } from "./organizer/PalettePicker";
import { TopicEditor } from "./organizer/TopicEditor";
import { buildArchive, slug } from "../export";
import type { EventDTO, Theme } from "../types";

/** Organizer dashboard — lists the events you own (route is sign-in gated). */
export function Admin() {
  const [events, setEvents] = useState<EventDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .myEvents()
      .then((evs) => { if (alive) { setEvents(evs); setLoading(false); } })
      .catch((e) => { if (alive) { setErr(e instanceof Error ? e.message : "Couldn’t load your events"); setLoading(false); } });
    return () => { alive = false; };
  }, []);

  return (
    <div style={page}>
      <Header />
      <div style={{ width: "100%", maxWidth: 780 }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, marginBottom: 18 }}>
          <div>
            <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 26, letterSpacing: "-.02em" }}>Your events</div>
            <div style={{ fontSize: 13, color: MUTED, marginTop: 4 }}>{events.length} event{events.length === 1 ? "" : "s"}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Link to="/create" style={{ ...primaryBtn, width: "auto", padding: "10px 16px", textDecoration: "none" }}>New event</Link>
            <OrganizerButton />
          </div>
        </div>

        {err && <div style={errBox}>{err}</div>}
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}><Spinner size={26} /></div>
        ) : events.length === 0 ? (
          <div style={{ ...card, textAlign: "center", padding: "40px 24px" }}>
            <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 22, letterSpacing: "-.02em" }}>Create your first event</div>
            <div style={{ color: MUTED, fontSize: 14, marginTop: 8, lineHeight: 1.5, maxWidth: 380, margin: "8px auto 0" }}>
              Pick a theme, set the topics people can post to, and get a QR your audience scans to join.
            </div>
            <Link to="/create" style={{ ...primaryBtn, width: "auto", padding: "12px 22px", textDecoration: "none", display: "inline-flex", marginTop: 20 }}>
              Create an event
            </Link>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {events.map((e) => (
              <SessionCard
                key={e.eventId}
                ev={e}
                onDeleted={() => setEvents((prev) => prev.filter((x) => x.eventId !== e.eventId))}
                onUpdated={(updated) => setEvents((prev) => prev.map((x) => (x.eventId === updated.eventId ? updated : x)))}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SessionCard({ ev, onDeleted, onUpdated }: { ev: EventDTO; onDeleted: () => void; onUpdated: (ev: EventDTO) => void }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState<"" | "delete" | "download" | "save">("");
  const [dl, setDl] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draftPalette, setDraftPalette] = useState(ev.palette);
  const [draftThemes, setDraftThemes] = useState<Theme[]>(ev.themes);

  function openEdit() {
    setDraftPalette(ev.palette);
    setDraftThemes(ev.themes);
    setErr(null);
    setEditing(true);
  }

  async function saveEdit() {
    setBusy("save");
    setErr(null);
    try {
      const updated = await api.updateEvent(ev.eventId, { palette: draftPalette, themes: draftThemes });
      onUpdated(updated);
      setEditing(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy("");
    }
  }

  async function doDelete() {
    setBusy("delete");
    setErr(null);
    try {
      await api.deleteEvent(ev.eventId);
      onDeleted();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Delete failed");
      setBusy("");
      setConfirming(false);
    }
  }

  async function download() {
    setBusy("download");
    setErr(null);
    setDl("Preparing…");
    try {
      const { event, videos } = await api.listVideos(ev.eventId);
      const live = videos.filter((v) => v.status === "live" && v.mediaUrl);
      if (live.length === 0) {
        setErr("No live videos to download yet.");
        setDl(null);
        return;
      }
      const comments = await api.listEventComments(ev.eventId).catch(() => []);
      const blob = await buildArchive(event, videos, comments, (done, total) => setDl(`Downloading ${done}/${total}…`));
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${slug(ev.name)}-wall.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setDl("Downloaded ✓");
      setTimeout(() => setDl(null), 2500);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Download failed");
      setDl(null);
    } finally {
      setBusy("");
    }
  }

  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 18 }}>{ev.name}</span>
        <span style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: ".08em", color: CHIP_ON_INK, background: CHIP_ON, padding: "3px 9px", borderRadius: 999 }}>{ev.code}</span>
        {ev.creatorIp && (
          <span title="Creator IP" style={{ fontSize: 11.5, fontWeight: 700, color: "#C9C6D4", background: "rgba(var(--ts-neutral-rgb),.06)", border: "1px solid rgba(var(--ts-neutral-rgb),.1)", padding: "3px 9px", borderRadius: 8, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>⚲ {ev.creatorIp}</span>
        )}
        <span style={{ fontSize: 12, color: MUTED2, marginLeft: "auto" }}>{fmtDate(ev.createdAt)}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
        <LinkRow label="Attendee" url={ev.attendeeUrl} />
        <LinkRow label="Big screen" url={ev.bigScreenUrl} />
      </div>
      {err && <div style={{ ...errBox, marginTop: 12 }}>{err}</div>}
      {editing && (
        <div style={{ marginTop: 14, padding: 14, borderRadius: 14, background: "rgba(var(--ts-neutral-rgb),.03)", border: "1px solid rgba(var(--ts-neutral-rgb),.08)" }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".07em", color: MUTED2, marginBottom: 10 }}>WALL & APP THEME</div>
          <PalettePicker value={draftPalette} onChange={setDraftPalette} />
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".07em", color: MUTED2, margin: "18px 0 10px" }}>TOPICS ATTENDEES CAN PICK</div>
          <TopicEditor themes={draftThemes} onChange={setDraftThemes} />
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <button onClick={saveEdit} disabled={busy === "save"} style={{ ...primaryBtn, width: "auto", padding: "10px 18px" }}>
              {busy === "save" ? "Saving…" : "Save changes"}
            </button>
            <button onClick={() => setEditing(false)} disabled={busy === "save"} style={chip}>Cancel</button>
          </div>
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
        <button onClick={download} disabled={!!busy} style={chip}>
          {busy === "download" ? dl ?? "Working…" : "⬇ Download archive"}
        </button>
        <button onClick={editing ? () => setEditing(false) : openEdit} disabled={busy === "delete" || busy === "download"} style={chip}>
          {editing ? "Close editor" : "✎ Edit theme & topics"}
        </button>
        {dl && busy !== "download" && <span style={{ fontSize: 12.5, color: MUTED, fontWeight: 700 }}>{dl}</span>}
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          {confirming ? (
            <>
              <button onClick={() => setConfirming(false)} disabled={busy === "delete"} style={chip}>Cancel</button>
              <button onClick={doDelete} disabled={!!busy} style={dangerBtn}>
                {busy === "delete" ? "Deleting…" : "Confirm delete"}
              </button>
            </>
          ) : (
            <button onClick={() => setConfirming(true)} disabled={!!busy} style={dangerGhost}>Delete</button>
          )}
        </div>
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
const card: CSSProperties = { width: "100%", background: "rgba(var(--ts-neutral-rgb),.04)", border: "1px solid rgba(var(--ts-neutral-rgb),.09)", borderRadius: 20, padding: 20 };
const primaryBtn: CSSProperties = { width: "100%", padding: 15, borderRadius: 14, border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 800, fontSize: 15, color: "#fff", background: BRAND_GRAD, display: "flex", alignItems: "center", justifyContent: "center", gap: 9 };
const chip: CSSProperties = { flex: "none", padding: "7px 12px", borderRadius: 10, border: "1px solid rgba(var(--ts-neutral-rgb),.14)", background: "rgba(var(--ts-neutral-rgb),.05)", color: INK, fontWeight: 700, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" };
const linkRow: CSSProperties = { display: "flex", alignItems: "center", gap: 8, background: "rgba(var(--ts-neutral-rgb),.03)", border: "1px solid rgba(var(--ts-neutral-rgb),.06)", borderRadius: 12, padding: "9px 11px" };
const dangerGhost: CSSProperties = { flex: "none", padding: "7px 14px", borderRadius: 10, border: "1px solid rgba(255,61,87,.4)", background: "transparent", color: "#FF7A9C", fontWeight: 700, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" };
const dangerBtn: CSSProperties = { flex: "none", padding: "7px 14px", borderRadius: 10, border: "none", background: "#E23558", color: "#fff", fontWeight: 800, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" };
const errBox: CSSProperties = { marginTop: 14, padding: "10px 13px", borderRadius: 12, background: "rgba(255,61,87,.12)", border: "1px solid rgba(255,61,87,.35)", color: "#FF9DB0", fontSize: 13, fontWeight: 600 };
