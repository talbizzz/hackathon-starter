"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import posthog from "posthog-js";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { trackVisit } from "@/lib/analytics";
import { env } from "@/lib/env";

let phReady = false;
function initPostHog() {
  if (phReady || typeof window === "undefined") return;
  posthog.init(env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: env.NEXT_PUBLIC_POSTHOG_HOST,
    capture_pageview: false, // we send pageviews manually (App Router)
    person_profiles: "identified_only",
  });
  phReady = true;
}

function PageView() {
  const pathname = usePathname();
  const search = useSearchParams();
  useEffect(() => {
    initPostHog();
    trackVisit();
    posthog.capture("$pageview", { $current_url: window.location.href });
  }, [pathname, search]);
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000 } } }));
  return (
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={null}>
        <PageView />
      </Suspense>
      {children}
    </QueryClientProvider>
  );
}
