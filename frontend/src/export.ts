// Client-side event archive: fetches every live clip (same-origin via the
// CloudFront /media/* path, so no CORS) and zips them with a self-contained,
// offline "wall" HTML that references the local files — the browser equivalent
// of tools/export-wall.mjs. Handy for post-event handoff from the admin console.

import JSZip from "jszip";
import type { CommentDTO, EventDTO, VideoDTO } from "./types";

export const slug = (s: string): string =>
  (s || "clip")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 48) || "clip";

export const esc = (s: unknown): string =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string);

/** Original file extension carried on the media URL (mov/mp4/webm/…), default mp4. */
export function extFromUrl(url: string): string {
  const m = /\.([a-z0-9]+)(?:[?#]|$)/i.exec(url);
  return m ? m[1].toLowerCase() : "mp4";
}

function mimeFor(ext: string): string {
  return (
    { mov: "video/quicktime", webm: "video/webm", mkv: "video/x-matroska", "3gp": "video/3gpp" }[ext] ||
    "video/mp4"
  );
}

interface ExportItem extends VideoDTO {
  videoFile: string;
  posterFile: string | null;
  ext: string;
}

/** The offline wall page (self-contained; references ./videos and ./posters). */
export function renderWall(event: EventDTO, items: ExportItem[], comments: CommentDTO[] = []): string {
  const themes = new Map((event.themes || []).map((t) => [t.id, t]));
  const byVideo = new Map<string, CommentDTO[]>();
  for (const c of comments) byVideo.set(c.videoId, [...(byVideo.get(c.videoId) || []), c]);
  const cards = items
    .map((v) => {
      const t = themes.get(v.theme) || { name: "", color: "#8B8698" };
      const poster = v.posterFile ? ` poster="${esc(v.posterFile)}"` : "";
      const cmts = byVideo.get(v.id) || [];
      const cmtHtml = cmts.length
        ? `<div class="cmts">${cmts
            .map((c) => `<div class="cmt"><b>${esc(c.author)}</b> ${esc(c.text)}</div>`)
            .join("")}</div>`
        : "";
      return `
      <figure class="card">
        <video class="vid" controls preload="none"${poster}>
          <source src="${esc(v.videoFile)}" type="${esc(mimeFor(v.ext))}" />
        </video>
        <figcaption>
          <span class="pill" style="background:${esc(t.color)}">${esc(t.name)}</span>
          <h3>${esc(v.title)}</h3>
          <p>${esc(v.author)}</p>
          ${cmtHtml}
        </figcaption>
      </figure>`;
    })
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(event.name)} — Story Wall</title>
<style>
  :root { --ink:#F4F1EC; --muted:#8B8698; }
  * { box-sizing:border-box; margin:0; }
  body { background:radial-gradient(1300px 740px at 50% -8%, #223159, #0C1024 60%) fixed; color:var(--ink);
         font-family:'Hanken Grotesk', system-ui, -apple-system, sans-serif; min-height:100vh; padding:48px 20px 80px; }
  header { max-width:1100px; margin:0 auto 34px; display:flex; align-items:center; gap:14px; }
  .logo { width:44px; height:44px; border-radius:13px; background:linear-gradient(120deg,#FF6B35,#FF3D77 46%,#7B2FF7); }
  h1 { font-family:'Bricolage Grotesque', sans-serif; font-weight:800; font-size:30px; letter-spacing:-.02em; }
  .sub { color:var(--muted); font-weight:600; font-size:13px; letter-spacing:.04em; margin-top:3px; }
  .grid { max-width:1100px; margin:0 auto; display:grid; gap:18px;
          grid-template-columns:repeat(auto-fill, minmax(220px, 1fr)); }
  .card { background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.08); border-radius:18px; overflow:hidden; }
  .vid { width:100%; aspect-ratio:9/14; object-fit:cover; background:#000; display:block; }
  figcaption { padding:12px 14px 15px; }
  .pill { display:inline-block; color:#0C0A12; font-weight:800; font-size:11px; padding:4px 10px; border-radius:999px; }
  figcaption h3 { font-weight:700; font-size:15px; line-height:1.25; margin-top:9px; }
  figcaption p { color:var(--muted); font-weight:600; font-size:12.5px; margin-top:4px; }
  .cmts { margin-top:11px; border-top:1px solid rgba(255,255,255,.08); padding-top:9px; display:flex; flex-direction:column; gap:6px; }
  .cmt { font-size:12px; line-height:1.4; color:var(--muted); }
  .cmt b { color:var(--ink); font-weight:700; }
  footer { max-width:1100px; margin:40px auto 0; color:var(--muted); font-size:12px; text-align:center; }
</style>
</head>
<body>
  <header>
    <div class="logo"></div>
    <div>
      <h1>${esc(event.name)}</h1>
      <div class="sub">CONFERENCE STORY WALL · ${items.length} STORIES</div>
    </div>
  </header>
  <main class="grid">${cards}
  </main>
  <footer>Exported from Tomorrow Stories. Video files live in the <code>videos/</code> folder.</footer>
</body>
</html>`;
}

/**
 * Build a downloadable .zip Blob of an event: videos/, posters/, index.html,
 * README.txt. `onProgress(done, total)` reports per-clip download progress.
 */
export async function buildArchive(
  event: EventDTO,
  videos: VideoDTO[],
  comments: CommentDTO[] = [],
  onProgress?: (done: number, total: number) => void
): Promise<Blob> {
  const live = videos.filter((v) => v.status === "live" && v.mediaUrl);
  const zip = new JSZip();
  const items: ExportItem[] = [];
  const skipped: string[] = [];
  onProgress?.(0, live.length);
  for (let i = 0; i < live.length; i++) {
    const v = live[i];
    // A single unavailable clip (404/403, still uploading) shouldn't sink the
    // whole export — skip it and keep going.
    try {
      const ext = extFromUrl(v.mediaUrl!);
      const base = `${slug(v.title)}-${v.id}`;
      const videoFile = `videos/${base}.${ext}`;
      const res = await fetch(v.mediaUrl!);
      if (!res.ok) throw new Error(String(res.status));
      zip.file(videoFile, await res.blob());
      let posterFile: string | null = null;
      if (v.posterUrl) {
        try {
          const pr = await fetch(v.posterUrl);
          if (pr.ok) {
            posterFile = `posters/${base}.jpg`;
            zip.file(posterFile, await pr.blob());
          }
        } catch {
          posterFile = null;
        }
      }
      items.push({ ...v, videoFile, posterFile, ext });
    } catch {
      skipped.push(v.title);
    }
    onProgress?.(i + 1, live.length);
  }
  if (items.length === 0) throw new Error("None of the videos could be downloaded.");
  zip.file("index.html", renderWall(event, items, comments));
  // Structured comments export (name, text, video, timestamp) for reuse.
  zip.file("comments.json", JSON.stringify(comments, null, 2));
  zip.file(
    "README.txt",
    `${event.name} — Tomorrow Stories export\n\n` +
      `Open index.html in any browser to view the wall offline (comments included under each clip).\n` +
      `Raw video files are in the videos/ folder; all comments are in comments.json.\n` +
      `${items.length} video(s) and ${comments.length} comment(s) exported.\n` +
      (skipped.length ? `${skipped.length} clip(s) could not be downloaded and were skipped.\n` : "")
  );
  return zip.generateAsync({ type: "blob" });
}
