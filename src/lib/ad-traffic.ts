// Paid and social visitors skip the landing page and go straight into the app.
export const APP_START_PATH = "/map";
export const APP_START_PLAN = "new";
/** Short-lived cookie set by the redirect so the browser can report "landing_skipped" once. */
export const SKIP_COOKIE = "nm_ls";

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
export function landingSkipTarget(url: URL, referrer: string | null | undefined): { path: string; search: string; utmSource: string; referrer: string } | null {
  const utmSource = url.searchParams.get("utm_source");
  if (!utmSource && !isSocialReferrer(referrer)) return null;
  const params = new URLSearchParams(url.searchParams);
  if (!params.has("plan")) params.set("plan", APP_START_PLAN);
  return { path: APP_START_PATH, search: `?${params.toString()}`, utmSource: utmSource ?? "", referrer: referrer ?? "" };
}
