// Uploads spots with their videos in one go: creates (or updates) each spot, converts its video to a small
// web-friendly MP4, makes a still frame, uploads both and marks the spot live.
//
// Put in one folder:  the video files  +  spots.tsv (tab-separated, first row = these column names):
//   name  neighbourhood  category  indoor  price  address  station  sat_open  sat_close  sun_open  sun_close
//   video_url  venue_handle  creator_handle  note_en  note_de  video_file
// category: food | drinks | market | culture | sport | outdoors | nightlife | other
// price: 0 free, 1 under 15 EUR, 2 15-30 EUR, 3 over 30 EUR.   indoor: TRUE / FALSE.   times: HH:MM or empty.
// video_file: the file name of that spot's video in the same folder.
//
// Check first (writes nothing):   node --env-file=.env.local scripts/upload-spots.mjs <folder>
// Upload for real:                ADMIN_EMAIL=you@x.com ADMIN_PASSWORD=... UPLOAD_SITE_URL=https://nebenmir.app node --env-file=.env.local scripts/upload-spots.mjs <folder> --go
//
// The files go to Cloudflare R2 through the site's /api/media route, so UPLOAD_SITE_URL must be the deployed site
// (not localhost) and nobody needs an R2 key: the admin account is the only permission used.
//
// Needs ffmpeg, and an account that is an admin (see /admin on the site). Only upload videos you may host.
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const [folder, flag] = process.argv.slice(2);
const go = flag === "--go";
if (!folder || !existsSync(join(folder, "spots.tsv"))) {
  console.error("Usage: node --env-file=.env.local scripts/upload-spots.mjs <folder with spots.tsv and videos> [--go]");
  process.exit(1);
}
const CATEGORIES = ["food", "drinks", "market", "culture", "sport", "outdoors", "nightlife", "other"];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clean = (v) => (v && v.trim() ? v.trim() : null);

async function geocode(query) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=de&q=${encodeURIComponent(`${query}, Berlin`)}`;
  const res = await fetch(url, { headers: { "User-Agent": "spot-import-script/1.0" } });
  const hit = res.ok ? (await res.json())[0] : null;
  await sleep(1100); // the lookup service allows one request per second
  if (!hit) return null;
  const lat = Number(hit.lat);
  const lng = Number(hit.lon);
  return lat > 52.3 && lat < 52.7 && lng > 13.0 && lng < 13.8 ? { lat, lng } : null;
}

// ---- read and check the sheet
const [header, ...lines] = readFileSync(join(folder, "spots.tsv"), "utf8").split(/\r?\n/).filter((l) => l.trim());
const columns = header.split("\t").map((c) => c.trim().toLowerCase());
const spots = [];
let problems = 0;
for (const line of lines) {
  const cells = line.split("\t");
  const r = Object.fromEntries(columns.map((c, i) => [c, clean(cells[i])]));
  const name = (r.name ?? "").split(" — ")[0].trim();
  const issues = [];
  if (!name) issues.push("no name");
  if (!CATEGORIES.includes(r.category)) issues.push(`category "${r.category}" is not one of ${CATEGORIES.join(", ")}`);
  if (!/^[0-3]$/.test(r.price ?? "")) issues.push(`price "${r.price}" is not 0-3`);
  if (!r.address) issues.push("no address");
  if (!r.neighbourhood) issues.push("no neighbourhood (district)");
  if (!r.video_file || !existsSync(join(folder, r.video_file))) issues.push(`video file "${r.video_file}" not found in the folder`);
  for (const t of ["sat_open", "sat_close", "sun_open", "sun_close"]) if (r[t] && !/^\d{1,2}:\d{2}$/.test(r[t])) issues.push(`${t} "${r[t]}" is not HH:MM`);
  if (issues.length) {
    problems++;
    console.log(`PROBLEM  ${name || "(row without name)"}: ${issues.join("; ")}`);
    continue;
  }
  const place = (/\d/.test(r.address) ? await geocode(r.address) : null) ?? (await geocode(name)) ?? (await geocode(r.address));
  console.log(`ok       ${name} | ${r.neighbourhood} | ${r.category} | video ${r.video_file} | pin ${place ? `${place.lat.toFixed(4)}, ${place.lng.toFixed(4)}` : "NOT FOUND (list only, no pin)"}`);
  spots.push({
    video_file: r.video_file,
    row: {
      name, neighbourhood: r.neighbourhood, category: r.category, indoor: /^true$/i.test(r.indoor ?? ""), price: Number(r.price),
      address: r.address, station: r.station, sat_open: r.sat_open, sat_close: r.sat_close, sun_open: r.sun_open, sun_close: r.sun_close,
      video_url: r.video_url, venue_handle: r.venue_handle?.replace(/^@/, "") ?? null, creator_handle: r.creator_handle?.replace(/^@/, "") ?? null,
      note_en: r.note_en, note_de: r.note_de, lat: place?.lat ?? null, lng: place?.lng ?? null,
    },
  });
}
console.log(`\n${spots.length} spot(s) ready, ${problems} with problems.`);
if (!go) {
  console.log("This was a check only, nothing was uploaded. Add --go (with ADMIN_EMAIL and ADMIN_PASSWORD) to upload.");
  process.exit(problems ? 1 : 0);
}

// ---- upload
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const login = await db.auth.signInWithPassword({ email: process.env.ADMIN_EMAIL ?? "", password: process.env.ADMIN_PASSWORD ?? "" });
if (login.error) throw new Error(`Login failed: ${login.error.message}. Set ADMIN_EMAIL and ADMIN_PASSWORD.`);
if (!(await db.rpc("is_admin")).data) throw new Error("This account is not an admin. Open /admin on the site and follow the instruction there.");

const site = (process.env.UPLOAD_SITE_URL ?? "").replace(/\/$/, "");
if (!/^https:\/\//.test(site)) throw new Error("Set UPLOAD_SITE_URL to the deployed site, e.g. UPLOAD_SITE_URL=https://nebenmir.app");
const token = login.data.session.access_token;

// Send one file to R2 through the site. Returns its public URL.
async function uploadMedia(key, file, type) {
  const res = await fetch(`${site}/api/media?key=${encodeURIComponent(key)}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": type },
    body: readFileSync(file),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.url) throw new Error(json?.error ?? `upload failed (${res.status})`);
  return json.url;
}

