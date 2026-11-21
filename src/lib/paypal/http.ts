import "server-only";
import { createClient } from "@/lib/supabase/server";
import { paymentConfig } from "./config";
import { paymentStore } from "./store";
import { paypalProvider } from "./provider";
import { paymentService } from "./service";
import { PaymentError } from "./types";
export function json(value: unknown, status = 200) {
  return Response.json(value, { status, headers: { "Cache-Control": "private, no-store, max-age=0", Vary: "Cookie", "X-Content-Type-Options": "nosniff" } });
}
export async function respond(action: () => Promise<Response>) {
  try { return await action(); }
  catch (error) {
    if (error instanceof PaymentError) return json({ error: error.code }, error.status);
    // Never echo provider payloads, credentials or database errors.
    console.error("Payment request failed", { kind: error instanceof Error ? error.name : "unknown" });
    return json({ error: "PAYMENT_UNAVAILABLE" }, 503);
  }
}
export function context() {
  const config = paymentConfig();
  if (!config) throw new PaymentError("PAYMENTS_NOT_CONFIGURED");
  const store = paymentStore(config);
  return { config, store, service: paymentService(store, paypalProvider(config), config.mode, config.merchantId) };
}
export async function buyer() {
  const { data, error } = await (await createClient()).auth.getUser();
  if (error || !data.user || data.user.is_anonymous) throw new PaymentError("AUTH_REQUIRED", 401);
  return data.user.id;
}
export function sameOrigin(request: Request) {
  let origin: string;
  try { origin = new URL(process.env.NEXT_PUBLIC_SITE_URL!).origin; }
  catch { throw new PaymentError("PAYMENTS_NOT_CONFIGURED"); }
  if (request.headers.get("origin") !== origin || request.headers.get("sec-fetch-site") === "cross-site") throw new PaymentError("INVALID_ORIGIN", 403);
}

export async function body(request: Request, maxBytes = 4096): Promise<unknown> {
  // Bound actual streamed bytes; Content-Length alone is untrusted/optional.
  try {
    if (Number(request.headers.get("content-length")) > maxBytes) throw new PaymentError("REQUEST_TOO_LARGE", 413);
    const reader = request.body?.getReader();
    if (!reader) throw new PaymentError("INVALID_REQUEST", 400);
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) { await reader.cancel(); throw new PaymentError("REQUEST_TOO_LARGE", 413); }
      chunks.push(value);
    }
    const combined = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { combined.set(chunk, offset); offset += chunk.length; }
    return JSON.parse(new TextDecoder().decode(combined));
  } catch (error) {
    if (error instanceof PaymentError) throw error;
    throw new PaymentError("INVALID_REQUEST", 400);
  }
}
