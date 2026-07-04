// Organizer control for customizing the topic buckets attendees choose from.
// Controlled: the parent owns the array; each row carries a stable `id` ("" for
// a newly added row) so the backend can preserve ids on rename/recolor and only
// mint ids for new rows — which is what keeps existing clips from orphaning.

import type { CSSProperties } from "react";
import type { Theme } from "../../types";
import { INK, MUTED2 } from "../../design";

const MAX_TOPICS = 8;
const MIN_TOPICS = 1;
const NEW_COLOR = "#8B5CF6";

export function TopicEditor({ themes, onChange }: { themes: Theme[]; onChange: (themes: Theme[]) => void }) {
  const setRow = (i: number, patch: Partial<Theme>) =>
    onChange(themes.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  const removeRow = (i: number) => {
    if (themes.length > MIN_TOPICS) onChange(themes.filter((_, idx) => idx !== i));
  };
  const addRow = () => {
    if (themes.length < MAX_TOPICS) onChange([...themes, { id: "", name: "", color: NEW_COLOR }]);
  };

  return (
    <div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {themes.map((t, i) => (
          <div key={i} style={rowStyle}>
            <input
              aria-label="Topic color"
              type="color"
              value={/^#[0-9a-fA-F]{6}$/.test(t.color) ? t.color : NEW_COLOR}
              onChange={(e) => setRow(i, { color: e.target.value })}
              style={swatch}
            />
            <input
              aria-label="Topic name"
              value={t.name}
              maxLength={40}
              placeholder="Topic name"
              onChange={(e) => setRow(i, { name: e.target.value })}
              style={nameInput}
            />
            <button
              type="button"
              aria-label="Remove topic"
              onClick={() => removeRow(i)}
              disabled={themes.length <= MIN_TOPICS}
              style={{ ...removeBtn, opacity: themes.length <= MIN_TOPICS ? 0.35 : 1, cursor: themes.length <= MIN_TOPICS ? "not-allowed" : "pointer" }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M6 6L18 18M18 6L6 18" stroke={INK} strokeWidth="2" strokeLinecap="round" /></svg>
            </button>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10 }}>
        <button type="button" onClick={addRow} disabled={themes.length >= MAX_TOPICS} style={{ ...addBtn, opacity: themes.length >= MAX_TOPICS ? 0.4 : 1, cursor: themes.length >= MAX_TOPICS ? "not-allowed" : "pointer" }}>
          + Add topic
        </button>
        <span style={{ fontSize: 11.5, color: MUTED2, fontWeight: 600 }}>{themes.length}/{MAX_TOPICS} · {MIN_TOPICS}–{MAX_TOPICS} allowed</span>
      </div>
    </div>
  );
}

const rowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 9,
};
const swatch: CSSProperties = {
  width: 38,
  height: 38,
  flex: "none",
  padding: 0,
  border: "1px solid rgba(var(--ts-neutral-rgb),.14)",
  borderRadius: 10,
  background: "transparent",
  cursor: "pointer",
};
const nameInput: CSSProperties = {
  flex: 1,
  minWidth: 0,
  background: "rgba(var(--ts-neutral-rgb),.06)",
  border: "1px solid rgba(var(--ts-neutral-rgb),.1)",
  borderRadius: 12,
  padding: "11px 14px",
  color: INK,
  fontSize: 14.5,
  fontFamily: "inherit",
  outline: "none",
};
const removeBtn: CSSProperties = {
  width: 36,
  height: 36,
  flex: "none",
  borderRadius: 10,
  border: "1px solid rgba(var(--ts-neutral-rgb),.12)",
  background: "rgba(var(--ts-neutral-rgb),.04)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};
const addBtn: CSSProperties = {
  padding: "9px 15px",
  borderRadius: 10,
  border: "1px solid rgba(var(--ts-neutral-rgb),.16)",
  background: "rgba(var(--ts-neutral-rgb),.05)",
  color: INK,
  fontWeight: 700,
  fontSize: 13,
  fontFamily: "inherit",
};
