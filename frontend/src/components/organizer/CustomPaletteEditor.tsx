// Organizer control for building a fully custom palette: pick the four base
// colours (page / story container / QR card / accent) and optionally upload a
// big-screen wallpaper. Every text colour is DERIVED for legibility by
// buildCustomPalette — the organizer never picks a text colour — and a live
// mini-preview of the big screen shows the result as they go.

import { useState } from "react";
import type { CSSProperties } from "react";
import type { CustomPalette } from "../../types";
import { buildCustomPalette, isHexColor } from "../../customPalette";
import { INK, MUTED, MUTED2, FONT_DISPLAY } from "../../design";
import { api } from "../../api";

const FIELDS: { key: "page" | "stage" | "qr" | "accent"; label: string; hint: string }[] = [
  { key: "page", label: "Page background", hint: "behind everything (used when no wallpaper)" },
  { key: "stage", label: "Story container", hint: "the panel the stories sit in" },
  { key: "qr", label: "QR card", hint: "the block around the join QR + code" },
  { key: "accent", label: "Accent", hint: "dots, active chips, buttons" },
];

export function CustomPaletteEditor({
  eventId,
  value,
  onChange,
}: {
  eventId: string;
  value: CustomPalette;
  onChange: (cp: CustomPalette) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [pct, setPct] = useState(0);
  const [err, setErr] = useState<string | null>(null);

  const set = (patch: Partial<CustomPalette>) => onChange({ ...value, ...patch });

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // let the same file be re-picked after a remove
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      setErr("Use a JPEG, PNG or WebP image");
      return;
    }
    setErr(null);
    setUploading(true);
    setPct(0);
    try {
      const key = await api.uploadWallpaper(eventId, file, setPct);
      // Preview from a local object URL immediately; the durable S3 key (if any)
      // rides along and is what actually gets saved.
      set({ wallpaper: URL.createObjectURL(file), wallpaperKey: key ?? undefined });
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {FIELDS.map((f) => (
          <ColorField
            key={f.key}
            label={f.label}
            hint={f.hint}
            value={value[f.key]}
            onChange={(c) => set({ [f.key]: c } as Partial<CustomPalette>)}
          />
        ))}
      </div>

      {/* Wallpaper */}
      <div style={{ marginTop: 14 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: INK }}>Big-screen wallpaper</div>
        <div style={{ fontSize: 11.5, color: MUTED2, marginTop: 2 }}>
          Optional. Fills the very background behind the stage on the big screen.
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
          <label style={{ ...uploadBtn, opacity: uploading ? 0.6 : 1, cursor: uploading ? "default" : "pointer" }}>
            {uploading ? `Uploading ${pct}%…` : value.wallpaper ? "Replace image" : "Upload image"}
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={onFile} disabled={uploading} style={{ display: "none" }} />
          </label>
          {value.wallpaper && !uploading && (
            <>
              <span
                aria-label="Wallpaper preview"
                style={{ width: 48, height: 30, borderRadius: 7, background: `#000 center/cover url(${value.wallpaper})`, border: "1px solid rgba(var(--ts-neutral-rgb),.16)", flex: "none" }}
              />
              <button type="button" onClick={() => set({ wallpaper: undefined, wallpaperKey: undefined })} style={removeLink}>
                Remove
              </button>
            </>
          )}
        </div>
        {err && <div style={{ fontSize: 12.5, color: "#FF6B7E", marginTop: 8, fontWeight: 600 }}>{err}</div>}
      </div>

      <BigScreenPreview value={value} />
    </div>
  );
}