const work = mkdtempSync(join(tmpdir(), "spots-"));
let failed = 0;
for (const { row, video_file } of spots) {
  try {
    // Small H.264 MP4 that plays on every phone, and a still for the card and the map pin. Originals are untouched.
    const stamp = crypto.randomUUID();
    const mp4 = join(work, `${stamp}.mp4`);
    const jpg = join(work, `${stamp}.jpg`);
    execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-i", join(folder, video_file), "-vf", "scale=-2:'min(1280,ih)'", "-c:v", "libx264", "-preset", "veryfast", "-crf", "27", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart", mp4]);
    execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-ss", "1", "-i", mp4, "-frames:v", "1", "-vf", "scale=540:-2", "-q:v", "4", jpg]);

    const existing = await db.from("spots").select("id").ilike("name", row.name).maybeSingle();
    if (existing.error) throw existing.error;
    const saved = existing.data
      ? await db.from("spots").update(row).eq("id", existing.data.id).select("id").single()
      : await db.from("spots").insert(row).select("id").single();
    if (saved.error) throw saved.error;
    const id = saved.data.id;

    const videoUrl = await uploadMedia(`${id}/${stamp}.mp4`, mp4, "video/mp4");
    const posterUrl = await uploadMedia(`${id}/${stamp}.jpg`, jpg, "image/jpeg");
    const live = await db.from("spots").update({ video_file_url: videoUrl, poster_url: posterUrl }).eq("id", id);
    if (live.error) throw live.error;
    console.log(`LIVE     ${row.name} (${existing.data ? "updated" : "new"}, video ${(statSync(mp4).size / 1e6).toFixed(1)} MB)`);
  } catch (error) {
    failed++;
    console.log(`FAILED   ${row.name}: ${error.message ?? error}`);
  }
}
console.log(`\nDone: ${spots.length - failed} live, ${failed} failed, ${problems} skipped for problems in the sheet.`);
process.exit(failed || problems ? 1 : 0);
