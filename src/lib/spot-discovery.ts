import { isOpenNow, opensLaterToday, opensTomorrow, type Spot } from "./spots";

export type Inventory = { spots: Spot[]; loadError: boolean };

/** Keep transport/service failures distinct from a successful empty public inventory. */
export async function loadInventory(
  query: () => PromiseLike<{ data: Spot[] | null; error: unknown }>,
): Promise<Inventory> {
  try {
    const { data, error } = await query();
    if (error || data === null) return { spots: [], loadError: true };
    return { spots: data, loadError: false };
  } catch {
    return { spots: [], loadError: true };
  }
}

/** Only spelling aliases for the two supported localities; never map other Berlin areas. */
export function supportedNeighbourhood(value: string): "neukoelln" | "kreuzberg" | null {
  const name = value.trim().normalize("NFC").toLowerCase();
  if (name === "neukölln" || name === "neukoelln") return "neukoelln";
  if (name === "kreuzberg") return "kreuzberg";
  return null;
}

export type SpotFlag = "indoor" | "free" | "cheap";

export function discoverSpots(
  spots: Spot[], hood: string, categories: string[], flags: SpotFlag[], now: Date | null,
) {
  const inventory = spots.filter((s) => supportedNeighbourhood(s.neighbourhood) === hood);
  const visible = inventory.filter((s) =>
    (categories.length === 0 || categories.includes(s.category)) &&
    flags.every((f) => f === "indoor" ? s.indoor : f === "free" ? s.price === 0 : s.price <= 1),
  );
  const openNow = now ? visible.filter((s) => isOpenNow(s, now)) : [];
  const timed = (opening: (spot: Spot, now: Date) => string | null) => now
    ? visible.map((spot) => ({ spot, at: opening(spot, now) }))
        .filter((x): x is { spot: Spot; at: string } => x.at !== null)
        .sort((a, b) => a.at.localeCompare(b.at))
    : [];
  const later = timed(opensLaterToday);
  // Sunday choices remain discoverable even when the same venue is open on Saturday.
  const tomorrow = timed(opensTomorrow);
  return { inventory, visible, openNow, later, tomorrow };
}
