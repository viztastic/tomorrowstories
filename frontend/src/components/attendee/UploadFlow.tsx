import { useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { Theme, VideoDTO, VideoStatus } from "../../types";
import { api } from "../../api";
import { BRAND_GRAD, DANGER, fmtDur, INK, MUTED, ON_ACCENT, OVERLAY_BG, pairFor, stillBg, themeById } from "../../design";
import { Spinner } from "../common";

// Record → Details → Review, then the done screen (step 4). There's no trim
// step — the full clip goes up, so picking a file jumps straight to details.
type Step = 1 | 2 | 3 | 4;
const STEP_LABELS = ["", "Record", "Details", "Review"];

export function UploadFlow({
  eventId,
  themes,
  onUploaded,
  onClose,
}: {
  eventId: string;
  themes: Theme[];
  onUploaded: (v: VideoDTO) => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState<Step>(1);
  const [file, setFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [durationSec, setDurationSec] = useState(0);
  const [title, setTitle] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [themeId, setThemeId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [postedStatus, setPostedStatus] = useState<VideoStatus | null>(null);
  // Two hidden inputs: `capture` biases mobile toward the camera; no `capture`
  // opens the photo library. Desktop ignores `capture` and shows a file dialog
  // for both — which is fine.
  const recordRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);

  const fallbackThemeId = themeId || themes[0]?.id || "";
  const dTheme = themeById(themes, fallbackThemeId);
  const titleShown = title.trim() || "My 60-second story";

  function pickRecord() {
    recordRef.current?.click();
  }
  function pickLibrary() {
    libraryRef.current?.click();
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    setFile(f);
    setFileUrl(url);
    // Read duration from metadata.
    const probe = document.createElement("video");
    probe.preload = "metadata";
    probe.onloadedmetadata = () => setDurationSec(Math.min(Math.round(probe.duration) || 0, 90));
    probe.src = url;
    setStep(2);
  }

  const canContinue = step !== 2 || (!!themeId && !!title.trim());

  function next() {
    if (!canContinue) return;
    setStep((s) => (s + 1) as Step);
  }

  function back() {
    if (step <= 1) onClose();
    else setStep((s) => (s - 1) as Step);
  }

  function reset() {
    if (fileUrl) URL.revokeObjectURL(fileUrl);
    setFile(null);
    setFileUrl(null);
    setDurationSec(0);
    setTitle("");
    setAuthorName("");
    setThemeId(null);
    setProgress(0);
    setErr(null);
    setPostedStatus(null);
    setStep(1);
  }

  async function submit() {
    setUploading(true);
    setErr(null);
    try {
      const v = await api.upload(
        eventId,
        { title: titleShown, theme: themeId || fallbackThemeId, author: authorName.trim() || "You", durationSec, contentType: file?.type || "video/mp4" },
        file,
        setProgress
      );
      onUploaded(v);
      setPostedStatus(v.status);
      setStep(4);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  // ---- Done screen ----
  if (step === 4) {
    return (
      <div style={{ height: "100%", width: "100%", display: "flex", flexDirection: "column", background: OVERLAY_BG }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32, textAlign: "center" }}>
          <div style={{ width: 88, height: 88, borderRadius: "50%", background: BRAND_GRAD, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 16px 44px -12px #FF6B35", animation: "rise .4s ease" }}>
            <svg width="42" height="42" viewBox="0 0 24 24" fill="none">
              <path d="M5 12.5L10 17.5L19 7" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800, fontSize: 27, letterSpacing: "-.02em", marginTop: 22 }}>
            {postedStatus === "live" ? "You're live on the wall!" : "You're on the wall!"}
          </div>
          <div style={{ fontSize: 14, color: MUTED, lineHeight: 1.5, marginTop: 8, maxWidth: 260 }}>
            {postedStatus === "live" ? (
              <>Your clip is now playing in <b style={{ color: INK }}>{dTheme.name}</b> on the wall — go watch it with the room.</>
            ) : (
              <>Your clip is uploading to <b style={{ color: INK }}>{dTheme.name}</b> — it appears on the wall as soon as it finishes processing (usually under a minute).</>
            )}
          </div>
          <button onClick={onClose} style={{ marginTop: 28, width: "100%", maxWidth: 260, padding: 15, borderRadius: 15, border: "none", background: BRAND_GRAD, color: "#fff", fontWeight: 800, fontSize: 15, cursor: "pointer", fontFamily: "inherit" }}>
            See it on the wall
          </button>
          <button onClick={reset} style={{ marginTop: 11, width: "100%", maxWidth: 260, padding: 15, borderRadius: 15, border: "1px solid rgba(var(--ts-neutral-rgb),.14)", background: "transparent", color: INK, fontWeight: 700, fontSize: 15, cursor: "pointer", fontFamily: "inherit" }}>
            Post another story
          </button>
        </div>
      </div>
    );
  }

  const fillBg: CSSProperties = {
    position: "absolute",
    inset: 0,
    background: fileUrl ? "#000" : stillBg(pairFor(dTheme, "draft")),
  };

  return (
    <div style={{ height: "100%", width: "100%", display: "flex", flexDirection: "column", background: OVERLAY_BG }}>
      {/* Record → biases the camera; Library → opens the photo roll (no capture attr). */}
      <input ref={recordRef} type="file" accept="video/*" capture="user" onChange={onFile} style={{ display: "none" }} />
      <input ref={libraryRef} type="file" accept="video/*" onChange={onFile} style={{ display: "none" }} />

      <div style={{ flex: "none", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px 4px" }}>
        <button onClick={back} style={iconBtn}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M15 5L8 12L15 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <div style={{ fontWeight: 700, fontSize: 15 }}>{STEP_LABELS[step]}</div>
        <button onClick={onClose} style={iconBtn}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M6 6L18 18M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
        </button>
      </div>

      <div style={{ flex: "none", height: 4, margin: "8px 16px 0", borderRadius: 2, background: "rgba(var(--ts-neutral-rgb),.08)" }}>
        <div style={{ width: `${(Math.min(step, 3) / 3) * 100}%`, height: "100%", borderRadius: 2, background: BRAND_GRAD, transition: "width .3s" }} />
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "18px 16px" }}>
        {step === 1 && (
          <>
            <div style={h1}>Share your story</div>
            <div style={sub}>Up to 60 seconds. Record a new video, or upload one you already have.</div>

            {/* A clear two-way choice: film now, or pick an existing clip. */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 22 }}>
              <button onClick={pickRecord} style={choicePrimary}>
                <span style={choiceIcon}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><rect x="3" y="6" width="13" height="12" rx="2.5" stroke="#fff" strokeWidth="1.8" /><path d="M16 10l5-3v10l-5-3" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round" /></svg>
                </span>
                <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", minWidth: 0 }}>
                  <span style={{ fontWeight: 800, fontSize: 16 }}>Record a video</span>
                  <span style={{ fontSize: 12.5, opacity: 0.85 }}>Open your camera and film now</span>
                </span>
              </button>
              <button onClick={pickLibrary} style={choiceOutline}>
                <span style={{ ...choiceIcon, background: "rgba(var(--ts-neutral-rgb),.08)" }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.8" /><path d="M3 16l5-4 4 3 4-4 5 4" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></svg>
                </span>
                <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", minWidth: 0 }}>
                  <span style={{ fontWeight: 800, fontSize: 16 }}>Choose from camera roll</span>
                  <span style={{ fontSize: 12.5, color: MUTED }}>Upload a video you already recorded</span>
                </span>
              </button>
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, fontSize: 12, color: MUTED, marginTop: 18 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: DANGER }} />
              We’ll use up to the first 60 seconds.
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div style={h1}>Add details</div>
            <div style={sub}>Your name, a title and a theme help people find it.</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#8B8698", margin: "20px 0 8px", letterSpacing: ".03em" }}>YOUR NAME</div>
            <input value={authorName} onChange={(e) => setAuthorName(e.target.value)} placeholder="First name is fine" autoCapitalize="words" style={detailInput} />
            <div style={{ fontSize: 12, fontWeight: 700, color: "#8B8698", margin: "18px 0 8px", letterSpacing: ".03em" }}>TITLE</div>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Give your story a title..." style={detailInput} />
            <div style={{ fontSize: 12, fontWeight: 700, color: "#8B8698", margin: "22px 0 10px", letterSpacing: ".03em" }}>PICK A THEME</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 9 }}>
              {themes.map((t) => {
                const on = themeId === t.id;
                return (
                  <button key={t.id} onClick={() => setThemeId(t.id)} style={{ padding: "10px 15px", borderRadius: 999, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", border: "1px solid " + (on ? t.color : "rgba(var(--ts-neutral-rgb),.14)"), background: on ? t.color : "rgba(var(--ts-neutral-rgb),.04)", color: on ? ON_ACCENT : MUTED }}>
                    {t.name}
                  </button>
                );
              })}
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <div style={h1}>Ready to post?</div>
            <div style={sub}>This goes live on the wall right away.</div>
            <div style={{ marginTop: 20, display: "flex", gap: 14, alignItems: "center", padding: 14, borderRadius: 18, background: "rgba(var(--ts-neutral-rgb),.05)", border: "1px solid rgba(var(--ts-neutral-rgb),.08)" }}>
              <div style={{ position: "relative", width: 78, height: 104, borderRadius: 14, flex: "none", overflow: "hidden" }}>
                {fileUrl ? <video src={fileUrl} muted playsInline style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={fillBg} />}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "inline-block", padding: "5px 12px", borderRadius: 999, fontSize: 11.5, fontWeight: 800, background: dTheme.color, color: ON_ACCENT, whiteSpace: "nowrap" }}>{dTheme.name}</div>
                <div style={{ fontWeight: 700, fontSize: 15, marginTop: 8, lineHeight: 1.25 }}>{titleShown}</div>
                <div style={{ fontSize: 12.5, color: "#8B8698", marginTop: 4 }}>{authorName.trim() || "You"} · {fmtDur(durationSec)}</div>
              </div>
            </div>
            {err && <div style={{ color: "#FF7A9C", fontSize: 13, fontWeight: 600, marginTop: 14 }}>{err}</div>}
            {uploading && (
              <div style={{ marginTop: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: MUTED, fontWeight: 700, marginBottom: 7 }}>
                  <span>{progress < 100 ? "Uploading your clip…" : "Handing off for processing…"}</span>
                  <span>{progress}%</span>
                </div>
                <div style={{ height: 6, borderRadius: 3, background: "rgba(var(--ts-neutral-rgb),.08)", overflow: "hidden" }}>
                  <div style={{ width: `${Math.max(progress, 4)}%`, height: "100%", borderRadius: 3, background: BRAND_GRAD, transition: "width .2s" }} />
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div style={{ flex: "none", padding: "12px 16px calc(18px + env(safe-area-inset-bottom))" }}>
        {step === 3 ? (
          <button onClick={submit} disabled={uploading} style={{ width: "100%", padding: 15, borderRadius: 15, border: "none", background: BRAND_GRAD, color: "#fff", fontWeight: 800, fontSize: 15, cursor: uploading ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: uploading ? 0.7 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 9 }}>
            {uploading && <Spinner size={18} />}
            {uploading ? (progress < 100 ? `Uploading… ${progress}%` : "Finishing…") : "Post to the wall"}
          </button>
        ) : step === 2 || (step === 1 && file) ? (
          // Step 1 keeps a Continue once a clip is picked, so backing out of
          // Details doesn't strand you re-picking the same file.
          <button onClick={next} style={{ width: "100%", padding: 15, borderRadius: 15, border: "none", cursor: canContinue ? "pointer" : "not-allowed", fontFamily: "inherit", fontWeight: 800, fontSize: 15, color: canContinue ? "#fff" : "#726D82", background: canContinue ? BRAND_GRAD : "rgba(var(--ts-neutral-rgb),.06)" }}>
            Continue
          </button>
        ) : null}
      </div>
    </div>
  );
}

const iconBtn: CSSProperties = { width: 38, height: 38, borderRadius: "50%", background: "rgba(var(--ts-neutral-rgb),.07)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: INK };
const choicePrimary: CSSProperties = { display: "flex", alignItems: "center", gap: 14, width: "100%", padding: "16px 18px", borderRadius: 16, border: "none", cursor: "pointer", fontFamily: "inherit", color: "#fff", background: BRAND_GRAD, textAlign: "left" };
const choiceOutline: CSSProperties = { display: "flex", alignItems: "center", gap: 14, width: "100%", padding: "16px 18px", borderRadius: 16, border: "1px solid rgba(var(--ts-neutral-rgb),.16)", cursor: "pointer", fontFamily: "inherit", color: INK, background: "rgba(var(--ts-neutral-rgb),.05)", textAlign: "left" };
const choiceIcon: CSSProperties = { width: 42, height: 42, flex: "none", borderRadius: 12, background: "rgba(var(--ts-neutral-rgb),.18)", display: "flex", alignItems: "center", justifyContent: "center" };
const h1: CSSProperties = { fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800, fontSize: 24, letterSpacing: "-.02em" };
const sub: CSSProperties = { fontSize: 13.5, color: MUTED, marginTop: 6 };
const detailInput: CSSProperties = { width: "100%", background: "rgba(var(--ts-neutral-rgb),.06)", border: "1px solid rgba(var(--ts-neutral-rgb),.1)", borderRadius: 14, padding: "14px 16px", color: INK, fontSize: 15, fontFamily: "inherit", outline: "none" };
