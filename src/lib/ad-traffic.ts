// Paid and social visitors skip the landing page and go straight into the app.
export const APP_START_PATH = "/map";
export const APP_START_PLAN = "new";
/** Short-lived cookie set by the redirect so the browser can report "landing_skipped" once. */
export const SKIP_COOKIE = "nm_ls";

/**
 * true: every visitor goes straight into the app (the landing page is parked).
 * false: only visitors with a utm_source or an instagram.com / facebook.com referrer skip it.
 * Crawlers and link-preview fetchers always get the real "/" so share cards keep working.
 */
export const SKIP_LANDING_FOR_ALL = true;

const BOT_UA = /bot|crawl|spider|slurp|facebookexternalhit|facebookcatalog|whatsapp|preview|embedly|pinterest|quora|vkshare|skypeuripreview|headlesschrome|lighthouse|pagespeed|curl|wget/i;

export function isCrawler(userAgent: string | null | undefined): boolean {
  return !!userAgent && BOT_UA.test(userAgent);
}

const SOCIAL_HOSTS = ["instagram.com", "facebook.com"];

/** True for instagram.com / facebook.com and their subdomains (l.instagram.com, m.facebook.com, ...). */
export function isSocialReferrer(referrer: string | null | undefined): boolean {
  if (!referrer) return false;
  try {
    const host = new URL(referrer).hostname.toLowerCase();
    return SOCIAL_HOSTS.some((d) => host === d || host.endsWith(`.${d}`));
  } catch {
    return false;
  }
}

/** Where a visitor on "/" should be sent, or null to show the landing page. Keeps every query param. */
export function landingSkipTarget(url: URL, referrer: string | null | undefined, userAgent?: string | null): { path: string; search: string; utmSource: string; referrer: string } | null {
  const utmSource = url.searchParams.get("utm_source");
  if (isCrawler(userAgent)) return null;
  if (!SKIP_LANDING_FOR_ALL && !utmSource && !isSocialReferrer(referrer)) return null;
  const params = new URLSearchParams(url.searchParams);
  if (!params.has("plan")) params.set("plan", APP_START_PLAN);
  return { path: APP_START_PATH, search: `?${params.toString()}`, utmSource: utmSource ?? "", referrer: referrer ?? "" };
}
