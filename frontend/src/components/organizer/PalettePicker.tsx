// Swatch picker for an event's visual palette. Each chip previews its own
// palette's colors (page background, brand gradient, accent) using the literal
// palette values, so it reads correctly regardless of the currently-applied theme.

import { PALETTE_LIST } from "../../palettes";
import { INK } from "../../design";

export function PalettePicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
      {PALETTE_LIST.map((p) => {
        const on = p.id === value;
        return (
          <button
            key={p.id}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(p.id)}
            style={{
              width: 108,
              padding: 10,
              borderRadius: 14,
              border: on ? `2px solid ${INK}` : "2px solid rgba(255,255,255,.14)",
              background: p.pageBg,
              cursor: "pointer",
              fontFamily: "inherit",
              textAlign: "left",
            }}
          >
            <div style={{ height: 26, borderRadius: 8, background: p.brandGrad }} />
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 9 }}>
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: p.accent, boxShadow: `0 0 8px ${p.accent}`, flex: "none" }} />
              <span style={{ fontSize: 12, fontWeight: 800, color: p.ink }}>{p.name}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
