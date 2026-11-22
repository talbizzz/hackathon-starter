import type { Metadata, MetadataRoute } from "next";

/** The only public search origin. Preview URLs must never become canonicals. */
export const SITE_ORIGIN = "https://nebenmir.app";
export const PRIVATE_ROBOTS = { index: false, follow: false } as const;

export function isPublicSite(siteUrl: string | undefined): boolean {
  try {
    const url = new URL(siteUrl ?? "");
    return url.origin === SITE_ORIGIN && url.pathname === "/" && !url.search && !url.hash;
  } catch {
    return false;
  }
}

export function siteRobots(siteUrl: string | undefined): Metadata["robots"] {
  return isPublicSite(siteUrl) ? { index: true, follow: true } : PRIVATE_ROBOTS;
}

export function siteSitemap(siteUrl: string | undefined): MetadataRoute.Sitemap {
  if (!isPublicSite(siteUrl)) return [];
  return ["/", "/map"].map((path) => ({ url: new URL(path, SITE_ORIGIN).href }));
}
