import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Use Wrangler's installed local runtime and bundler. No cloud account, network
// services, environment files, or persistent bucket are used by these tests.
const require = createRequire(import.meta.url);
const wranglerRequire = createRequire(require.resolve("wrangler/package.json"));
const { Miniflare, convertV4MiniflareOptions } = wranglerRequire("miniflare");
const { build } = wranglerRequire("esbuild");
type StubBuilder = {
  onResolve(options: { filter: RegExp }, callback: (args: { path: string }) => { path: string; namespace: string }): void;
  onLoad(options: { filter: RegExp; namespace: string }, callback: (args: { path: string }) => { contents: string }): void;
};
let runtime: {
  dispatchFetch(url: string, init: RequestInit): Promise<Response>;
  dispose(): Promise<void>;
};
const key = "00000000-0000-0000-0000-000000000001/00000000-0000-0000-0000-000000000002.jpg";

beforeAll(async () => {
  const bundled = await build({
    stdin: {
      resolveDir: fileURLToPath(new URL(".", import.meta.url)),
      contents: `
        import { Readable } from 'node:stream';
        import { PUT } from './route.ts';
        export default { async fetch(request, env) {
          const mode = new URL(request.url).pathname;
          let cancelled = false;
          const bytes = Buffer.from(await request.arrayBuffer());
          // Same conversion as OpenNext's Node request and CustomRequest wrapper.
          const nodeBody = new Readable({ read() { this.push(bytes); this.push(null); } });
          const body = mode === '/reject' ? new ReadableStream({
            start(controller) { controller.enqueue(bytes); },
            cancel() { cancelled = true; }
          }) : ReadableStream.from(nodeBody);
          const headers = new Headers(request.headers);
          headers.set('content-length', headers.get('x-test-length') || String(bytes.length));
          const adapted = new Request(request.url, { method: 'PUT', headers, body, duplex: 'half' });
          globalThis.__testContext = { env: {
            MEDIA: mode === '/reject' ? { async put() { throw new Error('R2 rejected write'); } } : env.MEDIA,
            MEDIA_PUBLIC_URL: 'https://media.example.test'
          }};
          if (mode === '/baseline') {
            try { await env.MEDIA.put('baseline', adapted.body); return Response.json({ ok: true }); }
            catch(error) { return Response.json({ error: error.message }, { status: 500 }); }
          }
          const response = await PUT(adapted);
          response.headers.set('x-test-cancelled', String(cancelled));
          if (response.ok) {
            const stored = await env.MEDIA.get(new URL(request.url).searchParams.get('key'));
            response.headers.set('x-test-stored-size', String(stored.size));
          }
          return response;
        }};
      `,
    },
    bundle: true,
    write: false,
    format: "esm",
    platform: "neutral",
    external: ["node:*"],
    plugins: [{
      name: "offline-auth-and-context",
      setup(builder: StubBuilder) {
        builder.onResolve({ filter: /^(@supabase\/supabase-js|@opennextjs\/cloudflare|@\/lib\/)/ }, (args) => ({ path: args.path, namespace: "test-stub" }));
        builder.onLoad({ filter: /.*/, namespace: "test-stub" }, ({ path }) => ({ contents:
          path === "@opennextjs/cloudflare" ? "export const getCloudflareContext = () => globalThis.__testContext;" :
          path === "@/lib/env" ? "export const env = { NEXT_PUBLIC_SUPABASE_URL: 'https://example.test', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test' };" :
          "export const createClient = () => ({ rpc: async () => ({data: true}) });",
        }));
      },
    }],
  });
  runtime = new Miniflare(convertV4MiniflareOptions({ workers: [{
    name: "media-regression",
    modules: true,
    compatibilityDate: "2026-11-01",
    compatibilityFlags: ["nodejs_compat"],
    r2Buckets: ["MEDIA"],
    script: bundled.outputFiles[0].text,
  }] }));
}, 20000);

afterAll(async () => { await runtime?.dispose(); });

async function upload(mode: string, declaredLength = 1024) {
  return runtime.dispatchFetch(`https://local.test/${mode}?key=${key}`, {
    method: "PUT",
    headers: { "content-type": "image/jpeg", "x-test-length": String(declaredLength) },
    body: Buffer.alloc(1024, 1),
  });
}

describe("R2 uploads after OpenNext request conversion", () => {
  it("retains the failing baseline: a reconstructed stream has no R2 length metadata", async () => {
    const response = await upload("baseline");
    expect(response.status).toBe(500);
    expect(await response.text()).toContain("Provided readable stream must have a known length");
  });

  it("streams the reconstructed body into R2 and returns the public URL", async () => {
    const response = await upload("success");
    expect(response.status).toBe(200);
    expect(response.headers.get("x-test-stored-size")).toBe("1024");
    expect(await response.json()).toEqual({ url: `https://media.example.test/${key}` });
  });

  it.each([512, 2048])("fails cleanly when declared length %i differs from actual length", async (length) => {
    const response = await upload("mismatch", length);
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "Video storage upload failed. Please retry." });
  });

  it("cancels a pending incoming stream when R2 rejects without consuming it", async () => {
    const response = await upload("reject");
    expect(response.status).toBe(502);
    expect(response.headers.get("x-test-cancelled")).toBe("true");
  }, 3000);
});
