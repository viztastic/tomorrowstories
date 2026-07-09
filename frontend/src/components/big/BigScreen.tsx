import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { Theme, VideoDTO } from "../../types";
import { ACCENT, BRAND_GRAD, DANGER, DANGER_INK, FONT_DISPLAY, INK, MUTED, MUTED2, ON_ACCENT, PAGE_BG, STAGE_BG, pairFor, stillBg, themeById } from "../../design";
import { PaletteProvider, usePalette } from "../../PaletteProvider";
import { Grain, Qr, Spinner } from "../common";
import { Thumb, VideoCard } from "../attendee/VideoCard";
import { useEventData } from "../../useEventData";
import { useMediaQuery } from "../../useMediaQuery";
import { useOrganizer } from "../../auth";
import { api } from "../../api";

const COLS = 6;
const ROWS = 4; // cells per column strip; the strip is 200% of the stage, so ~2 are on screen
const SLOTS = COLS * ROWS;
// Slot indices below MID live in the two MIDDLE rows of their column, which stay
// on screen for nearly the whole drift cycle; indices >= MID are the edge rows
// that crop in and out at the top/bottom. Clips fill middles first, so a clip on
// the wall is effectively always visible — the old marquee's "clip disappears
// for a minute" bug can't happen.
const MID = SLOTS / 2;
// Cap how many clips decode video at once so a big wall doesn't melt the
// projector. Every wall video is a SINGLE <video> (the drift animation reverses
// instead of wrapping, so no cloned copy exists to desync or sit blank), and
// every one of them actually plays.
const MAX_AUTOPLAY = 12;
// Per-column drift durations — offbeat lengths so the columns move out of phase.
const DURS = [46, 58, 50, 62, 48, 56];
// A clip missing from one poll isn't freed immediately: eventually-consistent
// reads can transiently drop a fresh clip, and freeing would restart it (and
// churn its neighbours) when it reappears 4s later.
const GRACE_MS = 10_000;

type Cell =
  | { kind: "video"; v: VideoDTO; key: string }
  | { kind: "ph"; key: string; pair: [string, string] };

