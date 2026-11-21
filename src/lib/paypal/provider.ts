import "server-only";
import { PAID_PLAN } from "@/lib/paid-plan";
import type { PayPalConfig } from "./config";
import { PaymentError, type Capture, type PaymentProvider, type PayPalOrder, type Receipt, type WebhookEvent } from "./types";

/** Fixed PayPal origins: no environment override or webhook-controlled fetch URL. */
export function paypalProvider(config: PayPalConfig, fetcher: typeof fetch = fetch): PaymentProvider {
  const base = config.mode === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
  let token: string | undefined;
  async function raw(path: string, init: RequestInit) {
    try { return await fetcher(base + path, { ...init, cache: "no-store", signal: AbortSignal.timeout(10_000), redirect: "error" }); }
    catch { throw new PaymentError("PAYPAL_UNAVAILABLE"); }
  }
  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    if (!token) {
      const auth = await raw("/v1/oauth2/token", { method: "POST", headers: { Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.secret}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" }, body: "grant_type=client_credentials" });
      if (!auth.ok) throw new PaymentError("PAYPAL_UNAVAILABLE");
      const json = await auth.json();
      if (typeof json.access_token !== "string") throw new PaymentError("PAYPAL_UNAVAILABLE");
      token = json.access_token;
    }
    const response = await raw(path, { ...init, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Prefer: "return=representation", ...init.headers } });
    if (!response.ok) throw new PaymentError("PAYPAL_UNAVAILABLE");
    return response.json() as Promise<T>;
  }
  return {
    create: (receipt: Receipt) => request<PayPalOrder>("/v2/checkout/orders", { method: "POST", headers: { "PayPal-Request-Id": receipt.id }, body: JSON.stringify({
      intent: "CAPTURE", purchase_units: [{ reference_id: PAID_PLAN.id, custom_id: receipt.id, payee: { merchant_id: config.merchantId },
        amount: { currency_code: PAID_PLAN.currency, value: PAID_PLAN.amount, breakdown: { item_total: { currency_code: PAID_PLAN.currency, value: PAID_PLAN.amount } } },
        items: [{ name: PAID_PLAN.title, sku: PAID_PLAN.id, quantity: "1", category: "DIGITAL_GOODS", unit_amount: { currency_code: PAID_PLAN.currency, value: PAID_PLAN.amount } }],
      }], payment_source: { paypal: { experience_context: { shipping_preference: "NO_SHIPPING", user_action: "PAY_NOW", return_url: `${config.siteOrigin}/plans/${PAID_PLAN.id}?checkout=return`, cancel_url: `${config.siteOrigin}/plans/${PAID_PLAN.id}?checkout=cancel` } } },
    }) }),
    order: id => request<PayPalOrder>(`/v2/checkout/orders/${encodeURIComponent(id)}`),
    capture: (id, requestId) => request<PayPalOrder>(`/v2/checkout/orders/${encodeURIComponent(id)}/capture`, { method: "POST", headers: { "PayPal-Request-Id": requestId }, body: "{}" }),
    captureDetails: id => request<Capture>(`/v2/payments/captures/${encodeURIComponent(id)}`),
    async verify(headers: Headers, event: WebhookEvent) {
      const fields = ["paypal-auth-algo", "paypal-cert-url", "paypal-transmission-id", "paypal-transmission-sig", "paypal-transmission-time"];
      if (fields.some(key => !headers.get(key))) return false;
      const result = await request<{ verification_status: string }>("/v1/notifications/verify-webhook-signature", { method: "POST", body: JSON.stringify({ auth_algo: headers.get(fields[0]), cert_url: headers.get(fields[1]), transmission_id: headers.get(fields[2]), transmission_sig: headers.get(fields[3]), transmission_time: headers.get(fields[4]), webhook_id: config.webhookId, webhook_event: event }) });
      return result.verification_status === "SUCCESS";
    },
  };
}
