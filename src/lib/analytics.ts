import posthog from "posthog-js";
import { getDeviceId } from "@/lib/device";
import { createClient } from "@/lib/supabase/client";

// One place for event names. Add yours here.
export const Events = {
  visit: "visit",
  signup: "signup",
  login: "login",
  waitlistSubmit: "waitlist_submit",
  // Placeholder for your product's key action. Fire it from the real feature.
  // Keep the value "core_action": /stats counts users with this event as real users.
  coreAction: "core_action",
  videoPlayed: "video_played",
  ctaClicked: "cta_clicked",
  planStarted: "plan_started",
  favoriteAdded: "favorite_added",
  areaPicked: "area_picked",
  planCreated: "plan_created",
  shareTapped: "share_tapped",
  planOpened: "plan_opened",
  voteCast: "vote_cast",
  directionsTapped: "directions_tapped",
} as const;

const ATTRIBUTION_KEY = "attribution";
type Attribution = { source: string; campaign: string | null };

// First-touch channel: utm_source, else the referring site, else "direct". Saved once per browser.
export function getAttribution(): Attribution {
  if (typeof window === "undefined") return { source: "direct", campaign: null };
  try {
    const saved = localStorage.getItem(ATTRIBUTION_KEY);
    if (saved) return JSON.parse(saved) as Attribution;
  } catch {}
  const query = new URLSearchParams(window.location.search);
  let referrer: string | null = null;
  try {
    const host = new URL(document.referrer).hostname;
    if (host !== window.location.hostname) referrer = host;
  } catch {}
  const attribution: Attribution = {
    source: (query.get("utm_source") || referrer || "direct").toLowerCase().slice(0, 100),
    campaign: query.get("utm_campaign")?.slice(0, 100) ?? null,
  };
  try {
    localStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(attribution));
  } catch {}
  return attribution;
}

export function track(event: (typeof Events)[keyof typeof Events], props?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  const { source, campaign } = getAttribution();
  posthog.capture(event, props);
  // First-party copy in Supabase: not dropped by ad blockers, and it feeds /stats.
  void createClient().from("events").insert({ name: event, source, campaign, anon_id: getDeviceId() }).then(() => {});
}

let visitChecked = false;
/** Logs one "visit" the first time a browser lands on the site. */
export function trackVisit() {
  if (visitChecked || typeof window === "undefined") return;
  visitChecked = true;
  let seen = false;
  try {
    seen = !!localStorage.getItem(ATTRIBUTION_KEY);
  } catch {}
  if (!seen) track(Events.visit);
}

export function identify(userId: string, email?: string) {
  if (typeof window === "undefined") return;
  posthog.identify(userId, email ? { email } : undefined);
}

export function resetAnalytics() {
  if (typeof window === "undefined") return;
  posthog.reset();
}
