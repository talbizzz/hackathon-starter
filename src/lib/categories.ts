// The eight categories a spot can have, each with its own colour: on the map pins and the filter chips.
export const CATEGORIES = ["food", "drinks", "market", "culture", "sport", "outdoors", "nightlife", "other"] as const;
export type Category = (typeof CATEGORIES)[number];

/** The brand colour: spots that are part of the plan being built. */
export const BRAND = "#d63c68";

const COLORS: Record<Category, string> = {
  food: "#f28c28",
  drinks: "#12a3a3",
  market: "#e5b020",
  culture: "#3f7fe0",
  sport: "#e4572e",
  outdoors: "#3ba55d",
  nightlife: "#243b6b",
  other: "#8a8a8a",
};

export function categoryColor(category: string): string {
  return COLORS[category as Category] ?? COLORS.other;
}
