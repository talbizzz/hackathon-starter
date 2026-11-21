import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { paypalProvider } from "./provider";
import { paymentConfig, type PayPalConfig } from "./config";
import type { Receipt } from "./types";
const config: PayPalConfig = { mode: "sandbox", clientId: "test-client", secret: "test-secret", merchantId: "MERCHANT", webhookId: "WEBHOOK", siteOrigin: "http://localhost:3000", supabaseUrl: "http://localhost:54321", serviceKey: "test-service", salesEnabled: false };
const r: Receipt = { id: "receipt-1", user_id: "user-1", product_id: "kreuzberg-sunday", mode: "sandbox", merchant_id: "MERCHANT", status: "CREATED", order_id: null, capture_id: null };
const response = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
beforeEach(() => vi.unstubAllEnvs());
describe("PayPal transport", () => {
  it("creates the fixed digital item with stable key and server-owned return URLs", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(response({ access_token: "test-token" })).mockResolvedValue(response({ id: "ORDER1" }));
    await paypalProvider(config, fetcher).create(r);
    const [url, init] = fetcher.mock.calls[1];
    expect(url).toBe("https://api-m.sandbox.paypal.com/v2/checkout/orders");
    expect(init?.headers).toMatchObject({ Authorization: "Bearer test-token", "PayPal-Request-Id": "receipt-1" });
    expect(init?.signal).toBeInstanceOf(AbortSignal); expect(init?.redirect).toBe("error");
    const body = JSON.parse(init!.body as string);
    expect(body.purchase_units[0]).toMatchObject({ custom_id: r.id, payee: { merchant_id: "MERCHANT" }, amount: { value: "3.99", currency_code: "EUR" }, items: [{ sku: "kreuzberg-sunday", category: "DIGITAL_GOODS", quantity: "1" }] });
    expect(body.payment_source.paypal.experience_context).toMatchObject({ return_url: "http://localhost:3000/plans/kreuzberg-sunday?checkout=return", cancel_url: "http://localhost:3000/plans/kreuzberg-sunday?checkout=cancel" });
  });
  it("uses live origin only for explicit live mode", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(response({ access_token: "t" })).mockResolvedValue(response({}));
    await paypalProvider({ ...config, mode: "live" }, fetcher).order("ORDER1");
    expect(fetcher.mock.calls[1][0]).toBe("https://api-m.paypal.com/v2/checkout/orders/ORDER1");
  });
  it("fails safely on timeout without exposing provider details", async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new Error("sensitive timeout"));
    await expect(paypalProvider(config, fetcher).order("ORDER1")).rejects.toMatchObject({ code: "PAYPAL_UNAVAILABLE" });
  });
  it("fails closed on failed token response", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response({ secret: "never echo" }, 401));
    await expect(paypalProvider(config, fetcher).order("ORDER1")).rejects.toMatchObject({ code: "PAYPAL_UNAVAILABLE" });
  });
  it("sends all signature fields and configured webhook ID to PayPal", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(response({ access_token: "t" })).mockResolvedValue(response({ verification_status: "SUCCESS" }));
    const headers = new Headers({ "paypal-auth-algo": "SHA256withRSA", "paypal-cert-url": "https://api.paypal.com/cert", "paypal-transmission-id": "transmission", "paypal-transmission-sig": "signature", "paypal-transmission-time": "2026-11-21T00:00:00Z" });
    const event = { id: "WH-1", event_type: "PAYMENT.CAPTURE.COMPLETED", resource: { id: "CAP1", status: "COMPLETED" } };
    expect(await paypalProvider(config, fetcher).verify(headers, event)).toBe(true);
    expect(JSON.parse(fetcher.mock.calls[1][1]!.body as string)).toEqual({ auth_algo: "SHA256withRSA", cert_url: "https://api.paypal.com/cert", transmission_id: "transmission", transmission_sig: "signature", transmission_time: "2026-11-21T00:00:00Z", webhook_id: "WEBHOOK", webhook_event: event });
  });
  it("rejects missing signature headers without making a provider call", async () => {
    const fetcher = vi.fn<typeof fetch>();
    expect(await paypalProvider(config, fetcher).verify(new Headers(), { id: "WH-1", event_type: "other", resource: { id: "CAP1", status: "COMPLETED" } })).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
describe("payment configuration", () => {
  it("fails closed without complete config and defaults sales off", () => {
    vi.stubEnv("PAYPAL_ENV", ""); expect(paymentConfig()).toBeNull();
    for (const [key, value] of Object.entries({ PAYPAL_ENV: "sandbox", PAYPAL_CLIENT_ID: "c", PAYPAL_CLIENT_SECRET: "s", PAYPAL_MERCHANT_ID: "m", PAYPAL_WEBHOOK_ID: "w", NEXT_PUBLIC_SITE_URL: "http://localhost:3000", NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321", SUPABASE_SERVICE_ROLE_KEY: "s", PAID_PLAN_SALES_ENABLED: "false" })) vi.stubEnv(key, value);
    expect(paymentConfig()).toMatchObject({ salesEnabled: false, mode: "sandbox" });
    vi.stubEnv("PAYPAL_ENV", "live"); expect(paymentConfig()).toBeNull();
    vi.stubEnv("PAYPAL_ENV", "sandbox"); vi.stubEnv("PAYPAL_WEBHOOK_ID", ""); expect(paymentConfig()).toBeNull();
  });
});
