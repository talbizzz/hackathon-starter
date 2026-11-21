"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Events, getAttribution, track } from "@/lib/analytics";
import { siteConfig } from "@/lib/site-config";

export function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState("loading");
    const { error } = await createClient().from("waitlist").insert({ email: email.trim(), source: getAttribution().source });
    // 23505 = already on the list: treat as success
    if (error && error.code !== "23505") return setState("error");
    track(Events.waitlistSubmit);
    setState("done");
  }

  if (state === "done") return <p className="font-medium text-green-700">{siteConfig.cta.success}</p>;
  return (
    <form onSubmit={onSubmit} className="flex w-full max-w-md gap-2">
      <input
        type="email" required placeholder="you@example.com" value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="min-w-0 flex-1 rounded-lg border border-neutral-300 px-3 py-2"
      />
      <button disabled={state === "loading"} className="rounded-lg bg-black px-4 py-2 font-medium text-white disabled:opacity-50">
        {siteConfig.cta.button}
      </button>
      {state === "error" && <span className="self-center text-sm text-red-600">Something went wrong</span>}
    </form>
  );
}
