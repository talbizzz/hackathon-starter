"use client";

import { useState } from "react";
import { Events, track } from "@/lib/analytics";
import { siteConfig } from "@/lib/site-config";

// Placeholder for the product's key action. Replace the body with the real feature.
export function CoreActionButton() {
  const [done, setDone] = useState(false);
  return (
    <button
      className="mt-6 rounded-lg bg-black px-4 py-2 font-medium text-white"
      onClick={() => {
        track(Events.coreAction);
        setDone(true);
      }}
    >
      {done ? "Done ✓" : siteConfig.dashboard.coreActionLabel}
    </button>
  );
}
