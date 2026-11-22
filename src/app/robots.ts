import type { MetadataRoute } from "next";
import { env } from "@/lib/env";
import { isPublicSite, SITE_ORIGIN } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    // HTML routes stay crawlable so crawlers can read their noindex directives.
    // Access control belongs to authentication, not robots.txt.
    rules: { userAgent: "*", allow: "/", disallow: ["/api/"] },
    ...(isPublicSite(env.NEXT_PUBLIC_SITE_URL) ? { sitemap: `${SITE_ORIGIN}/sitemap.xml` } : {}),
  };
}
