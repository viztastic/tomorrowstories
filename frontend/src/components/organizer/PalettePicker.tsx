// Swatch picker for an event's visual palette. Each chip previews its own
// palette's colors (page background, brand gradient, accent) using the literal
// palette values, so it reads correctly regardless of the currently-applied theme.

import { PALETTE_LIST } from "../../palettes";
import { CUSTOM_PALETTE_ID } from "../../customPalette";
import { INK } from "../../design";

// allowCustom gates the build-your-own chip. It's off at create time (Landing):
// a custom palette can upload a wallpaper, which needs the event to already
// exist, so custom skins are built in the Admin editor once there's an eventId.
export function PalettePicker({
  value,
  onChange,
  allowCustom = true,
}: {
  value: string;
  onChange: (id: string) => void;
  allowCustom?: boolean;
}) {
  const customOn = value === CUSTOM_PALETTE_ID;
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
              border: on ? `2px solid ${INK}` : "2px solid rgba(var(--ts-neutral-rgb),.14)",
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
      {/* Build-your-own. Selecting it opens the CustomPaletteEditor in Admin. */}
      {allowCustom && (
      <button
        type="button"
        aria-pressed={customOn}
        onClick={() => onChange(CUSTOM_PALETTE_ID)}
        style={{
          width: 108,
          padding: 10,
          borderRadius: 14,
          border: customOn ? `2px solid ${INK}` : "2px dashed rgba(var(--ts-neutral-rgb),.28)",
          background: "rgba(var(--ts-neutral-rgb),.03)",
          cursor: "pointer",
          fontFamily: "inherit",
          textAlign: "left",
        }}
      >
        <div style={{ height: 26, borderRadius: 8, background: "conic-gradient(from 210deg, #FF6B35, #FF3D77, #7B2FF7, #38BDF8, #2FD37E, #F5C400, #FF6B35)" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 9 }}>
          <span style={{ width: 10, height: 10, borderRadius: "50%", border: `2px solid ${INK}`, flex: "none" }} />
          <span style={{ fontSize: 12, fontWeight: 800, color: INK }}>Custom</span>
        </div>
      </button>
      )}
    </div>
  );
}
