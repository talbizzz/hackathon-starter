// Turns a tab-separated export of the curation sheet into SQL inserts for public.spots,
// looking up coordinates for the map from each address (OpenStreetMap Nominatim, 1 request/second).
//
// Usage:  node scripts/import-spots.mjs scripts/data/batch-1.tsv > /tmp/spots.sql
//         pnpm exec supabase db query --remote -f /tmp/spots.sql
//
// Columns, in order (extra columns after note_de are ignored, a header row is skipped):
// name, district, category, indoor, price, address, station, sat_open, sat_close, sun_open, sun_close,
// video_url, venue_handle, creator_handle, note_en, note_de
import { readFileSync } from "node:fs";

const CATEGORIES = ["food", "drinks", "market", "culture", "sport", "outdoors", "nightlife", "other"];
const VIDEO = /tiktok\.com\/@[^/]+\/video\/\d+|instagram\.com\/(?:[^/]+\/)?(?:reels?|p)\/[A-Za-z0-9_-]+/;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const text = (v) => (v ? `'${v.replace(/'/g, "''")}'` : "null");

async function geocode(query) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=de&q=${encodeURIComponent(`${query}, Berlin`)}`;
  const res = await fetch(url, { headers: { "User-Agent": "spot-import-script/1.0" } });
  const hit = res.ok ? (await res.json())[0] : null;
  await sleep(1100);
  if (!hit) return null;
  const lat = Number(hit.lat);
  const lng = Number(hit.lon);
  // Reject anything outside Berlin: a wrong pin is worse than no pin.
  return lat > 52.3 && lat < 52.7 && lng > 13.0 && lng < 13.8 ? { lat, lng } : null;
}

const rows = readFileSync(process.argv[2], "utf8").split(/\r?\n/).filter((line) => line.trim());
const values = [];
for (const line of rows) {
  const c = line.split("\t").map((cell) => cell.trim());
  if (c[0].toLowerCase() === "name") continue;
  const [rawName, district, category, indoor, price, address, station, satOpen, satClose, sunOpen, sunClose, videoUrl, venue, creator, noteEn, noteDe] = c;
  const name = rawName.split(" — ")[0].trim(); // "Place — detail" becomes "Place"; the note carries the detail
  const problems = [];
  if (!CATEGORIES.includes(category)) problems.push(`unknown category "${category}"`);
  if (!VIDEO.test(videoUrl ?? "")) problems.push("video_url is not a full TikTok or Instagram post link");
  if (!address) problems.push("no address");
  if (!/^[0-3]$/.test(price)) problems.push(`price "${price}" is not 0-3`);
  if (problems.length) {
    console.error(`SKIPPED ${name}: ${problems.join("; ")}`);
    continue;
  }
  // A street without a house number geocodes to the middle of the street, so fall back to the place name.
  const place = (/\d/.test(address) ? await geocode(address) : null) ?? (await geocode(name)) ?? (await geocode(address));
  if (!place) console.error(`NO PIN ${name}: could not find coordinates, it will show in the list but not on the map`);
  else console.error(`ok ${name}: ${place.lat.toFixed(5)}, ${place.lng.toFixed(5)}`);
  values.push(
    `(${[
      text(name), text(district), text(category), /^true$/i.test(indoor), Number(price), text(address), text(station),
      text(satOpen), text(satClose), text(sunOpen), text(sunClose), text(videoUrl), text(venue?.replace(/^@/, "")),
      text(creator?.replace(/^@/, "")), text(noteEn), text(noteDe), place?.lat ?? "null", place?.lng ?? "null",
    ].join(", ")})`,
  );
}
if (values.length)
  console.log(
    `insert into public.spots (name, neighbourhood, category, indoor, price, address, station, sat_open, sat_close, sun_open, sun_close, video_url, venue_handle, creator_handle, note_en, note_de, lat, lng) values\n${values.join(",\n")};`,
  );
