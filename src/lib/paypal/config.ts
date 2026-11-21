import "server-only";
import type { Mode } from "./types";
export type PayPalConfig = {
  mode: Mode; clientId: string; secret: string; merchantId: string; webhookId: string;
  siteOrigin: string; supabaseUrl: string; serviceKey: string; salesEnabled: boolean;
};
export function paymentConfig(): PayPalConfig | null {
  const e = process.env;
  if (e.PAYPAL_ENV !== "sandbox" && e.PAYPAL_ENV !== "live") return null;
  if (![e.PAYPAL_CLIENT_ID, e.PAYPAL_CLIENT_SECRET, e.PAYPAL_MERCHANT_ID, e.PAYPAL_WEBHOOK_ID, e.NEXT_PUBLIC_SITE_URL, e.NEXT_PUBLIC_SUPABASE_URL, e.SUPABASE_SERVICE_ROLE_KEY].every(v => v?.trim())) return null;
  try {
    const site = new URL(e.NEXT_PUBLIC_SITE_URL!);
    const db = new URL(e.NEXT_PUBLIC_SUPABASE_URL!);
    if (!['https:', 'http:'].includes(site.protocol) || !['https:', 'http:'].includes(db.protocol)) return null;
    if (e.PAYPAL_ENV === "live" && (site.protocol !== "https:" || db.protocol !== "https:")) return null;
    return { mode: e.PAYPAL_ENV, clientId: e.PAYPAL_CLIENT_ID!, secret: e.PAYPAL_CLIENT_SECRET!, merchantId: e.PAYPAL_MERCHANT_ID!, webhookId: e.PAYPAL_WEBHOOK_ID!, siteOrigin: site.origin, supabaseUrl: db.href, serviceKey: e.SUPABASE_SERVICE_ROLE_KEY!, salesEnabled: e.PAID_PLAN_SALES_ENABLED === "true" };
  } catch { return null; }
}
