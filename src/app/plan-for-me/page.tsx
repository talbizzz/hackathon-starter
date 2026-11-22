import { Offer } from "@/components/offer";

// Paid offer: a ready-made plan or a plan made for your group. Prices and the PayPal handle live in siteConfig.offer.
export const metadata = {
  title: "We plan your Berlin outing",
  description: "A ready-made half-day plan or a plan made for your group: real Berlin places, checked for your day, shared as one link your friends vote on.",
  alternates: { canonical: "/plan-for-me" },
};

export default function PlanForMePage() {
  return <Offer />;
}
