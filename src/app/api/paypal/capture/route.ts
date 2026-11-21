import { body, buyer, context, json, respond, sameOrigin } from "@/lib/paypal/http";
import { PaymentError } from "@/lib/paypal/types";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  return respond(async () => {
    sameOrigin(request);
    const userId = await buyer();
    const input = await body(request);
    if (!input || typeof input !== "object" || !("orderId" in input) || typeof input.orderId !== "string") throw new PaymentError("INVALID_REQUEST", 400);
    return json(await context().service.capture(userId, input.orderId));
  });
}
