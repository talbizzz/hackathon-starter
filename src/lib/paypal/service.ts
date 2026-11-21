import { PAID_PLAN } from "@/lib/paid-plan";
import { PaymentError, type Mode, type PaymentProvider, type PaymentStore, type PayPalOrder, type Receipt, type WebhookEvent } from "./types";
const validId = (id: unknown): id is string => typeof id === "string" && /^[A-Za-z0-9-]{1,80}$/.test(id);

export function validateOrder(order: PayPalOrder, receipt: Receipt, merchantId: string) {
  const unit = order.purchase_units?.[0];
  const item = unit?.items?.[0];
  if (order.id !== receipt.order_id || order.intent !== "CAPTURE" || order.purchase_units?.length !== 1 ||
    receipt.product_id !== PAID_PLAN.id || receipt.merchant_id !== merchantId || unit?.payee?.merchant_id !== merchantId ||
    unit.reference_id !== PAID_PLAN.id || unit.custom_id !== receipt.id ||
    unit.amount?.currency_code !== PAID_PLAN.currency || unit.amount?.value !== PAID_PLAN.amount ||
    unit.items?.length !== 1 || item?.sku !== PAID_PLAN.id || item.quantity !== "1" || item.category !== "DIGITAL_GOODS" ||
    item.unit_amount?.currency_code !== PAID_PLAN.currency || item.unit_amount?.value !== PAID_PLAN.amount) {
    throw new PaymentError("PAYMENT_MISMATCH", 409);
  }
  return unit;
}
export function paymentService(store: PaymentStore, provider: PaymentProvider, mode: Mode, merchantId: string) {
  async function capture(userId: string, orderId: string) {
    if (!validId(orderId)) throw new PaymentError("INVALID_ORDER", 400);
    const receipt = await store.find(orderId, mode);
    if (!receipt || receipt.user_id !== userId) throw new PaymentError("ORDER_NOT_FOUND", 404);
    if (receipt.status === "FAILED") return { status: "FAILED", entitled: await store.entitled(userId, mode) };
    if (receipt.status === "REVOKED") return { status: "REVOKED", entitled: await store.entitled(userId, mode) };
    let order = await provider.order(orderId);
    validateOrder(order, receipt, merchantId);
    if (order.status === "APPROVED") {
      if (await store.entitled(userId, mode)) return { status: "COMPLETED", entitled: true };
      if (!await store.claim(receipt)) throw new PaymentError("RECOVER_PREVIOUS_ORDER", 409);
      try { order = await provider.capture(orderId, `${receipt.id}-capture`); }
      catch {
        // Capture may have succeeded before the response was lost. GET, never invent success.
        order = await provider.order(orderId);
      }
    }
    const unit = validateOrder(order, receipt, merchantId);
    const captures = unit.payments?.captures ?? [];
    if (captures.length > 1) throw new PaymentError("PAYMENT_MISMATCH", 409);
    const payment = captures[0];
    if (payment && (!validId(payment.id) || payment.amount?.currency_code !== PAID_PLAN.currency || payment.amount?.value !== PAID_PLAN.amount)) throw new PaymentError("PAYMENT_MISMATCH", 409);
    if (payment && ["REFUNDED", "PARTIALLY_REFUNDED", "REVERSED"].includes(payment.status)) {
      await store.apply(receipt, payment.id, "REVOKED");
      return { status: "REVOKED", entitled: await store.entitled(userId, mode) };
    }
    if (order.status === "VOIDED" || (payment && ["DECLINED", "DENIED", "FAILED"].includes(payment.status))) {
      await store.retire(receipt);
      return { status: "FAILED", entitled: await store.entitled(userId, mode) };
    }
    if (order.status !== "COMPLETED" || payment?.status !== "COMPLETED" || payment.final_capture !== true) return { status: "PENDING", entitled: false };
    const status = await store.apply(receipt, payment.id, "COMPLETED");
    return { status, entitled: await store.entitled(userId, mode) };
  }
  return {
    capture,
    async create(userId: string) {
      if (await store.entitled(userId, mode)) return { entitled: true as const };
      let receipt = await store.reserve(userId, mode, merchantId);
      let order = receipt.order_id ? await provider.order(receipt.order_id) : await provider.create(receipt);
      if (order.status === "VOIDED") {
        validateOrder(order, receipt, merchantId);
        await store.retire(receipt);
        receipt = await store.reserve(userId, mode, merchantId);
        order = receipt.order_id ? await provider.order(receipt.order_id) : await provider.create(receipt);
      }
      if (!validId(order.id)) throw new PaymentError("PAYPAL_UNAVAILABLE");
      validateOrder(order, { ...receipt, order_id: order.id }, merchantId);
      if (!receipt.order_id) {
        await store.attach(receipt.id, order.id);
        receipt = { ...receipt, order_id: order.id };
      }
      if (order.status === "COMPLETED") {
        const result = await capture(userId, order.id);
        if (result.entitled) return { entitled: true };
        throw new PaymentError("RECOVER_PREVIOUS_ORDER", 409);
      }
      if (order.status === "APPROVED") return { orderId: order.id, approved: true as const };
      const link = order.links?.find(link => link.rel === "payer-action" || link.rel === "approve");
      let url: URL;
      try { url = new URL(link?.href ?? ""); } catch { throw new PaymentError("PAYPAL_UNAVAILABLE"); }
      if (url.protocol !== "https:" || url.hostname !== (mode === "live" ? "www.paypal.com" : "www.sandbox.paypal.com")) throw new PaymentError("PAYPAL_UNAVAILABLE");
      return { orderId: order.id, approvalUrl: url.href };
    },
    async webhook(headers: Headers, event: WebhookEvent) {
      if (!await provider.verify(headers, event)) throw new PaymentError("INVALID_SIGNATURE", 400);
      if (!validId(event.id) || !event.resource || typeof event.event_type !== "string") throw new PaymentError("INVALID_EVENT", 400);
      const revoked = ["PAYMENT.CAPTURE.REFUNDED", "PAYMENT.CAPTURE.REVERSED"].includes(event.event_type);
      if (!revoked && event.event_type !== "PAYMENT.CAPTURE.COMPLETED") return;
      let orderId = event.resource.supplementary_data?.related_ids?.order_id;
      let captureId = event.event_type === "PAYMENT.CAPTURE.REFUNDED" ? event.resource.supplementary_data?.related_ids?.capture_id : event.resource.id;
      if (!captureId && event.event_type === "PAYMENT.CAPTURE.REFUNDED") {
        const up = event.resource.links?.find(link => link.rel === "up")?.href;
        // Extract only the capture ID, never fetch an event-provided URL.
        const match = up?.match(/^https:\/\/api(?:-m)?\.(?:sandbox\.)?paypal\.com\/v2\/payments\/captures\/([A-Za-z0-9-]+)$/);
        captureId = match?.[1];
      }
      if (!validId(captureId)) throw new PaymentError("INVALID_EVENT", 400);
      if (!orderId) orderId = (await provider.captureDetails(captureId)).supplementary_data?.related_ids?.order_id;
      if (!validId(orderId)) throw new PaymentError("INVALID_EVENT", 400);
      const receipt = await store.find(orderId, mode);
      if (!receipt) throw new PaymentError("ORDER_NOT_FOUND", 503); // Retry if creation persistence is recovering.
      const order = await provider.order(orderId);
      const unit = validateOrder(order, receipt, merchantId);
      const payment = unit.payments?.captures?.find(c => c.id === captureId);
      if (!payment || payment.amount?.currency_code !== PAID_PLAN.currency || payment.amount?.value !== PAID_PLAN.amount) throw new PaymentError("PAYMENT_MISMATCH", 409);
      if (revoked) {
        await store.apply(receipt, captureId, "REVOKED", event.id);
      } else if (order.status === "COMPLETED" && payment.status === "COMPLETED" && payment.final_capture === true) {
        await store.apply(receipt, captureId, "COMPLETED", event.id);
      } else if (["REFUNDED", "PARTIALLY_REFUNDED", "REVERSED"].includes(payment.status)) {
        await store.apply(receipt, captureId, "REVOKED", event.id);
      }
    },
  };
}
