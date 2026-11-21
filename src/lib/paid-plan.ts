// Public product information only. The itinerary lives in a server-only module.
export const PAID_PLAN = {
  id: "kreuzberg-sunday",
  title: "Sunday art & local stories",
  amount: "3.99",
  priceCents: 399,
  currency: "EUR",
  path: "/plans/kreuzberg-sunday",
} as const;

export type PaidPlanContent = {
  title: string;
  introduction: string;
  checkedAt: string;
  budget: string;
  steps: {
    time: string;
    title: string;
    detail: string;
    cost: string;
    address?: string;
    mapUrl?: string;
    sourceUrl?: string;
  }[];
  backup: { title: string; detail: string; sourceUrl: string };
  notes: string[];
};
