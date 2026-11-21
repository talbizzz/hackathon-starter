import { PlanView } from "@/components/plan-view";

// Plan links are private to whoever has them: keep them out of search engines.
export const metadata = { title: "Plan", robots: { index: false, follow: false } };

export default async function PlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PlanView planId={id} />;
}
