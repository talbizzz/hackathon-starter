import { SpotList } from "@/components/spot-list";
import { loadInventory } from "@/lib/spot-discovery";
import { createClient } from "@/lib/supabase/server";

// The home page is the product: curated spots, filtered and shortlisted in the browser.
export default async function Home() {
  const supabase = await createClient();
  const inventory = await loadInventory(() => supabase.from("spots").select("*").order("name"));
  return <SpotList {...inventory} />;
}
