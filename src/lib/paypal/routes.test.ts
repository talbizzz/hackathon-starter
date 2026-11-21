import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), config: vi.fn(), entitled: vi.fn(), latest: vi.fn(), create: vi.fn(), capture: vi.fn(), webhook: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser: mocks.getUser } }) }));
vi.mock("./config", () => ({ paymentConfig: mocks.config }));
vi.mock("./store", () => ({ paymentStore: () => ({ entitled: mocks.entitled, latest: mocks.latest }) }));
vi.mock("./provider", () => ({ paypalProvider: () => ({}) }));
vi.mock("./service", () => ({ paymentService: () => ({ create: mocks.create, capture: mocks.capture, webhook: mocks.webhook }) }));
import { GET as status } from "@/app/api/paypal/status/route";
import { GET as plan } from "@/app/api/paypal/plan/route";
import { POST as orders } from "@/app/api/paypal/orders/route";
import { POST as capture } from "@/app/api/paypal/capture/route";
import { POST as webhook } from "@/app/api/paypal/webhook/route";
import { PaymentError } from "./types";
const post = (path: string, value?: unknown, origin = "http://localhost:3000") => new Request(`http://localhost:3000/api/paypal/${path}`, { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, ...(value !== undefined ? { body: JSON.stringify(value) } : {}) });
beforeEach(() => {
  vi.resetAllMocks(); vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
  mocks.getUser.mockResolvedValue({ data: { user: { id: "buyer" } }, error: null });
  mocks.config.mockReturnValue({ mode: "sandbox", salesEnabled: true });
  mocks.entitled.mockResolvedValue(false); mocks.latest.mockResolvedValue(null);
});
describe("account-bound payment routes", () => {
  it("requires durable authentication for status, capture and content", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect((await status()).status).toBe(401); expect((await plan()).status).toBe(401); expect((await capture(post("capture", { orderId: "ORDER1" }))).status).toBe(401);
    expect(mocks.capture).not.toHaveBeenCalled();
  });
  it("rejects anonymous Supabase users", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "anon", is_anonymous: true } }, error: null });
    expect((await orders(post("orders"))).status).toBe(401);
  });
  it("reports unconfigured checkout safely", async () => {
    mocks.config.mockReturnValue(null);
    expect(await (await status()).json()).toEqual({ configured: false, mode: null, entitled: false, checkoutReady: false });
    expect((await orders(post("orders"))).status).toBe(503);
  });
  it("pauses sales without blocking paid content", async () => {
    mocks.config.mockReturnValue({ mode: "sandbox", salesEnabled: false }); mocks.entitled.mockResolvedValue(true);
    expect((await orders(post("orders"))).status).toBe(503); expect((await plan()).status).toBe(200);
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("never serves full content before entitlement", async () => {
    const response = await plan(); expect(response.status).toBe(403); expect(await response.json()).toEqual({ error: "PAYMENT_REQUIRED" });
  });
  it("makes protected responses private and uncacheable", async () => {
    mocks.entitled.mockResolvedValue(true); const response = await plan();
    expect(response.headers.get("cache-control")).toContain("no-store"); expect(response.headers.get("vary")).toBe("Cookie");
    expect(await response.json()).toHaveProperty("steps");
  });
  it("rejects cross-origin order and capture requests", async () => {
    expect((await orders(post("orders", undefined, "https://attacker.test"))).status).toBe(403);
    expect((await capture(post("capture", { orderId: "ORDER1" }, "https://attacker.test"))).status).toBe(403);
    expect(mocks.create).not.toHaveBeenCalled(); expect(mocks.capture).not.toHaveBeenCalled();
  });
  it("never forwards submitted price/product flags into order creation", async () => {
    mocks.create.mockResolvedValue({ orderId: "ORDER1", approvalUrl: "https://www.sandbox.paypal.com" });
    expect((await orders(post("orders", { amount: "0.01", paid: true, product: "other" }))).status).toBe(200);
    expect(mocks.create).toHaveBeenCalledExactlyOnceWith("buyer");
  });
  it("bounds capture JSON by actual bytes", async () => {
    expect((await capture(post("capture", { orderId: "a".repeat(5000) }))).status).toBe(413);
    expect(mocks.capture).not.toHaveBeenCalled();
  });
  it("fails closed on invalid webhook signatures", async () => {
    mocks.webhook.mockRejectedValue(new PaymentError("INVALID_SIGNATURE", 400));
    expect((await webhook(post("webhook", { id: "WH-1" }))).status).toBe(400);
  });
  it("exposes only current buyer receipt reference on status", async () => {
    mocks.latest.mockResolvedValue({ order_id: "ORDER1", status: "CREATED", capture_id: "PRIVATE", merchant_id: "PRIVATE" });
    expect(await (await status()).json()).toEqual({ configured: true, mode: "sandbox", checkoutReady: true, entitled: false, latestOrder: { orderId: "ORDER1", status: "CREATED" } });
    expect(mocks.latest).toHaveBeenCalledWith("buyer", "sandbox");
  });
});