/** Stable hash of a video id — seeds where its copies land on the wall. */
function idHash(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

function fmtDurShort(sec: number): string {
  return `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;
}

export function BigScreen({ eventId }: { eventId: string }) {
  const data = useEventData(eventId, 4000);
  const isWide = useMediaQuery("(min-width: 900px)");
  const live = useMemo(() => data.videos.filter((v) => v.status === "live"), [data.videos]);

  const trending = useMemo(() => {
    const themes = data.event?.themes ?? [];
    const counts = new Map<string, number>();
    live.forEach((v) => counts.set(v.theme, (counts.get(v.theme) || 0) + 1));
    return themes
      .map((t) => ({ theme: t, count: counts.get(t.id) || 0 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);
  }, [data.event, live]);

  if (data.loading && !data.event) {
    return <div style={canvasCenter}><Spinner size={34} /></div>;
  }
  if (!data.event) {
    return (
      <div style={canvasCenter}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 30 }}>Event not found</div>
          <Link to="/" style={{ color: ACCENT, fontWeight: 700 }}>Back to start</Link>
        </div>
      </div>
    );
  }

  return (
    <PaletteProvider paletteId={data.event.palette} custom={data.event.customPalette}>
      {isWide ? (
        <Projector eventId={eventId} event={data.event} live={live} trending={trending} refresh={data.refresh} />
      ) : (
        <OrganizerPanel eventId={eventId} event={data.event} live={live} trending={trending} />
      )}
    </PaletteProvider>
  );
}

/* ------------------------------------------------------------------ mobile */

function OrganizerPanel({
  eventId,
  event,
  live,
  trending,
}: {
  eventId: string;
  event: { name: string; code: string; attendeeUrl: string; themes: Theme[] };
  live: VideoDTO[];
  trending: { theme: Theme; count: number }[];
}) {
  const nav = useNavigate();
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard?.writeText(event.attendeeUrl).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      },
      () => {}
    );
  }

  return (
    <div style={mobileCanvas}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ width: 9, height: 9, borderRadius: "50%", background: DANGER, animation: "blink 1.2s infinite" }} />
        <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".14em", color: DANGER_INK }}>LIVE NOW</span>
      </div>
      <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 30, letterSpacing: "-.02em", lineHeight: 1.05, marginTop: 8 }}>{event.name}</div>
      <div style={{ fontSize: 13.5, color: MUTED, fontWeight: 600, marginTop: 6 }}>{live.length} stories from the room · updating live</div>

      {/* Share card */}
      <div style={shareCard}>
        <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 19, letterSpacing: "-.01em" }}>Get stories on the wall</div>
        <div style={{ fontSize: 13, color: MUTED, marginTop: 6, lineHeight: 1.45 }}>Show this QR, or share the link. Anyone who scans can post a 60-second story.</div>
        <div style={{ marginTop: 18 }}>
          <CredentialBlock attendeeUrl={event.attendeeUrl} code={event.code} qrSize={200} codeSize={46} align="center" />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}>
          <button onClick={copy} style={secondaryBtn}>{copied ? "Link copied ✓" : "Copy attendee link"}</button>
          <button onClick={() => nav(`/e/${eventId}`)} style={primaryBtn}>Open the live wall</button>
        </div>
      </div>

      {/* Trending */}
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".08em", color: MUTED2, margin: "26px 0 12px" }}>TRENDING THEMES</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
        {trending.map(({ theme, count }) => (
          <div key={theme.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ background: theme.color, boxShadow: `0 0 8px ${theme.color}`, width: 10, height: 10, borderRadius: "50%", flex: "none" }} />
            <span style={{ flex: 1, fontSize: 14, fontWeight: 700 }}>{theme.name}</span>
            <span style={{ fontSize: 13, color: MUTED, fontWeight: 700 }}>{count}</span>
          </div>
        ))}
      </div>

      {/* Latest stories preview */}
      {live.length > 0 && (
        <>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".08em", color: MUTED2, margin: "26px 0 12px" }}>LATEST STORIES</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 11 }}>
            {live.slice(0, 6).map((v) => (
              <VideoCard key={v.id} video={v} theme={themeById(event.themes, v.theme)} onOpen={() => nav(`/e/${eventId}`)} />
            ))}
          </div>
        </>
      )}

      <div style={{ textAlign: "center", marginTop: 26 }}>
        <Link to="/" style={{ color: MUTED2, fontWeight: 700, fontSize: 13, textDecoration: "none" }}>Tomorrow Stories</Link>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- desktop */

function Projector({
  eventId,
  event,
  live,
  trending,
  refresh,
}: {
  eventId: string;
  event: { name: string; code: string; attendeeUrl: string; themes: Theme[] };
  live: VideoDTO[];
  trending: { theme: Theme; count: number }[];
  refresh: () => void;
}) {
  // Snapshot the clip into state (not derived from the live poll) so the focus
  // view stays open on the facilitator's intent even if a poll transiently drops
  // the clip from the list.
  const [focused, setFocused] = useState<VideoDTO | null>(null);
  const [showNav, setShowNav] = useState(false);
  const themes = event.themes.length ? event.themes : [{ id: "", name: "", color: "#4D7CFF" }];

  // Wall slot assignment. Each clip is repeated across up to 3 slots so a few
  // clips fill the board; leftover slots are gradient placeholders. The mapping
  // lives in a ref and is RECONCILED each poll rather than rebuilt: a copy that's
  // already playing never moves slots (so its <video> never remounts/restarts),
  // a newly posted clip only takes free slots, and room is made by trimming a
  // REDUNDANT copy of an over-represented clip — never someone's last one.
  // Reconciling is idempotent, so StrictMode's double useMemo run is harmless.
  const slotsRef = useRef<(string | null)[]>(new Array(SLOTS).fill(null));
  const knownRef = useRef<Map<string, { v: VideoDTO; missingSince: number | null }>>(new Map());
  const cells = useMemo<Cell[]>(() => {
    const slots = slotsRef.current;
    const known = knownRef.current;
    const now = Date.now();
    // The sidebar promises "it appears here in seconds", so past the play budget
    // the wall carries the NEWEST clips; older ones live on in the table below.
    const ordered = [...live].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
    const eligible = ordered.slice(-MAX_AUTOPLAY);
    const eligIds = new Set(eligible.map((v) => v.id));
    const liveIds = new Set(live.map((v) => v.id));
    for (const v of eligible) known.set(v.id, { v, missingSince: null });

    // Free slots whose clip left. A clip that merely rotated out of the newest-N
    // frees immediately (deterministic); one that VANISHED from the poll keeps
    // its slots for GRACE_MS in case it's a transient read blip.
    const keep = new Set<string>(eligIds);
    for (const id of new Set(slots.filter(Boolean) as string[])) {
      if (eligIds.has(id)) continue;
      const k = known.get(id);
      if (k && !liveIds.has(id)) {
        if (k.missingSince == null) k.missingSince = now;
        if (now - k.missingSince < GRACE_MS) keep.add(id);
      }
    }
    for (let i = 0; i < SLOTS; i++) if (slots[i] && !keep.has(slots[i]!)) slots[i] = null;
    for (const id of [...known.keys()]) if (!keep.has(id)) known.delete(id);

    // Copy targets, oldest-first: everyone gets one slot before anyone repeats,
    // then the leftover budget tops clips up to at most 3 copies each. Clips in
    // their grace window still count — their copies are still decoding.
    const holders = [...keep].map((id) => known.get(id)!.v)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
    const base = holders.length ? Math.floor(MAX_AUTOPLAY / holders.length) : 0;
    const rem = holders.length ? MAX_AUTOPLAY % holders.length : 0;
    const target = new Map<string, number>();
    holders.forEach((v, i) => target.set(v.id, Math.max(1, Math.min(3, base + (i < rem ? 1 : 0)))));

    // Trim over-target copies. Scanning from the highest slot index means each
    // clip loses its edge-row copies first and keeps its always-visible one.
    const count = new Map<string, number>();
    slots.forEach((id) => { if (id) count.set(id, (count.get(id) || 0) + 1); });
    for (let i = SLOTS - 1; i >= 0; i--) {
      const id = slots[i];
      if (id && (count.get(id) || 0) > (target.get(id) || 0)) {
        count.set(id, count.get(id)! - 1);
        slots[i] = null;
      }
    }
    // Place missing copies into FREE slots only: middle rows first (always on
    // screen), edge rows as overflow. The probe starts at the id's hash and
    // strides 5 (coprime with 12), so copies spread across the columns.
    const probe = (h: number, ring: 0 | 1): number => {
      for (let k = 0; k < MID; k++) {
        const s = ring * MID + ((h + k * 5) % MID);
        if (!slots[s]) return s;
      }
      return -1;
    };
    for (let round = 1; round <= 3; round++) {
      for (const v of holders) {
        if ((count.get(v.id) || 0) >= Math.min(round, target.get(v.id) || 0)) continue;
        const h = idHash(v.id) + (round - 1) * 7;
        let s = probe(h, 0);
        if (s === -1) s = probe(h, 1);
        if (s !== -1) { slots[s] = v.id; count.set(v.id, (count.get(v.id) || 0) + 1); }
      }
    }
    return slots.map((id, i) => {
      const k = id ? known.get(id) : undefined;
      return k
        ? ({ kind: "video", v: k.v, key: `s${i}` } as Cell)
        : ({ kind: "ph", key: `s${i}`, pair: pairFor(themes[i % themes.length], `ph-${i}`) } as Cell);
    });
  }, [live, themes]);

  return (
    <div style={{ background: canvasBg, color: INK, minHeight: "100vh" }}>
      <div style={canvasCenter}>
        <div style={stage}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "34px 30px 30px", minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                {/* Hovering LIVE NOW swaps it for a discreet dashboard link that
                    sits right on top — hidden until the organizer goes looking. */}
                <div style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 10 }} onMouseEnter={() => setShowNav(true)} onMouseLeave={() => setShowNav(false)}>
                  <span style={{ width: 9, height: 9, borderRadius: "50%", background: DANGER, animation: "blink 1.2s infinite", opacity: showNav ? 0 : 1, transition: "opacity .18s" }} />
                  <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: ".14em", color: DANGER_INK, whiteSpace: "nowrap", opacity: showNav ? 0 : 1, transition: "opacity .18s" }}>LIVE NOW</span>
                  <Link to="/admin" style={{ position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)", fontSize: 12, fontWeight: 800, letterSpacing: ".08em", color: INK, textDecoration: "none", padding: "5px 12px", borderRadius: 999, border: "1px solid rgba(var(--ts-neutral-rgb),.18)", background: "rgba(var(--ts-neutral-rgb),.07)", whiteSpace: "nowrap", opacity: showNav ? 1 : 0, transition: "opacity .18s", pointerEvents: showNav ? "auto" : "none" }}>← DASHBOARD</Link>
                </div>
                <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 42, letterSpacing: "-.03em", lineHeight: 1, marginTop: 8, whiteSpace: "nowrap" }}>{event.name}</div>
                <div style={{ fontSize: 15, color: "#9E99AD", fontWeight: 600, marginTop: 8 }}>{live.length} stories from the room · updating live</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 34 }}>Live</div>
                <div style={{ fontSize: 13, color: MUTED, fontWeight: 600 }}>Main Stage</div>
              </div>
            </div>

            {/* The ambient drifting wall. Each column is a 200%-tall strip of 4
                cards (edge, middle, middle, edge) sliding between its two halves
                — wallUp/wallDown with animation-direction: alternate, so the
                drift gently reverses instead of wrapping. Every card is ONE
                <video> that never leaves the DOM: nothing to clone, so nothing
                can desync or restart at a loop seam. No hover-pause: pausing on
                mouseover made it jolt. */}
            <div style={{ flex: 1, minHeight: 0, display: "flex", gap: 12, marginTop: 22, overflow: "hidden", WebkitMaskImage: wallMask, maskImage: wallMask }}>
              {Array.from({ length: COLS }, (_, ci) => (
                <div key={`col-${ci}`} style={{ flex: 1, minWidth: 0, position: "relative", overflow: "hidden" }}>
                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "200%", display: "flex", flexDirection: "column", willChange: "transform", animation: `wall${ci % 2 ? "Down" : "Up"} ${DURS[ci % DURS.length]}s linear infinite alternate` }}>
                    {[MID + ci, ci, COLS + ci, MID + COLS + ci].map((si) => {
                      const c = cells[si];
                      return (
                        <div key={c.key} style={{ flex: 1, minHeight: 0, padding: "6px 0" }}>
                          {c.kind === "video" ? (
                            <BigCard video={c.v} theme={themeById(event.themes, c.v.theme)} autoPlay onOpen={() => setFocused(c.v)} />
                          ) : (
                            <PlaceholderCard pair={c.pair} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

        <aside style={sidebar}>
          <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 24, letterSpacing: "-.02em", lineHeight: 1.1 }}>
            Add your<br />60-second story
          </div>
          <div style={{ fontSize: 14, color: "#9E99AD", fontWeight: 500, marginTop: 10, lineHeight: 1.45 }}>
            Scan to record from your phone. It appears here in seconds.
          </div>
          <div style={{ marginTop: 22 }}>
            <CredentialBlock attendeeUrl={event.attendeeUrl} code={event.code} qrSize={150} codeSize={40} align="left" />
          </div>
          <div style={{ marginTop: "auto", paddingTop: 22 }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".08em", color: MUTED2, marginBottom: 12 }}>TRENDING THEMES</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
              {trending.map(({ theme, count }) => (
                <div key={theme.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ background: theme.color, boxShadow: `0 0 8px ${theme.color}`, width: 10, height: 10, borderRadius: "50%", flex: "none" }} />
                  <span style={{ flex: 1, fontSize: 13.5, fontWeight: 700 }}>{theme.name}</span>
                  <span style={{ fontSize: 13, color: MUTED, fontWeight: 700 }}>{count}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>
        </div>
      </div>
      {live.length > 0 && <FacilitatorTable eventId={eventId} live={live} themes={event.themes} onOpen={setFocused} refresh={refresh} />}
      {focused && (
        <FocusModal video={focused} theme={themeById(event.themes, focused.theme)} onClose={() => setFocused(null)} />
      )}
    </div>
  );
}

/**
 * The facilitator's full list, below the 100vh wall (scroll down). Every clip as a
 * row: first-frame thumbnail, title, author, theme — click to play it in focus.
 * Lets them go through stories sequentially without waiting on the ambient wall.
 *
 * Signed-in organizers also get moderation controls: a per-row delete, a
 * select-all checkbox, and a bulk "delete selected" bar. These are gated on
 * sign-in (the big-screen route itself is public), and the API enforces
 * ownership — a viewer who isn't the owner just gets an error if they try.
 */
export function FacilitatorTable({
  eventId,
  live,
  themes,
  onOpen,
  refresh,
}: {
  eventId: string;
  live: VideoDTO[];
  themes: Theme[];
  onOpen: (v: VideoDTO) => void;
  refresh: () => void;
}) {
  const { isSignedIn } = useOrganizer();
  const canManage = isSignedIn;
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // A just-deleted clip is hidden locally right away — DynamoDB's list read is
  // eventually consistent, so it could otherwise linger in a poll or two.
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rows = useMemo(() => live.filter((v) => !hidden.has(v.id)), [live, hidden]);
  const allSelected = rows.length > 0 && rows.every((v) => selected.has(v.id));
  const selCount = rows.reduce((n, v) => n + (selected.has(v.id) ? 1 : 0), 0);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(rows.map((v) => v.id)));
  }

  async function remove(ids: string[]) {
    if (!ids.length || busy) return;
    const what = ids.length === 1 ? "this story" : `${ids.length} stories`;
    if (!window.confirm(`Delete ${what}? This can’t be undone.`)) return;
    setBusy(true);
    setError(null);
    try {
      if (ids.length === 1) await api.deleteVideo(eventId, ids[0]);
      else await api.deleteVideos(eventId, ids);
      setHidden((prev) => new Set([...prev, ...ids]));
      setSelected((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ width: "100%", maxWidth: 1340, margin: "0 auto", padding: "34px 26px 72px" }}>
      <Link to="/admin" style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 700, color: MUTED, textDecoration: "none", padding: "8px 14px", borderRadius: 999, border: "1px solid rgba(var(--ts-neutral-rgb),.14)", background: "rgba(var(--ts-neutral-rgb),.04)", marginBottom: 18 }}>← Back to dashboard</Link>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        {canManage && rows.length > 0 && (
          <RowCheckbox checked={allSelected} indeterminate={selCount > 0 && !allSelected} onChange={toggleAll} label="Select all stories" />
        )}
        <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 24, letterSpacing: "-.02em" }}>All stories</span>
        <span style={{ fontSize: 14, color: MUTED, fontWeight: 600 }}>{rows.length} · newest first</span>
        {canManage && selCount > 0 && (
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 13, color: MUTED, fontWeight: 700 }}>{selCount} selected</span>
            <button onClick={() => setSelected(new Set())} disabled={busy} style={ghostBtn}>Clear</button>
            <button onClick={() => remove(rows.filter((v) => selected.has(v.id)).map((v) => v.id))} disabled={busy} style={{ ...dangerBtn, opacity: busy ? 0.6 : 1 }}>
              <TrashIcon /> Delete selected
            </button>
          </div>
        )}
      </div>
      {error && <div style={{ fontSize: 13, color: DANGER_INK, fontWeight: 700, marginBottom: 12 }}>{error}</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {rows.map((v) => {
          const t = themeById(themes, v.theme);
          const sel = selected.has(v.id);
          return (
            <div key={v.id} style={{ ...tableRow, cursor: "default", ...(sel ? selectedRow : null) }}>
              {canManage && (
                <RowCheckbox checked={sel} onChange={() => toggle(v.id)} label={`Select “${v.title}”`} />
              )}
              <button onClick={() => onOpen(v)} style={rowPlay}>
                <TableThumb video={v} theme={t} />
                <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                  <div style={{ fontWeight: 700, fontSize: 15.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{v.title}</div>
                  <div style={{ fontSize: 13, color: MUTED, marginTop: 3 }}>{v.author}</div>
                </div>
                <span style={{ flex: "none", padding: "5px 12px", borderRadius: 999, fontSize: 12, fontWeight: 800, background: t.color, color: ON_ACCENT, whiteSpace: "nowrap" }}>{t.name}</span>
                <span style={{ flex: "none", width: 48, textAlign: "right", fontSize: 12.5, color: MUTED2, fontWeight: 700 }}>{fmtDurShort(v.durationSec)}</span>
                <span style={{ flex: "none", width: 30, height: 30, borderRadius: "50%", background: "rgba(var(--ts-neutral-rgb),.06)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="13" height="13" viewBox="0 0 24 24"><path d="M8 5.5L18.5 12L8 18.5V5.5Z" fill="#F4F1EC" /></svg>
                </span>
              </button>
              {canManage && (
                <button onClick={() => remove([v.id])} disabled={busy} aria-label={`Delete “${v.title}”`} title="Delete story" style={{ ...trashBtn, opacity: busy ? 0.6 : 1 }}>
                  <TrashIcon />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Native checkbox styled for the dark canvas; supports an indeterminate state. */
function RowCheckbox({ checked, indeterminate, onChange, label }: { checked: boolean; indeterminate?: boolean; onChange: () => void; label: string }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = !!indeterminate;
  }, [indeterminate]);
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      onClick={(e) => e.stopPropagation()}
      aria-label={label}
      style={{ flex: "none", width: 18, height: 18, cursor: "pointer", accentColor: "var(--ts-accent)" }}
    />
  );
}

function TrashIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m2 0v12a1 1 0 01-1 1H7a1 1 0 01-1-1V7M10 11v6M14 11v6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Small first-frame preview for the table. The <video> (metadata-only, #t=0.1 to
 * paint a frame) is mounted only while the row is near the viewport — and
 * UNMOUNTED again when it scrolls away. Browsers cap media elements per page
 * (Chrome ~75); if thumbs latched on, one full scroll of a big table would
 * exhaust the cap and the next player (the focus modal!) would refuse to load.
 */
function TableThumb({ video, theme }: { video: VideoDTO; theme: Theme }) {
  const ref = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || !video.mediaUrl) return;
    const io = new IntersectionObserver(
      (entries) => setShow(entries.some((e) => e.isIntersecting)),
      { rootMargin: "300px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [video.mediaUrl]);
  return (
    <div ref={ref} style={{ width: 58, height: 78, borderRadius: 10, overflow: "hidden", flex: "none", position: "relative", background: video.posterUrl ? `#000 url(${video.posterUrl}) center/cover` : stillBg(pairFor(theme, video.id)) }}>
      {show && video.mediaUrl && (
        <video
          src={`${video.mediaUrl}#t=0.1`}
          muted
          playsInline
          preload="metadata"
          tabIndex={-1}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none" }}
        />
      )}
    </div>
  );
}

