import type { Metadata } from "next";
import { PaidPlan } from "@/components/paid-plan";
import { PAID_PLAN } from "@/lib/paid-plan";

export const metadata: Metadata = {
  title: `${PAID_PLAN.title} · €3.99 for your group`,
  description: "Preview a self-guided Kreuzberg afternoon: local stories, art, practical timing and a lower-cost alternative. An English-language guide, purchased once for your group.",
};

export default async function Page({ searchParams }: { searchParams: Promise<{ token?: string; checkout?: string }> }) {
  const params = await searchParams;
  return <PaidPlan
    returnOrderId={typeof params.token === "string" && params.checkout === "return" ? params.token : undefined}
    cancelled={params.checkout === "cancel"}
    salesEnabled={process.env.PAID_PLAN_SALES_ENABLED === "true"}
  />;
}
