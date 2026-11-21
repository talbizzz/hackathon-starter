import { describe, expect, it, vi } from "vitest";
import { paymentService } from "./service";
import type { PaymentProvider, PaymentStore, PayPalOrder, Receipt, WebhookEvent } from "./types";

const receipt = (): Receipt => ({ id: "receipt-1", user_id: "buyer-1", product_id: "kreuzberg-sunday", mode: "sandbox", merchant_id: "MERCHANT", order_id: "ORDER1", capture_id: null, status: "CREATED" });
const order = (status = "COMPLETED", captureStatus = "COMPLETED"): PayPalOrder => ({ id: "ORDER1", intent: "CAPTURE", status, purchase_units: [{ reference_id: "kreuzberg-sunday", custom_id: "receipt-1", payee: { merchant_id: "MERCHANT" }, amount: { currency_code: "EUR", value: "3.99" }, items: [{ sku: "kreuzberg-sunday", quantity: "1", category: "DIGITAL_GOODS", unit_amount: { currency_code: "EUR", value: "3.99" } }], payments: { captures: [{ id: "CAPTURE1", status: captureStatus, final_capture: true, amount: { currency_code: "EUR", value: "3.99" } }] } }], links: [{ rel: "payer-action", href: "https://www.sandbox.paypal.com/checkoutnow?token=ORDER1" }] });
function setup() {
  const r = receipt();
  const store: PaymentStore = {
    entitled: vi.fn(async () => r.status === "COMPLETED"), latest: vi.fn(async () => r), reserve: vi.fn(async () => r), retire: vi.fn(async () => {}), claim: vi.fn(async () => true), attach: vi.fn(async () => {}), find: vi.fn(async () => r),
    apply: vi.fn(async (_receipt, captureId, status) => { if (r.status !== "REVOKED") { r.status = status; r.capture_id = captureId; } return r.status; }),
  };
  const provider: PaymentProvider = { create: vi.fn(async () => order("CREATED")), order: vi.fn(async () => order()), capture: vi.fn(async () => order()), captureDetails: vi.fn(async () => ({ id: "CAPTURE1", status: "REFUNDED", supplementary_data: { related_ids: { order_id: "ORDER1" } } })), verify: vi.fn(async () => true) };
  return { r, store, provider, service: paymentService(store, provider, "sandbox", "MERCHANT") };
}
const event = (type = "PAYMENT.CAPTURE.COMPLETED"): WebhookEvent => ({ id: "WH-event-1", event_type: type, resource: { id: "CAPTURE1", status: "COMPLETED", supplementary_data: { related_ids: { order_id: "ORDER1" } } } });