/** Full-screen focus view: play one clip with sound; click outside / ✕ / Esc to close. */
function FocusModal({ video, theme, onClose }: { video: VideoDTO; theme: Theme; onClose: () => void }) {
  const ref = useRef<HTMLVideoElement>(null);
  const retries = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  // The retry timer must only die on unmount. onClose gets a fresh identity on
  // every 4s poll re-render; clearing the timer in that effect's cleanup would
  // silently cancel a pending retry and strand the modal on "Loading…".
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  // A clip can be tapped inside its brief upload window (record is live before the
  // S3 object lands). A <video> that errored won't re-fetch itself, so retry with
  // backoff; until the first frame is ready we show a loading state, not a dead frame.
  function handleError() {
    if (retries.current >= 20) return;
    const delay = Math.min(1500 + retries.current * 1000, 8000);
    retries.current += 1;
    timer.current = setTimeout(() => ref.current?.load(), delay);
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(4,3,10,.9)", backdropFilter: "blur(12px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 28, animation: "rise .25s ease" }}>
      <button onClick={onClose} aria-label="Close" style={{ position: "fixed", top: 22, right: 24, width: 52, height: 52, borderRadius: "50%", border: "1px solid rgba(var(--ts-neutral-rgb),.18)", background: "rgba(var(--ts-neutral-rgb),.08)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M6 6L18 18M18 6L6 18" stroke="#F4F1EC" strokeWidth="2.2" strokeLinecap="round" /></svg>
      </button>
      <div onClick={(e) => e.stopPropagation()} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18, width: "100%", maxWidth: "min(520px, 94vw)" }}>
        <div style={{ position: "relative", width: "100%", aspectRatio: "9 / 16", maxHeight: "76vh", borderRadius: 24, overflow: "hidden", background: "#000", boxShadow: "0 50px 130px -30px #000" }}>
          {video.mediaUrl && (
            <video
              ref={ref}
              src={video.mediaUrl}
              poster={video.posterUrl ?? undefined}
              controls
              autoPlay
              playsInline
              onPlaying={() => { retries.current = 0; setReady(true); }}
              onLoadedData={() => setReady(true)}
              onError={handleError}
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", background: "#000" }}
            />
          )}
          {!ready && (
            <div style={{ position: "absolute", inset: 0, background: stillBg(pairFor(theme, video.id)), display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
              <Spinner size={30} />
              <span style={{ fontSize: 13, fontWeight: 700, color: "#F4F1EC" }}>Loading…</span>
            </div>
          )}
        </div>
        <div style={{ textAlign: "center", maxWidth: 520 }}>
          <span style={{ display: "inline-block", padding: "5px 13px", borderRadius: 999, fontSize: 13, fontWeight: 800, background: theme.color, color: ON_ACCENT }}>{theme.name}</span>
          <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 26, letterSpacing: "-.02em", marginTop: 12, color: "#F7F4EF" }}>{video.title}</div>
          <div style={{ fontSize: 15, color: "#C9C6D4", fontWeight: 600, marginTop: 6 }}>{video.author}</div>
        </div>
      </div>
    </div>
  );
}

