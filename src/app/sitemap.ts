import type { MetadataRoute } from "next";
import { env } from "@/lib/env";
import { siteSitemap } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  return siteSitemap(env.NEXT_PUBLIC_SITE_URL);
}
