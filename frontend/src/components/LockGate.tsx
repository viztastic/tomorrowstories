import { useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { ACCENT, BRAND_GRAD, FONT_DISPLAY, INK, MUTED, MUTED2, PAGE_BG } from "../design";
import { Spinner } from "./common";

/**
 * Full-screen password prompt shown when a wall (big screen or attendee link)
 * has been locked by the organizer after the event. On success we persist a
 * view token (inside api.unlock) and call onUnlocked so the parent re-fetches.
 */
export function LockGate({ eventId, onUnlocked }: { eventId: string; onUnlocked: () => void }) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!password || busy) return;
    setBusy(true);
    setErr(null);
    try {
      await api.unlock(eventId, password);
      // Clear busy before handing off: if the token couldn't be persisted (e.g.
      // storage disabled), the parent won't unmount us and the user must retry.
      setBusy(false);
      onUnlocked();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn’t unlock");
      setBusy(false);
    }
  }

  return (
    <div style={canvas}>
      <form onSubmit={submit} style={cardStyle}>
        <div style={lockBadge} aria-hidden>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
            <rect x="4.5" y="10.5" width="15" height="10" rx="2.4" stroke={INK} strokeWidth="1.9" />
            <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" stroke={INK} strokeWidth="1.9" strokeLinecap="round" />
          </svg>
        </div>
        <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 25, letterSpacing: "-.02em", marginTop: 18 }}>
          This wall is private
        </div>
        <div style={{ fontSize: 14, color: MUTED, marginTop: 8, lineHeight: 1.5 }}>
          The organizer locked this event. Enter the password to view the stories.
        </div>

        <label htmlFor="ts-view-password" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
          Event password
        </label>
        <input
          id="ts-view-password"
          type="password"
          value={password}
          onChange={(e) => { setPassword(e.target.value); setErr(null); }}
          placeholder="Event password"
          autoFocus
          autoComplete="off"
          style={{ ...input, borderColor: err ? "rgba(255,61,87,.5)" : "rgba(var(--ts-neutral-rgb),.14)" }}
        />
        {err && <div style={{ fontSize: 13, color: "#FF7A9C", fontWeight: 600, marginTop: 10, alignSelf: "flex-start" }}>{err}</div>}

        <button type="submit" disabled={!password || busy} style={{ ...primaryBtn, opacity: !password || busy ? 0.6 : 1 }}>
          {busy ? <Spinner size={18} color="#fff" /> : "Unlock"}
        </button>

        <Link to="/" style={{ color: MUTED2, fontWeight: 700, fontSize: 13, textDecoration: "none", marginTop: 22 }}>
          Tomorrow Stories
        </Link>
      </form>
    </div>
  );
}

const canvas: CSSProperties = {
  minHeight: "100vh",
  background: PAGE_BG,
  color: INK,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "calc(20px + env(safe-area-inset-top)) 20px calc(28px + env(safe-area-inset-bottom))",
};
const cardStyle: CSSProperties = {
  width: "100%",
  maxWidth: 380,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  textAlign: "center",
  background: "rgba(var(--ts-neutral-rgb),.04)",
  border: "1px solid rgba(var(--ts-neutral-rgb),.09)",
  borderRadius: 24,
  padding: "34px 26px 26px",
};
const lockBadge: CSSProperties = {
  width: 56,
  height: 56,
  borderRadius: 18,
  background: "rgba(var(--ts-neutral-rgb),.06)",
  border: "1px solid rgba(var(--ts-neutral-rgb),.12)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};
const input: CSSProperties = {
  width: "100%",
  marginTop: 20,
  background: "rgba(var(--ts-neutral-rgb),.06)",
  border: "1px solid rgba(var(--ts-neutral-rgb),.14)",
  borderRadius: 13,
  padding: "13px 15px",
  color: INK,
  fontSize: 15,
  fontFamily: "inherit",
  outline: "none",
  textAlign: "center",
};
const primaryBtn: CSSProperties = {
  width: "100%",
  marginTop: 16,
  padding: 14,
  borderRadius: 14,
  border: "none",
  background: BRAND_GRAD,
  color: "#fff",
  fontWeight: 800,
  fontSize: 15,
  cursor: "pointer",
  fontFamily: "inherit",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 48,
  boxShadow: `0 12px 30px -12px ${ACCENT}`,
};
