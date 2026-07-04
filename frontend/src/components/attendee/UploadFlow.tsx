import { useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { Theme, VideoDTO, VideoStatus } from "../../types";
import { api } from "../../api";
import { BRAND_GRAD, fmtDur, MUTED, pairFor, stillBg, themeById } from "../../design";
import { Spinner } from "../common";

type Step = 1 | 2 | 3 | 4 | 5;
const STEP_LABELS = ["", "Record", "Trim", "Details", "Review"];

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
  const inputRef = useRef<HTMLInputElement>(null);

  const dTheme = themeById(themes, themeId || "create");
  const titleShown = title.trim() || "My 60-second story";

  function pickFile() {
    inputRef.current?.click();
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

  const canContinue = step !== 3 || (!!themeId && !!title.trim());

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
        { title: titleShown, theme: themeId || "create", author: authorName.trim() || "You", durationSec, contentType: file?.type || "video/mp4" },
        file,
        setProgress
      );
      onUploaded(v);
      setPostedStatus(v.status);
      setStep(5);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  // ---- Done screen ----
  if (step === 5) {
    return (
      <div style={{ height: "100%", width: "100%", display: "flex", flexDirection: "column", background: "#0B0812" }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32, textAlign: "center" }}>
          <div style={{ width: 88, height: 88, borderRadius: "50%", background: BRAND_GRAD, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 16px 44px -12px #FF6B35", animation: "rise .4s ease" }}>
            <svg width="42" height="42" viewBox="0 0 24 24" fill="none">
              <path d="M5 12.5L10 17.5L19 7" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800, fontSize: 27, letterSpacing: "-.02em", marginTop: 22 }}>
            {postedStatus === "live" ? "You're live on the wall!" : "You're on the wall!"}
          </div>
          <div style={{ fontSize: 14, color: "#9E99AD", lineHeight: 1.5, marginTop: 8, maxWidth: 260 }}>
            {postedStatus === "live" ? (
              <>Your clip is now playing in <b style={{ color: "#F4F1EC" }}>{dTheme.name}</b> on the wall — go watch it with the room.</>
            ) : (
              <>Your clip is uploading to <b style={{ color: "#F4F1EC" }}>{dTheme.name}</b> — it appears on the wall as soon as it finishes processing (usually under a minute).</>
            )}
          </div>
          <button onClick={onClose} style={{ marginTop: 28, width: "100%", maxWidth: 260, padding: 15, borderRadius: 15, border: "none", background: BRAND_GRAD, color: "#fff", fontWeight: 800, fontSize: 15, cursor: "pointer", fontFamily: "inherit" }}>
            See it on the wall
          </button>
          <button onClick={reset} style={{ marginTop: 11, width: "100%", maxWidth: 260, padding: 15, borderRadius: 15, border: "1px solid rgba(255,255,255,.14)", background: "transparent", color: "#F4F1EC", fontWeight: 700, fontSize: 15, cursor: "pointer", fontFamily: "inherit" }}>
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
    <div style={{ height: "100%", width: "100%", display: "flex", flexDirection: "column", background: "#0B0812" }}>
      <input ref={inputRef} type="file" accept="video/*" capture="user" onChange={onFile} style={{ display: "none" }} />

      <div style={{ flex: "none", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px 4px" }}>
        <button onClick={back} style={iconBtn}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M15 5L8 12L15 19" stroke="#F4F1EC" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <div style={{ fontWeight: 700, fontSize: 15 }}>{STEP_LABELS[step]}</div>
        <button onClick={onClose} style={iconBtn}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M6 6L18 18M18 6L6 18" stroke="#F4F1EC" strokeWidth="2" strokeLinecap="round" /></svg>
        </button>
      </div>

      <div style={{ flex: "none", height: 4, margin: "8px 16px 0", borderRadius: 2, background: "rgba(255,255,255,.08)" }}>
        <div style={{ width: `${(Math.min(step, 4) / 4) * 100}%`, height: "100%", borderRadius: 2, background: BRAND_GRAD, transition: "width .3s" }} />
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "18px 16px" }}>
        {step === 1 && (
          <>
            <div style={h1}>Share your story</div>
            <div style={sub}>One take, up to 60 seconds. Shot on your phone.</div>
            <div style={{ position: "relative", marginTop: 20, borderRadius: 22, overflow: "hidden", aspectRatio: "10 / 13", background: "radial-gradient(120% 90% at 50% 20%, #2a2140, #0f0b1a)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", border: "1px solid rgba(255,255,255,.08)" }}>
              <div style={{ position: "absolute", top: 14, left: 14, display: "flex", alignItems: "center", gap: 6, background: "rgba(0,0,0,.4)", padding: "4px 10px", borderRadius: 999, fontSize: 11, fontWeight: 800, letterSpacing: ".05em" }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#FF3D57", animation: "blink 1s infinite" }} />REC
              </div>
              <div style={{ position: "absolute", top: 14, right: 14, fontSize: 11, fontWeight: 700, color: "#D9D6E0", background: "rgba(0,0,0,.4)", padding: "4px 10px", borderRadius: 999 }}>0:00 / 1:00</div>
              <svg width="46" height="46" viewBox="0 0 24 24" fill="none" style={{ opacity: 0.5 }}><rect x="3" y="6" width="13" height="12" rx="2.5" stroke="#fff" strokeWidth="1.6" /><path d="M16 10l5-3v10l-5-3" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" /></svg>
              <button onClick={pickFile} style={{ position: "absolute", bottom: 24, width: 70, height: 70, borderRadius: "50%", background: "rgba(255,255,255,.14)", border: "3px solid #fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                <span style={{ width: 50, height: 50, borderRadius: "50%", background: "#FF3D57" }} />
              </button>
            </div>
            <button onClick={pickFile} style={{ marginTop: 14, width: "100%", padding: 14, borderRadius: 15, border: "1px solid rgba(255,255,255,.14)", background: "rgba(255,255,255,.05)", color: "#F4F1EC", fontWeight: 700, fontSize: 14.5, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 9 }}>
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="14" rx="2.5" stroke="#C9C6D4" strokeWidth="1.6" /><path d="M3 16l5-4 4 3 4-4 5 4" stroke="#C9C6D4" strokeWidth="1.6" strokeLinejoin="round" /></svg>
              Upload from camera roll
            </button>
          </>
        )}

        {step === 2 && (
          <>
            <div style={h1}>Preview</div>
            <div style={sub}>Check your best moment. Trimming lands in a later update — for now the full clip goes up.</div>
            <div style={{ position: "relative", marginTop: 20, borderRadius: 22, overflow: "hidden", aspectRatio: "10 / 12", background: "#000" }}>
              {fileUrl ? (
                <video src={fileUrl} controls playsInline style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <div style={fillBg} />
              )}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 700, color: "#9E99AD", marginTop: 12 }}>
              <span>Selected clip</span>
              <span style={{ color: "#F4F1EC" }}>{fmtDur(durationSec)}</span>
            </div>
          </>
        )}

        {step === 3 && (
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
                  <button key={t.id} onClick={() => setThemeId(t.id)} style={{ padding: "10px 15px", borderRadius: 999, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", border: "1px solid " + (on ? t.color : "rgba(255,255,255,.14)"), background: on ? t.color : "rgba(255,255,255,.04)", color: on ? "#0C0A12" : "#C9C6D4" }}>
                    {t.name}
                  </button>
                );
              })}
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <div style={h1}>Ready to post?</div>
            <div style={sub}>This goes live on the wall right away.</div>
            <div style={{ marginTop: 20, display: "flex", gap: 14, alignItems: "center", padding: 14, borderRadius: 18, background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)" }}>
              <div style={{ position: "relative", width: 78, height: 104, borderRadius: 14, flex: "none", overflow: "hidden" }}>
                {fileUrl ? <video src={fileUrl} muted playsInline style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={fillBg} />}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "inline-block", padding: "5px 12px", borderRadius: 999, fontSize: 11.5, fontWeight: 800, background: dTheme.color, color: "#0C0A12", whiteSpace: "nowrap" }}>{dTheme.name}</div>
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
                <div style={{ height: 6, borderRadius: 3, background: "rgba(255,255,255,.08)", overflow: "hidden" }}>
                  <div style={{ width: `${Math.max(progress, 4)}%`, height: "100%", borderRadius: 3, background: BRAND_GRAD, transition: "width .2s" }} />
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div style={{ flex: "none", padding: "12px 16px calc(18px + env(safe-area-inset-bottom))" }}>
        {step === 4 ? (
          <button onClick={submit} disabled={uploading} style={{ width: "100%", padding: 15, borderRadius: 15, border: "none", background: BRAND_GRAD, color: "#fff", fontWeight: 800, fontSize: 15, cursor: uploading ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: uploading ? 0.7 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 9 }}>
            {uploading && <Spinner size={18} />}
            {uploading ? (progress < 100 ? `Uploading… ${progress}%` : "Finishing…") : "Post to the wall"}
          </button>
        ) : step >= 2 && step <= 3 ? (
          <button onClick={next} style={{ width: "100%", padding: 15, borderRadius: 15, border: "none", cursor: canContinue ? "pointer" : "not-allowed", fontFamily: "inherit", fontWeight: 800, fontSize: 15, color: canContinue ? "#fff" : "#726D82", background: canContinue ? BRAND_GRAD : "rgba(255,255,255,.06)" }}>
            Continue
          </button>
        ) : null}
      </div>
    </div>
  );
}

const iconBtn: CSSProperties = { width: 38, height: 38, borderRadius: "50%", background: "rgba(255,255,255,.07)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" };
const h1: CSSProperties = { fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800, fontSize: 24, letterSpacing: "-.02em" };
const sub: CSSProperties = { fontSize: 13.5, color: "#9E99AD", marginTop: 6 };
const detailInput: CSSProperties = { width: "100%", background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 14, padding: "14px 16px", color: "#F4F1EC", fontSize: 15, fontFamily: "inherit", outline: "none" };
