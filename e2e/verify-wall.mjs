// Post-deploy verification against the LIVE site:
//  1. big-screen autoplay appears WITHOUT a refresh (open wall → upload → it plays)
//  2. admin "Download archive" produces a valid zip (index.html + videos/)
//  3. admin delete removes the event (API 200, then 404)
// Usage: node verify-wall.mjs <adminKey> <webmPath>
import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const JSZip = require("/Users/admin/Documents/tomorrow-stories/tscode/frontend/node_modules/jszip");

const API = "https://jgh4z7o1c1.execute-api.ap-southeast-2.amazonaws.com";
const SITE = "https://d3qfw14f8gdgri.cloudfront.net";
const KEY = process.argv[2];
const WEBM = process.argv[3];
const results = {};
const mark = (k, ok, extra = "") => { results[k] = ok; console.log(`${ok ? "PASS" : "FAIL"}  ${k}  ${extra}`); };

async function createEvent(name) {
  return (await fetch(`${API}/events`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name }) })).json();
}
async function uploadWebm(eventId) {
  const up = await (await fetch(`${API}/events/${eventId}/uploads`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ title: "Verify Clip", theme: "create", author: "verify", durationSec: 3, contentType: "video/webm" }),
  })).json();
  const form = new FormData();
  for (const [k, v] of Object.entries(up.upload.fields)) form.append(k, v);
  form.append("file", new Blob([readFileSync(WEBM)], { type: "video/webm" }), "clip.webm");
  const res = await fetch(up.upload.url, { method: "POST", body: form });
  if (!(res.status >= 200 && res.status < 300)) throw new Error("S3 upload " + res.status);
  return up.video;
}

const browser = await chromium.launch();
let eventId;
try {
  const ev = await createEvent("__verify_wall");
  eventId = ev.eventId;
  console.log("event", eventId, ev.code);

  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript((k) => sessionStorage.setItem("ts:adminKey", k), KEY);

  // --- 1) open the big screen FIRST (empty), then upload, then watch it appear + play, no reload
  const page = await ctx.newPage();
  await page.goto(`${SITE}/e/${eventId}/big`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  const before = await page.evaluate(() => document.querySelectorAll("video").length);
  const vid = await uploadWebm(eventId);
  console.log("uploaded", vid.id, vid.status);

  let played = false, detail = "";
  const deadline = Date.now() + 35000;
  while (Date.now() < deadline) {
    const s = await page.evaluate(() => {
      const vs = [...document.querySelectorAll("video")];
      const p = vs.find((v) => v.currentTime > 0 && !v.paused && v.readyState >= 2);
      return { n: vs.length, playing: !!p, ct: p ? p.currentTime : 0 };
    });
    if (s.playing) { played = true; detail = `videos=${s.n} currentTime=${s.ct.toFixed(2)}s`; break; }
    await page.waitForTimeout(1000);
  }
  mark("autoplay_appears_without_refresh", played, `(before=${before}) ${detail}`);

  // --- 1b) the big-screen page (wall + table below) scrolls vertically
  const scroll = await page.evaluate(() => {
    window.scrollTo(0, 600);
    return { scrollable: document.documentElement.scrollHeight > window.innerHeight + 40, y: window.scrollY };
  });
  mark("big_screen_scrolls", scroll.scrollable && scroll.y > 50, `scrollHeight>vh=${scroll.scrollable} scrollY=${scroll.y}`);

  // --- 1c) creator IP: present for admin, absent for public
  const pub = await (await fetch(`${API}/events/${eventId}`)).json();
  const adm = await (await fetch(`${API}/admin/events`, { headers: { "x-admin-key": KEY } })).json();
  const admEv = (adm.events || []).find((e) => e.eventId === eventId);
  mark("creator_ip_admin_only", !("creatorIp" in pub) && !!admEv?.creatorIp, `public=${pub.creatorIp} admin=${admEv?.creatorIp}`);

  // --- 2) admin Download archive → valid zip
  const admin = await ctx.newPage();
  await admin.goto(`${SITE}/admin`, { waitUntil: "domcontentloaded" });
  await admin.waitForTimeout(2500);
  let zipOk = false, zdetail = "";
  try {
    const dlWait = admin.waitForEvent("download", { timeout: 45000 });
    await admin.getByRole("button", { name: /Download archive/i }).first().click();
    const dl = await dlWait;
    const zip = await JSZip.loadAsync(readFileSync(await dl.path()));
    const names = Object.keys(zip.files);
    zipOk = names.includes("index.html") && names.some((n) => n.startsWith("videos/"));
    zdetail = `file=${dl.suggestedFilename()} entries=[${names.join(", ")}]`;
  } catch (e) { zdetail = "err " + e.message; }
  mark("admin_download_archive", zipOk, zdetail);

  // --- 2b) admin page scrolls vertically (force overflow with a short viewport)
  await admin.setViewportSize({ width: 900, height: 380 });
  await admin.waitForTimeout(400);
  const as = await admin.evaluate(() => {
    window.scrollTo(0, 500);
    return { scrollable: document.documentElement.scrollHeight > window.innerHeight + 20, y: window.scrollY };
  });
  mark("admin_scrolls", as.scrollable && as.y > 30, `scrollHeight>vh=${as.scrollable} scrollY=${as.y}`);

  // --- 3) delete via admin API, confirm gone
  const del = await fetch(`${API}/events/${eventId}`, { method: "DELETE", headers: { "x-admin-key": KEY } });
  const dbody = await del.json().catch(() => ({}));
  const recheck = await fetch(`${API}/events/${eventId}/videos`);
  const gone = del.status === 200 && recheck.status === 404;
  mark("admin_delete_event", gone, `delete=${del.status} recheck=${recheck.status} videosDeleted=${dbody.videos}`);
  if (gone) eventId = null; // already cleaned up

  console.log("\nRESULTS " + JSON.stringify(results));
} finally {
  await browser.close();
  // safety cleanup if a step threw before delete
  if (eventId) await fetch(`${API}/events/${eventId}`, { method: "DELETE", headers: { "x-admin-key": KEY } }).catch(() => {});
}
const allOk = Object.values(results).every(Boolean) && Object.keys(results).length === 6;
process.exit(allOk ? 0 : 1);
