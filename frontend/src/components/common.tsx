import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { grainStyle } from "../design";

export function Grain() {
  return <div style={grainStyle} />;
}

/** Glassy play affordance layered over a video still. */
export function PlayBadge({ size = 44 }: { size?: number }) {
  const icon = Math.round(size * 0.34);
  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
      <div
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          background: "rgba(255,255,255,.14)",
          backdropFilter: "blur(6px)",
          border: "1px solid rgba(255,255,255,.3)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 4px 14px rgba(0,0,0,.3)",
        }}
      >
        <svg width={icon} height={icon} viewBox="0 0 24 24">
          <path d="M8 5.5L18.5 12L8 18.5V5.5Z" fill="#fff" />
        </svg>
      </div>
    </div>
  );
}

export function Spinner({ size = 22, color = "#F4F1EC" }: { size?: number; color?: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: size,
        height: size,
        borderRadius: "50%",
        border: `2px solid rgba(255,255,255,.18)`,
        borderTopColor: color,
        animation: "spin .8s linear infinite",
      }}
    />
  );
}

/** Real, scannable QR code for the attendee URL. */
export function Qr({ value, size = 150 }: { value: string; size?: number }) {
  const [src, setSrc] = useState<string>("");
  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(value, {
      margin: 1,
      width: size * 2,
      color: { dark: "#0C0A12", light: "#F4F1EC" },
      errorCorrectionLevel: "M",
    })
      .then((url) => alive && setSrc(url))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [value, size]);
  return src ? (
    <img src={src} width={size} height={size} alt="Scan to upload" style={{ display: "block", borderRadius: 6 }} />
  ) : (
    <div style={{ width: size, height: size }} />
  );
}