describe("secure paid plan service", () => {
  it("unlocks only a validated completed final capture", async () => {
    const { service, store } = setup();
    expect(await service.capture("buyer-1", "ORDER1")).toEqual({ status: "COMPLETED", entitled: true });
    expect(store.apply).toHaveBeenCalledWith(expect.anything(), "CAPTURE1", "COMPLETED");
  });
  it("does not expose or capture another account's order", async () => {
    const { service, provider, store } = setup();
    await expect(service.capture("attacker", "ORDER1")).rejects.toMatchObject({ code: "ORDER_NOT_FOUND" });
    expect(provider.order).not.toHaveBeenCalled(); expect(store.apply).not.toHaveBeenCalled();
  });
  it.each([
    ["amount", (o: PayPalOrder) => { o.purchase_units[0].amount!.value = "0.01"; }],
    ["currency", (o: PayPalOrder) => { o.purchase_units[0].amount!.currency_code = "USD"; }],
    ["merchant", (o: PayPalOrder) => { o.purchase_units[0].payee!.merchant_id = "ATTACKER"; }],
    ["product", (o: PayPalOrder) => { o.purchase_units[0].items![0].sku = "other"; }],
    ["receipt", (o: PayPalOrder) => { o.purchase_units[0].custom_id = "other-buyer-receipt"; }],
    ["order", (o: PayPalOrder) => { o.id = "OTHER"; }],
    ["capture amount", (o: PayPalOrder) => { o.purchase_units[0].payments!.captures![0].amount!.value = "0.01"; }],
    ["multiple units", (o: PayPalOrder) => { o.purchase_units.push(o.purchase_units[0]); }],
  ])("rejects mismatched %s", async (_label, mutate) => {
    const { service, provider, store } = setup(); const value = order(); mutate(value);
    vi.mocked(provider.order).mockResolvedValue(value);
    await expect(service.capture("buyer-1", "ORDER1")).rejects.toMatchObject({ code: "PAYMENT_MISMATCH" });
    expect(store.apply).not.toHaveBeenCalled();
  });
  it.each([["CREATED", "PENDING"], ["COMPLETED", "PENDING"]])("never unlocks %s / %s", async (status, captured) => {
    const { service, provider, store } = setup(); vi.mocked(provider.order).mockResolvedValue(order(status, captured));
    expect(await service.capture("buyer-1", "ORDER1")).toEqual({ status: "PENDING", entitled: false });
    expect(store.apply).not.toHaveBeenCalled();
  });
  it("recovers from capture timeout with a second provider lookup and stable idempotency key", async () => {
    const { service, provider, store } = setup();
    vi.mocked(provider.order).mockResolvedValueOnce(order("APPROVED")).mockResolvedValue(order());
    vi.mocked(provider.capture).mockRejectedValueOnce(new Error("timeout after capture"));
    expect(await service.capture("buyer-1", "ORDER1")).toEqual({ status: "COMPLETED", entitled: true });
    expect(provider.capture).toHaveBeenCalledExactlyOnceWith("ORDER1", "receipt-1-capture");
    expect(store.apply).toHaveBeenCalledTimes(1);
  });
  it("recovers database outage after provider capture without recapturing", async () => {
    const { service, provider, store } = setup();
    vi.mocked(provider.order).mockResolvedValueOnce(order("APPROVED")).mockResolvedValue(order());
    vi.mocked(store.apply).mockRejectedValueOnce(new Error("database offline"));
    await expect(service.capture("buyer-1", "ORDER1")).rejects.toThrow("database offline");
    expect(await service.capture("buyer-1", "ORDER1")).toMatchObject({ entitled: true });
    expect(provider.capture).toHaveBeenCalledTimes(1);
  });
  it("rejects unsigned webhooks before reading or writing a receipt", async () => {
    const { service, provider, store } = setup(); vi.mocked(provider.verify).mockResolvedValue(false);
    await expect(service.webhook(new Headers(), event())).rejects.toMatchObject({ code: "INVALID_SIGNATURE" });
    expect(store.find).not.toHaveBeenCalled(); expect(store.apply).not.toHaveBeenCalled();
  });
  it("never resurrects after a reversal, even if an older completion arrives later", async () => {
    const { service, r } = setup();
    await service.webhook(new Headers(), event("PAYMENT.CAPTURE.REVERSED"));
    expect(r.status).toBe("REVOKED");
    await service.webhook(new Headers(), { ...event(), id: "WH-older-completion" });
    expect(r.status).toBe("REVOKED");
    expect(await service.capture("buyer-1", "ORDER1")).toMatchObject({ status: "REVOKED", entitled: false });
  });
  it("resolves refund capture via approved PayPal link without fetching the link", async () => {
    const { service, r, provider } = setup();
    const refund = event("PAYMENT.CAPTURE.REFUNDED");
    refund.resource = { id: "REFUND1", status: "COMPLETED", links: [{ rel: "up", href: "https://api.sandbox.paypal.com/v2/payments/captures/CAPTURE1" }] };
    await service.webhook(new Headers(), refund);
    expect(provider.captureDetails).toHaveBeenCalledWith("CAPTURE1"); expect(r.status).toBe("REVOKED");
  });
  it("rejects attacker-controlled refund lookup URLs", async () => {
    const { service, provider } = setup(); const refund = event("PAYMENT.CAPTURE.REFUNDED");
    refund.resource = { id: "REFUND1", status: "COMPLETED", links: [{ rel: "up", href: "http://localhost/private" }] };
    await expect(service.webhook(new Headers(), refund)).rejects.toMatchObject({ code: "INVALID_EVENT" });
    expect(provider.captureDetails).not.toHaveBeenCalled();
  });
  it("does not grant on a completion webhook when capture remains pending", async () => {
    const { service, provider, store } = setup(); vi.mocked(provider.order).mockResolvedValue(order("COMPLETED", "PENDING"));
    await service.webhook(new Headers(), event()); expect(store.apply).not.toHaveBeenCalled();
  });
  it("retries webhooks for temporarily missing order persistence", async () => {
    const { service, store } = setup(); vi.mocked(store.find).mockResolvedValue(null);
    await expect(service.webhook(new Headers(), event())).rejects.toMatchObject({ status: 503 });
  });
  it("only returns an approved PayPal redirect after durable ownership attachment", async () => {
    const { service, store, provider, r } = setup();
    vi.mocked(provider.order).mockResolvedValue(order("CREATED"));
    expect(await service.create("buyer-1")).toEqual({ orderId: "ORDER1", approvalUrl: "https://www.sandbox.paypal.com/checkoutnow?token=ORDER1" });
    expect(store.attach).not.toHaveBeenCalled();
    r.order_id = null;
    vi.mocked(store.attach).mockRejectedValue(new Error("offline")); await expect(service.create("buyer-1")).rejects.toThrow("offline");
  });
  it("reuses the same active checkout without creating another order", async () => {
    const { service, provider } = setup(); vi.mocked(provider.order).mockResolvedValue(order("CREATED"));
    const first = await service.create("buyer-1"); const second = await service.create("buyer-1");
    expect(first).toEqual(second); expect(provider.create).not.toHaveBeenCalled();
  });
  it("never creates a checkout for an already entitled buyer", async () => {
    const { service, provider, r } = setup(); r.status = "COMPLETED";
    expect(await service.create("buyer-1")).toEqual({ entitled: true }); expect(provider.create).not.toHaveBeenCalled();
  });
  it("never captures another approved order for an already entitled buyer", async () => {
    const { service, provider, store } = setup(); vi.mocked(provider.order).mockResolvedValue(order("APPROVED")); vi.mocked(store.entitled).mockResolvedValue(true);
    expect(await service.capture("buyer-1", "ORDER1")).toEqual({ status: "COMPLETED", entitled: true }); expect(provider.capture).not.toHaveBeenCalled();
  });
  it("blocks charging a different order while an earlier capture is unresolved", async () => {
    const { service, provider, store } = setup(); vi.mocked(provider.order).mockResolvedValue(order("APPROVED")); vi.mocked(store.claim).mockResolvedValue(false);
    await expect(service.capture("buyer-1", "ORDER1")).rejects.toMatchObject({ code: "RECOVER_PREVIOUS_ORDER" }); expect(provider.capture).not.toHaveBeenCalled();
  });
  it.each(["DECLINED", "DENIED", "FAILED"])("releases a terminal %s checkout for a safe new attempt", async status => {
    const { service, provider, store } = setup(); vi.mocked(provider.order).mockResolvedValue(order("COMPLETED", status));
    expect(await service.capture("buyer-1", "ORDER1")).toEqual({ status: "FAILED", entitled: false }); expect(store.retire).toHaveBeenCalledTimes(1); expect(store.apply).not.toHaveBeenCalled();
  });

  it("returns approved status only after ownership attachment, without a redirect", async () => {
    const { service, provider, store, r } = setup(); r.order_id = null;
    vi.mocked(provider.create).mockResolvedValue(order("APPROVED"));
    expect(await service.create("buyer-1")).toEqual({ orderId: "ORDER1", approved: true });
    expect(store.attach).toHaveBeenCalledExactlyOnceWith("receipt-1", "ORDER1");
  });

});
