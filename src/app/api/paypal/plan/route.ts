import { buyer, context, json, respond } from "@/lib/paypal/http";
import { paidPlanContent } from "@/lib/paid-plan-content";
import { PaymentError } from "@/lib/paypal/types";
export const dynamic = "force-dynamic";
export async function GET() {
  return respond(async () => {
    const userId = await buyer();
    const { store, config } = context();
    if (!await store.entitled(userId, config.mode)) throw new PaymentError("PAYMENT_REQUIRED", 403);
    return json(paidPlanContent);
  });
}