/** #rgb / #rrggbb → rgba() at the given alpha. Falls back to a mid grey on junk so
 *  a bad custom colour never blanks the label. */
function withAlpha(hex: string, alpha: number): string {
  let h = (hex || "").trim().replace(/^#/, "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return `rgba(136,136,136,${alpha})`;
  const n = parseInt(h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

/** Decorative gradient panel that keeps the canvas full when there are few clips. */
function PlaceholderCard({ pair }: { pair: [string, string] }) {
  return (
    <div aria-hidden style={{ position: "relative", borderRadius: 14, overflow: "hidden", width: "100%", height: "100%", background: stillBg(pair) }}>
      <Grain />
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,rgba(0,0,0,.04),rgba(0,0,0,.34))" }} />
    </div>
  );
}

/**
 * The QR + event-code "credential" block shared by the desktop sidebar and the
 * mobile share card. Most palettes render it bare (QR on its own light tile, code
 * in the normal ink); a palette with a qrPanelBg wraps it in a solid card and
 * recolors the QR (qrDark/qrLight) and code text (qrPanelInk) to match — e.g.
 * Beacon's white-on-red QR on a red card.
 */
function CredentialBlock({
  attendeeUrl,
  code,
  qrSize,
  codeSize,
  align,
}: {
  attendeeUrl: string;
  code: string;
  qrSize: number;
  codeSize: number;
  align: "left" | "center";
}) {
  const pal = usePalette();
  const framed = pal.qrPanelBg !== "transparent";
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: align === "center" ? "center" : "flex-start",
        background: framed ? pal.qrPanelBg : undefined,
        borderRadius: framed ? 22 : 0,
        padding: framed ? 22 : 0,
      }}
    >
      <div style={{ background: pal.qrLight, borderRadius: 18, padding: 16 }}>
        <Qr value={attendeeUrl} size={qrSize} dark={pal.qrDark} light={pal.qrLight} />
      </div>
      <div style={{ marginTop: 18, alignSelf: "stretch" }}>
        <EventCode code={code} size={codeSize} align={align} onColor={framed ? pal.qrPanelInk : undefined} />
      </div>
    </div>
  );
}

