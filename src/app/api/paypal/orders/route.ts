import { buyer, context, json, respond, sameOrigin } from "@/lib/paypal/http";
import { PaymentError } from "@/lib/paypal/types";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  return respond(async () => {
    sameOrigin(request);
    const userId = await buyer();
    const { config, service } = context();
    if (!config.salesEnabled) throw new PaymentError("SALES_PAUSED", 503);
    return json(await service.create(userId));
  });
}
