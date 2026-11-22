import { SpotList } from "@/components/spot-list";
import { createClient } from "@/lib/supabase/server";

// The product: curated spots on a map, filtered, watched and shortlisted in the browser.
// /map?plan=new opens straight on the "start a plan" screen (the landing page button uses it).
export default async function MapPage({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const { plan } = await searchParams;
  const supabase = await createClient();
  const { data: spots } = await supabase.from("spots").select("*").order("name");
  return <SpotList spots={spots ?? []} startWithPlan={plan === "new"} />;
}
