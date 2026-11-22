import { getCloudflareContext } from "@opennextjs/cloudflare";

// Serves the landing page video with byte-range support. Static files on Cloudflare answer a range request
// with the whole file, and iPhone Safari (and Instagram's browser on iPhone) will not play video that way.
// The file itself is public/landing/hero.mp4; replace it there and deploy.
const FILE = "/landing/hero.mp4";

async function readFile(request: Request): Promise<ArrayBuffer | null> {
  const url = new URL(FILE, request.url);
  let response: Response;
  try {
    // On Cloudflare the static files are reached through the ASSETS binding.
    const assets = (getCloudflareContext().env as unknown as { ASSETS: { fetch: (url: URL) => Promise<Response> } }).ASSETS;
    response = await assets.fetch(url);
  } catch {
    response = await fetch(url); // local `next start`: the file is served by Next itself
  }
  return response.ok ? response.arrayBuffer() : null;
}

export async function GET(request: Request) {
  const body = await readFile(request);
  if (!body) return new Response("Not found", { status: 404 });
  const size = body.byteLength;
  const headers: Record<string, string> = {
    "Content-Type": "video/mp4",
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=3600",
  };

  const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get("range") ?? "");
  if (!range || (!range[1] && !range[2])) return new Response(body, { headers: { ...headers, "Content-Length": String(size) } });

  // "bytes=500-" is from 500 to the end, "bytes=-500" is the last 500 bytes.
  const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
  const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
  if (start > end || start >= size) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
  const part = body.slice(start, end + 1);
  return new Response(part, { status: 206, headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(part.byteLength) } });
}