/** A labelled colour swatch + hex text input, kept in sync. */
function ColorField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (c: string) => void;
}) {
  const safe = isHexColor(value) ? value : "#888888";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <input aria-label={label} type="color" value={toColorInput(value)} onChange={(e) => onChange(e.target.value)} style={swatch} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: INK, whiteSpace: "nowrap" }}>{label}</div>
        <input
          aria-label={`${label} hex`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          style={{ ...hexInput, borderColor: isHexColor(value) ? "rgba(var(--ts-neutral-rgb),.14)" : "#FF6B7E" }}
        />
        <div style={{ fontSize: 10.5, color: MUTED2, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={hint}>{hint}</div>
      </div>
      <span aria-hidden style={{ width: 0, background: safe }} />
    </div>
  );
}

/** `<input type="color">` only accepts #rrggbb — coerce shorthand/invalid input. */
function toColorInput(v: string): string {
  const s = (v || "").trim();
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s;
  if (/^#[0-9a-fA-F]{3}$/.test(s)) return "#" + s.slice(1).split("").map((c) => c + c).join("");
  return "#888888";
}

/** A small, honest rendering of the big screen using the DERIVED palette, so the
 *  organizer can see text legibility on their chosen surfaces before saving. */
function BigScreenPreview({ value }: { value: CustomPalette }) {
  const p = buildCustomPalette(value);
  const wall = value.wallpaper ? `center/cover url(${value.wallpaper})` : p.bodyBg;
  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".07em", color: MUTED2, marginBottom: 8 }}>BIG-SCREEN PREVIEW</div>
      <div style={{ borderRadius: 14, overflow: "hidden", border: "1px solid rgba(var(--ts-neutral-rgb),.1)", background: wall, padding: 14 }}>
        <div style={{ display: "flex", gap: 10, background: p.stageBg, borderRadius: 12, padding: 12, minHeight: 132 }}>
          {/* stage: header + story tiles */}
          <div style={{ flex: 1, minWidth: 0, color: p.ink }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: p.danger }} />
              <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: ".12em", color: p.dangerInk }}>LIVE NOW</span>
            </div>
            <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 18, letterSpacing: "-.02em", marginTop: 4, color: p.ink }}>Your event</div>
            <div style={{ fontSize: 10.5, color: p.muted, marginTop: 2 }}>24 stories from the room</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginTop: 10 }}>
              {["#7B2FF7", "#22D3EE", "#F59E0B"].map((c, i) => (
                <div key={i} style={{ aspectRatio: "3/4", borderRadius: 7, background: `linear-gradient(160deg, ${c}, ${p.accent})` }} />
              ))}
            </div>
          </div>
          {/* QR card */}
          <div style={{ width: 92, flex: "none", borderRadius: 10, background: p.qrPanelBg, padding: 10, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <div style={{ width: 52, height: 52, borderRadius: 6, background: p.qrLight, display: "grid", gridTemplateColumns: "repeat(4,1fr)", padding: 4, gap: 2 }}>
              {Array.from({ length: 16 }, (_, i) => (
                <span key={i} style={{ background: i % 3 ? "transparent" : p.qrDark, borderRadius: 1 }} />
              ))}
            </div>
            <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 13, letterSpacing: ".05em", color: p.qrPanelInk }}>AB12CD</div>
            <span style={{ fontSize: 8, fontWeight: 800, color: p.onAccent, background: p.accent, borderRadius: 999, padding: "2px 7px" }}>JOIN</span>
          </div>
        </div>
      </div>
    </div>
  );
}

const swatch: CSSProperties = {
  width: 40,
  height: 40,
  flex: "none",
  padding: 0,
  border: "1px solid rgba(var(--ts-neutral-rgb),.14)",
  borderRadius: 10,
  background: "transparent",
  cursor: "pointer",
};
const hexInput: CSSProperties = {
  width: 96,
  marginTop: 3,
  background: "rgba(var(--ts-neutral-rgb),.06)",
  border: "1px solid rgba(var(--ts-neutral-rgb),.14)",
  borderRadius: 9,
  padding: "5px 9px",
  color: INK,
  fontSize: 12.5,
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  outline: "none",
};
const uploadBtn: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "9px 15px",
  borderRadius: 10,
  border: "1px solid rgba(var(--ts-neutral-rgb),.16)",
  background: "rgba(var(--ts-neutral-rgb),.05)",
  color: INK,
  fontWeight: 700,
  fontSize: 13,
};
const removeLink: CSSProperties = {
  border: "none",
  background: "none",
  color: MUTED,
  fontWeight: 700,
  fontSize: 12.5,
  cursor: "pointer",
  fontFamily: "inherit",
  textDecoration: "underline",
};
