import { describe, expect, it, vi, afterEach } from "vitest";
import { isPublicSite, siteRobots, siteSitemap, SITE_ORIGIN } from "./seo";
import nextConfig from "../../next.config";

afterEach(() => vi.unstubAllEnvs());

describe("search origin policy", () => {
  it("only indexes the exact public HTTPS origin", () => {
    for (const value of [SITE_ORIGIN, `${SITE_ORIGIN}/`]) {
      expect(isPublicSite(value)).toBe(true);
      expect(siteRobots(value)).toEqual({ index: true, follow: true });
    }
    for (const value of [undefined, "invalid", "http://nebenmir.app", "https://preview.nebenmir.app", "https://nebenmir.app.evil.test", "http://localhost:3000", `${SITE_ORIGIN}/preview`, `${SITE_ORIGIN}/?preview=1`]) {
      expect(isPublicSite(value)).toBe(false);
      expect(siteRobots(value)).toEqual({ index: false, follow: false });
      expect(siteSitemap(value)).toEqual([]);
    }
  });

  it("lists only canonical public pages without query variants or private links", () => {
    expect(siteSitemap(SITE_ORIGIN)).toEqual([
      { url: `${SITE_ORIGIN}/` }, { url: `${SITE_ORIGIN}/map` },
    ]);
  });

  it("keeps HTML crawlable for noindex and omits preview sitemap discovery", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://preview.example.com");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test");
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "test");
    vi.resetModules();
    const { default: robots } = await import("../app/robots");
    expect(robots()).toEqual({ rules: { userAgent: "*", allow: "/", disallow: ["/api/"] } });
  });

  it("protects private route responses and noncanonical hosts independently of build env", async () => {
    const rules = await nextConfig.headers!();
    expect(rules[0]).toEqual({
      source: "/:path*", missing: [{ type: "host", value: "nebenmir\\.app" }],
      headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
    });
    expect(rules.slice(1).map((rule) => rule.source)).toEqual([
      "/login/:path*", "/signup/:path*", "/dashboard/:path*", "/admin/:path*", "/stats/:path*", "/p/:path*", "/api/:path*",
    ]);
  });
});
