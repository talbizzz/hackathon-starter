import { body, context, json, respond } from "@/lib/paypal/http";
import type { WebhookEvent } from "@/lib/paypal/types";
import { PaymentError } from "@/lib/paypal/types";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  return respond(async () => {
    const input = await body(request, 262144);
    if (!input || typeof input !== "object") throw new PaymentError("INVALID_EVENT", 400);
    await context().service.webhook(request.headers, input as WebhookEvent);
    return json({ received: true });
  });
}
