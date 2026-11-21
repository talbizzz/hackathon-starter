import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = env.NEXT_PUBLIC_SITE_URL;
  return ["", "/login", "/signup"].map((p) => ({ url: `${base}${p}` }));
}
