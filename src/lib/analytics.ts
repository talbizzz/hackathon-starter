import posthog from "posthog-js";

// One place for event names. Add yours here.
export const Events = {
  signup: "signup",
  login: "login",
  waitlistSubmit: "waitlist_submit",
  coreAction: "core_action", // placeholder: rename to your product's key action
} as const;

export function track(event: (typeof Events)[keyof typeof Events], props?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  posthog.capture(event, props);
}

export function identify(userId: string, email?: string) {
  if (typeof window === "undefined") return;
  posthog.identify(userId, email ? { email } : undefined);
}

export function resetAnalytics() {
  if (typeof window === "undefined") return;
  posthog.reset();
}