/** Prominent, classy event-code display — the type-it-in alternative to the QR.
 *  onColor overrides the text tint when the code sits on a solid card (e.g. white
 *  on Beacon's red panel); otherwise it uses the palette's normal ink/muted vars. */
function EventCode({ code, size, align = "left", onColor }: { code: string; size: number; align?: "left" | "center"; onColor?: string }) {
  const host = typeof window !== "undefined" ? window.location.host : "";
  const codeColor = onColor ?? INK;
  // On a solid QR card the muted labels are the card's ink at reduced alpha. Deriving
  // from qrPanelInk (not assuming white) keeps them legible on a LIGHT card too — a
  // custom yellow card gets dark labels, Beacon's red card keeps white ones.
  const labelColor = onColor ? withAlpha(onColor, 0.72) : MUTED2;
  const subColor = onColor ? withAlpha(onColor, 0.82) : MUTED;
  return (
    <div style={{ textAlign: align }}>
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".16em", color: labelColor }}>OR ENTER CODE</div>
      <div
        style={{
          fontFamily: FONT_DISPLAY,
          fontWeight: 800,
          fontSize: size,
          letterSpacing: ".06em",
          lineHeight: 1,
          marginTop: 8,
          color: codeColor,
        }}
      >
        {code}
      </div>
      <div style={{ fontSize: 12.5, color: subColor, marginTop: 8, fontWeight: 600 }}>
        at {host}/join
      </div>
    </div>
  );
}

