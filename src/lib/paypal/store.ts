import "server-only";
import { createClient } from "@supabase/supabase-js";
import { PAID_PLAN } from "@/lib/paid-plan";
import type { PayPalConfig } from "./config";
import { PaymentError, type PaymentStore, type Receipt } from "./types";
// Payment schema intentionally separate from generated application types until migration is deployed.
type PaymentDatabase = {
  public: {
    Tables: {
      paid_plan_receipts: { Row: Receipt & { created_at: string }; Insert: { user_id: string; mode: string; merchant_id: string; product_id: string }; Update: { order_id?: string; reusable_until?: string }; Relationships: [] };
    };
    Views: Record<string, never>;
    Functions: {
      reserve_paid_plan_order: { Args: { p_user_id: string; p_mode: string; p_merchant_id: string }; Returns: Receipt };
      latest_paid_plan_order: { Args: { p_user_id: string; p_mode: string }; Returns: Receipt | null };
      retire_paid_plan_order: { Args: { p_receipt_id: string }; Returns: undefined };
      claim_paid_plan_capture: { Args: { p_order_id: string; p_mode: string }; Returns: boolean };
      apply_paid_plan_payment: { Args: { p_order_id: string; p_mode: string; p_capture_id: string; p_status: string; p_event_id: string | null }; Returns: Receipt["status"] } };
  };
};
export function paymentStore(config: PayPalConfig): PaymentStore {
  const db = createClient<PaymentDatabase>(config.supabaseUrl, config.serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(8_000), cache: "no-store" }) },
  });
  const check = (error: unknown) => { if (error) throw new PaymentError("PAYMENT_STORAGE_UNAVAILABLE"); };
  return {
    async entitled(userId, mode) {
      const { data, error } = await db.from("paid_plan_receipts").select("id").eq("user_id", userId).eq("mode", mode).eq("product_id", PAID_PLAN.id).eq("status", "COMPLETED").limit(1);
      check(error); return !!data?.length;
    },
    async latest(userId, mode) {
      const { data, error } = await db.rpc("latest_paid_plan_order", { p_user_id: userId, p_mode: mode });
      check(error); return data?.id ? data : null;
    },
    async reserve(userId, mode, merchantId) {
      const { data, error } = await db.rpc("reserve_paid_plan_order", { p_user_id: userId, p_mode: mode, p_merchant_id: merchantId });
      check(error); if (!data) throw new PaymentError("PAYMENT_STORAGE_UNAVAILABLE"); return data;
    },
    async retire(receipt) {
      const { error } = await db.rpc("retire_paid_plan_order", { p_receipt_id: receipt.id });
      check(error);
    },
    async claim(receipt) {
      const { data, error } = await db.rpc("claim_paid_plan_capture", { p_order_id: receipt.order_id!, p_mode: receipt.mode });
      check(error); return data === true;
    },
    async attach(id, orderId) {
      const { data, error } = await db.from("paid_plan_receipts").update({ order_id: orderId }).eq("id", id).is("order_id", null).select("id").single();
      check(error); if (!data) throw new PaymentError("PAYMENT_STORAGE_UNAVAILABLE");
    },
    async find(orderId, mode) {
      const { data, error } = await db.from("paid_plan_receipts").select("*").eq("order_id", orderId).eq("mode", mode).maybeSingle();
      check(error); return data;
    },
    async apply(receipt, captureId, status, eventId) {
      const { data, error } = await db.rpc("apply_paid_plan_payment", { p_order_id: receipt.order_id!, p_mode: receipt.mode, p_capture_id: captureId, p_status: status, p_event_id: eventId ?? null });
      check(error); if (!data) throw new PaymentError("PAYMENT_STORAGE_UNAVAILABLE"); return data;
    },
  };
}
