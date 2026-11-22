import { createClient as createTokenClient } from "@supabase/supabase-js";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { env } from "@/lib/env";
import { createClient as createCookieClient } from "@/lib/supabase/server";

// Admin-only upload of spot videos and stills to Cloudflare R2.
//
//   PUT /api/media?key=<spot id>/<upload id>.mp4     body: the file, Content-Type: video/mp4
//   PUT /api/media?key=<spot id>/<upload id>.jpg     body: the file, Content-Type: image/jpeg
//   -> { "url": "https://media.nebenmir.app/<key>" }
//
// Who may call it: a signed-in admin (see public.admins). The /admin page sends its session cookie; the upload script
// sends "Authorization: Bearer <access token>". The bucket is reached through the MEDIA binding in wrangler.jsonc,
// so there is no R2 key anywhere. Files are served from the bucket's public domain, MEDIA_PUBLIC_URL.

const KEY = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}\/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}\.(mp4|mov|webm|jpg)$/i;
const TYPES: Record<string, string> = { mp4: "video/mp4", mov: "video/quicktime", webm: "video/webm", jpg: "image/jpeg" };
// Cloudflare Workers accept request bodies up to 100 MB on the free and Pro plans.
const MAX_BYTES = 95 * 1024 * 1024;

// The part of an R2 bucket this route uses.
type Bucket = {
  put(key: string, value: ReadableStream, options: { httpMetadata: { contentType: string; cacheControl: string } }): Promise<unknown>;
};
// Workers provides this globally; the project's DOM types do not declare it.
type FixedLengthStreamConstructor = new (length: number) => {
  readable: ReadableStream<Uint8Array>;
  writable: WritableStream<Uint8Array>;
};

const fail = (status: number, error: string) => Response.json({ error }, { status });

async function isAdmin(request: Request): Promise<boolean> {
  const bearer = /^Bearer (.+)$/.exec(request.headers.get("authorization") ?? "")?.[1];
  const supabase = bearer
    ? createTokenClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${bearer}` } },
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : await createCookieClient();
  const { data } = await supabase.rpc("is_admin");
  return data === true;
}

export async function PUT(request: Request) {
  if (!(await isAdmin(request))) return fail(401, "Sign in with an admin account.");

  let bucket: Bucket | undefined;
  let publicUrl: string | undefined;
  try {
    const cf = getCloudflareContext().env as unknown as { MEDIA?: Bucket; MEDIA_PUBLIC_URL?: string };
    bucket = cf.MEDIA;
    publicUrl = cf.MEDIA_PUBLIC_URL;
  } catch {
    // Not running on Cloudflare (plain `next dev`).
  }
  if (!bucket || !publicUrl) return fail(503, "Video storage (R2) is not set up here. Upload on the deployed site.");

  const key = new URL(request.url).searchParams.get("key") ?? "";
  if (!KEY.test(key)) return fail(400, "Bad key. Use <spot id>/<upload id>.<mp4|mov|webm|jpg>.");
  const contentType = TYPES[key.split(".").pop()!.toLowerCase()];
  if (request.headers.get("content-type")?.split(";")[0] !== contentType) return fail(415, `Content-Type must be ${contentType}.`);

  const length = Number(request.headers.get("content-length"));
  if (!Number.isSafeInteger(length) || length <= 0) return fail(411, "Content-Length is required.");
  if (length > MAX_BYTES) return fail(413, `File is over ${MAX_BYTES / 1024 / 1024} MB. Export a smaller version.`);
  if (!request.body) return fail(400, "Empty body.");

  // OpenNext rebuilds the request body as a Node/web stream, losing the known-length
  // metadata required by R2. Restore it without buffering the video in memory.
  const { FixedLengthStream } = globalThis as unknown as { FixedLengthStream: FixedLengthStreamConstructor };
  const fixed = new FixedLengthStream(length);
  const transfer = new AbortController();
  const pipe = request.body.pipeTo(fixed.writable, { signal: transfer.signal });
  try {
    // The key has a new upload id every time, so replaced videos bypass old caches.
    await Promise.all([
      pipe,
      bucket.put(key, fixed.readable, { httpMetadata: { contentType, cacheControl: "public, max-age=31536000, immutable" } }),
    ]);
  } catch (error) {
    // A rejected R2 write may leave the pipe blocked on backpressure. Cancel both
    // ends so the incoming upload does not keep running after a failed write.
    transfer.abort(error);
    await Promise.allSettled([fixed.readable.cancel(error), pipe]);
    console.error("R2 media upload failed", error);
    return fail(502, "Video storage upload failed. Please retry.");
  }
  return Response.json({ url: `${publicUrl.replace(/\/$/, "")}/${key}` });
}
