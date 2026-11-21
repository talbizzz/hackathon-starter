export type Mode = "sandbox" | "live";
export type Receipt = {
  id: string; user_id: string; product_id: string; mode: Mode; merchant_id: string;
  order_id: string | null; capture_id: string | null; status: "CREATED" | "COMPLETED" | "REVOKED" | "FAILED";
};
export type PayPalOrder = {
  id: string; status: string; intent?: string;
  purchase_units: Array<{
    reference_id?: string; custom_id?: string; payee?: { merchant_id?: string };
    amount?: { currency_code: string; value: string };
    items?: Array<{ sku?: string; quantity?: string; category?: string; unit_amount?: { currency_code: string; value: string } }>;
    payments?: { captures?: Capture[] };
  }>;
  links?: Array<{ rel: string; href: string }>;
};
export type Capture = {
  id: string; status: string; final_capture?: boolean;
  amount?: { currency_code: string; value: string };
  supplementary_data?: { related_ids?: { order_id?: string; capture_id?: string } };
};
export type WebhookEvent = {
  id: string; event_type: string;
  resource: Capture & { links?: Array<{ rel: string; href: string }> };
};
export interface PaymentStore {
  entitled(userId: string, mode: Mode): Promise<boolean>;
  latest(userId: string, mode: Mode): Promise<Receipt | null>;
  reserve(userId: string, mode: Mode, merchantId: string): Promise<Receipt>;
  retire(receipt: Receipt): Promise<void>;
  claim(receipt: Receipt): Promise<boolean>;
  attach(id: string, orderId: string): Promise<void>;
  find(orderId: string, mode: Mode): Promise<Receipt | null>;
  apply(receipt: Receipt, captureId: string, status: "COMPLETED" | "REVOKED", eventId?: string): Promise<Receipt["status"]>;
}
export interface PaymentProvider {
  create(receipt: Receipt): Promise<PayPalOrder>;
  order(orderId: string): Promise<PayPalOrder>;
  capture(orderId: string, requestId: string): Promise<PayPalOrder>;
  captureDetails(captureId: string): Promise<Capture>;
  verify(headers: Headers, event: WebhookEvent): Promise<boolean>;
}
export class PaymentError extends Error {
  constructor(public code: string, public status = 503) { super(code); }
}
