"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { resetAnalytics } from "@/lib/analytics";

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      className="text-sm text-neutral-600 hover:text-black"
      onClick={async () => {
        await createClient().auth.signOut();
        resetAnalytics();
        router.push("/");
        router.refresh();
      }}
    >
      Sign out
    </button>
  );
}
