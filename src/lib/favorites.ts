import { useMemo } from "react";
import { Events, track } from "@/lib/analytics";
import { setStored, useStored } from "@/lib/stored";

const KEY = "favorites";

// Saved spots. Kept on this device only: visitors have no account.
export function useFavorites() {
  const raw = useStored(KEY);
  const ids = useMemo<string[]>(() => {
    try {
      const parsed = JSON.parse(raw ?? "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [raw]);

  function toggle(id: string) {
    const saved = ids.includes(id);
    setStored(KEY, JSON.stringify(saved ? ids.filter((x) => x !== id) : [...ids, id]));
    if (!saved) track(Events.favoriteAdded, { spot_id: id });
  }

  return { ids, toggle };
}
