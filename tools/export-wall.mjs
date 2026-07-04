#!/usr/bin/env node
// Export a Tomorrow Stories event: downloads every live video (+ poster) and
// generates a self-contained, offline "wall" HTML that references the local
// files. Zip the output folder and hand it to the client.
//
// Usage:
//   node tools/export-wall.mjs --site https://xxx.cloudfront.net --event <eventId> [--out ./export]
//   node tools/export-wall.mjs --api  https://xxx.execute-api... --event <eventId> [--out ./export]
//
// Needs Node 18+ (global fetch). No dependencies.

import fs from "node:fs";
import path from "node:path";

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const slug = (s) =>
  (s || "clip")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 48) || "clip";

const esc = (s) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} for ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(dest, buf);
  return buf.length;
}

async function main() {
  const site = arg("site");
  let apiUrl = arg("api");
  const eventId = arg("event");
  const outDir = path.resolve(arg("out", "./wall-export"));

  if (!eventId || (!site && !apiUrl)) {
    console.error("Usage: node tools/export-wall.mjs --site <siteUrl> --event <eventId> [--out dir]");
    process.exit(1);
  }

  if (!apiUrl) {
    const cfg = await fetch(`${site.replace(/\/$/, "")}/config.json`).then((r) => r.json());
    apiUrl = cfg.apiUrl;
    if (!apiUrl) throw new Error("Could not read apiUrl from the site's /config.json");
  }
  apiUrl = apiUrl.replace(/\/$/, "");

  console.log(`Fetching event ${eventId} …`);
  const { event, videos } = await fetch(`${apiUrl}/events/${eventId}/videos`).then((r) => {
    if (!r.ok) throw new Error(`Event fetch failed (${r.status})`);
    return r.json();
  });

  const live = videos.filter((v) => v.status === "live" && v.mediaUrl);
  console.log(`${live.length} live video(s) to export.`);

  fs.mkdirSync(path.join(outDir, "videos"), { recursive: true });
  fs.mkdirSync(path.join(outDir, "posters"), { recursive: true });

  const items = [];
  let i = 0;
  for (const v of live) {
    i++;
    const base = `${slug(v.title)}-${v.id}`;
    const videoFile = `videos/${base}.mp4`;
    let posterFile = null;
    process.stdout.write(`  [${i}/${live.length}] ${v.title} … `);
    await download(v.mediaUrl, path.join(outDir, videoFile));
    if (v.posterUrl) {
      posterFile = `posters/${base}.jpg`;
      try {
        await download(v.posterUrl, path.join(outDir, posterFile));
      } catch {
        posterFile = null;
      }
    }
    items.push({ ...v, videoFile, posterFile });
    console.log("done");
  }

  fs.writeFileSync(path.join(outDir, "index.html"), renderWall(event, items));
  fs.writeFileSync(
    path.join(outDir, "README.txt"),
    `${event.name} — Tomorrow Stories export\n\n` +
      `Open index.html in any browser to view the wall offline.\n` +
      `Raw video files are in the videos/ folder (standard MP4).\n` +
      `${items.length} videos exported on ${new Date().toISOString()}.\n`
  );

  console.log(`\n✅ Exported ${items.length} videos to ${outDir}`);
  console.log(`   Open ${path.join(outDir, "index.html")} — or zip the folder to share.`);
}

function renderWall(event, items) {
  const themes = new Map((event.themes || []).map((t) => [t.id, t]));
  const cards = items
    .map((v) => {
      const t = themes.get(v.theme) || { name: "", color: "#8B8698" };
      const poster = v.posterFile ? ` poster="${esc(v.posterFile)}"` : "";
      return `
      <figure class="card">
        <video class="vid" controls preload="none"${poster}>
          <source src="${esc(v.videoFile)}" type="video/mp4" />
        </video>
        <figcaption>
          <span class="pill" style="background:${esc(t.color)}">${esc(t.name)}</span>
          <h3>${esc(v.title)}</h3>
          <p>${esc(v.author)}</p>
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
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@600;800&family=Hanken+Grotesk:wght@500;700&display=swap" rel="stylesheet" />
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

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  main().catch((e) => {
    console.error("\n❌ Export failed:", e.message);
    process.exit(1);
  });
}

export { renderWall, slug, esc };
