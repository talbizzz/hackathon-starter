import { buyer, context, json, respond } from "@/lib/paypal/http";
import { paymentConfig } from "@/lib/paypal/config";
export const dynamic = "force-dynamic";
export async function GET() {
  return respond(async () => {
    const userId = await buyer();
    const config = paymentConfig();
    if (!config) return json({ configured: false, mode: null, entitled: false, checkoutReady: false });
    const { store } = context();
    const [entitled, latest] = await Promise.all([store.entitled(userId, config.mode), store.latest(userId, config.mode)]);
    return json({ configured: true, mode: config.mode, entitled, checkoutReady: config.salesEnabled, ...(latest?.order_id ? { latestOrder: { orderId: latest.order_id, status: latest.status } } : {}) });
  });
}