function BigCard({ video, theme, autoPlay, onOpen }: { video: VideoDTO; theme: Theme; autoPlay: boolean; onOpen?: () => void }) {
  return (
    <div onClick={onOpen} style={{ position: "relative", borderRadius: 14, overflow: "hidden", width: "100%", height: "100%", minHeight: 0, cursor: onOpen ? "pointer" : "default" }}>
      <Thumb video={video} theme={theme} autoPlay={autoPlay} />
      <Grain />
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,transparent 40%,rgba(0,0,0,.75))" }} />
      <div style={{ position: "absolute", top: 8, left: 8, display: "flex", alignItems: "center", gap: 5 }}>
        <span style={{ background: theme.color, boxShadow: `0 0 8px ${theme.color}`, width: 8, height: 8, borderRadius: "50%" }} />
      </div>
      {onOpen && (
        <div style={{ position: "absolute", top: 7, right: 7, width: 22, height: 22, borderRadius: 7, background: "rgba(0,0,0,.42)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M9 4H4v5M15 4h5v5M15 20h5v-5M9 20H4v-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
      )}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: 9 }}>
        <div style={{ fontWeight: 700, fontSize: 12.5, lineHeight: 1.2, color: "#F7F4EF", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{video.title}</div>
        <div style={{ fontSize: 10.5, color: "#C9C6D4", marginTop: 3 }}>{video.author}</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ styles */

const tableRow: CSSProperties = { display: "flex", alignItems: "center", gap: 14, width: "100%", padding: "10px 14px", borderRadius: 14, border: "1px solid rgba(var(--ts-neutral-rgb),.07)", background: "rgba(var(--ts-neutral-rgb),.03)", cursor: "pointer", fontFamily: "inherit", color: INK };
const selectedRow: CSSProperties = { border: `1px solid ${ACCENT}`, background: "rgba(var(--ts-neutral-rgb),.06)" };
// The clickable "play" region of a row — a real button so it stays keyboard-
// reachable, but visually bare so the row reads as one surface.
const rowPlay: CSSProperties = { display: "flex", alignItems: "center", gap: 14, flex: 1, minWidth: 0, padding: 0, border: "none", background: "transparent", cursor: "pointer", fontFamily: "inherit", color: INK };
const dangerBtn: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 14px", borderRadius: 999, border: `1px solid ${DANGER}`, background: "transparent", color: DANGER_INK, fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "inherit" };
const ghostBtn: CSSProperties = { padding: "8px 13px", borderRadius: 999, border: "1px solid rgba(var(--ts-neutral-rgb),.14)", background: "transparent", color: MUTED, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" };
const trashBtn: CSSProperties = { flex: "none", width: 34, height: 34, borderRadius: 10, border: "1px solid rgba(var(--ts-neutral-rgb),.12)", background: "rgba(var(--ts-neutral-rgb),.04)", color: DANGER_INK, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" };
// Fades the marquee's cropped edges so cards dissolve at the top/bottom of the wall.
const wallMask = "linear-gradient(180deg,transparent,#000 6%,#000 94%,transparent)";
// A custom palette can paint an uploaded wallpaper behind everything: the
// --ts-wallpaper layer ("none" for the named palettes, so they render exactly as
// before) sits over the flat page background as a fallback.
const canvasBg = `var(--ts-wallpaper), ${PAGE_BG}`;
const canvasCenter: CSSProperties = { minHeight: "100vh", background: canvasBg, color: INK, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 };
const mobileCanvas: CSSProperties = {
  minHeight: "100vh",
  background: canvasBg,
  color: INK,
  padding: "calc(20px + env(safe-area-inset-top)) 18px calc(28px + env(safe-area-inset-bottom))",
};
const shareCard: CSSProperties = { marginTop: 20, background: "rgba(var(--ts-neutral-rgb),.04)", border: "1px solid rgba(var(--ts-neutral-rgb),.09)", borderRadius: 22, padding: 22 };
const primaryBtn: CSSProperties = { width: "100%", padding: 14, borderRadius: 14, border: "none", background: BRAND_GRAD, color: "#fff", fontWeight: 800, fontSize: 15, cursor: "pointer", fontFamily: "inherit" };
const secondaryBtn: CSSProperties = { width: "100%", padding: 14, borderRadius: 14, border: "1px solid rgba(var(--ts-neutral-rgb),.16)", background: "rgba(var(--ts-neutral-rgb),.04)", color: INK, fontWeight: 700, fontSize: 14.5, cursor: "pointer", fontFamily: "inherit" };
const stage: CSSProperties = {
  width: "100%",
  maxWidth: 1340,
  aspectRatio: "16 / 9",
  borderRadius: 24,
  overflow: "hidden",
  position: "relative",
  background: STAGE_BG,
  border: "1px solid rgba(var(--ts-neutral-rgb),.08)",
  boxShadow: "0 40px 100px -40px #000",
  display: "flex",
};
const sidebar: CSSProperties = {
  width: 300,
  flex: "none",
  background: "rgba(var(--ts-neutral-rgb),.03)",
  borderLeft: "1px solid rgba(var(--ts-neutral-rgb),.07)",
  padding: "34px 26px",
  display: "flex",
  flexDirection: "column",
};
