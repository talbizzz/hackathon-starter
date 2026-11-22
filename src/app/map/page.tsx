import { SITE_ORIGIN } from "@/lib/seo";
import { SpotList } from "@/components/spot-list";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Things to do in Berlin — explore the map",
  description: "Explore curated Berlin spots with videos. Shortlist places, share a plan, and let your friends vote.",
  alternates: { canonical: "/map" },
  openGraph: {
    title: "Things to do in Berlin — NebenMir map",
    description: "Explore curated Berlin spots with videos. Shortlist places, share a plan, and let your friends vote.",
    url: "/map",
    type: "website",
    siteName: "NebenMir",
    images: [{ url: `${SITE_ORIGIN}/opengraph-image.png`, width: 1200, height: 630, alt: "NebenMir — Find something to do in Berlin. Let your friends vote." }],
  },
  twitter: {
    card: "summary_large_image",
    images: [{ url: `${SITE_ORIGIN}/opengraph-image.png`, alt: "NebenMir — Find something to do in Berlin. Let your friends vote." }],
    title: "Things to do in Berlin — NebenMir map",
    description: "Explore curated Berlin spots with videos. Shortlist places, share a plan, and let your friends vote.",
  },
};

// The product: curated spots on a map, filtered, watched and shortlisted in the browser.
// /map?plan=new opens straight on the "start a plan" screen (the landing page button uses it).
export default async function MapPage({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const { plan } = await searchParams;
  const supabase = await createClient();
  const { data: spots } = await supabase.from("spots").select("*").order("name");
  return <SpotList spots={spots ?? []} startWithPlan={plan === "new"} />;
}
