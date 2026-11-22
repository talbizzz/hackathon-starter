// The first screen of the app for new visitors: a few autoplaying Berlin spots, then "Pick your area".
import type { Spot } from "@/lib/spots";

export type Kind = "cafe" | "outdoor" | "art";
export type FirstScreenSpot = { spot: Spot; kind: Kind; poster: string | null };

/** Hand-picked: short videos (2-4 MB) that look good muted. The first two are the ones seen without scrolling. */
const PICKS: { id: string; kind: Kind }[] = [
  { id: "e3d652a8-3d17-5e40-9a0e-237a262f43a1", kind: "outdoor" }, // Viktoriapark viewpoint walk
  { id: "292b2b7b-5b11-599b-8aaa-0ed3d7c83920", kind: "cafe" }, // 738Krema
  { id: "18aa0f4f-747f-4e7c-9b78-ae27266edf0a", kind: "art" }, // Teufelsberg street art and views
  { id: "46dcadd8-f29c-58b0-b047-85a2a0a05c60", kind: "art" }, // East Side Gallery
  { id: "4b39995f-435c-52e0-a22c-344002c55fd4", kind: "cafe" }, // Tadim
];
/** Compressed stills (300x533 webp, 10-17 KB) for the picks, in public/first-screen/. */
const hasLocalPoster = new Set(PICKS.map((p) => p.id));

const KIND_BY_CATEGORY: Record<string, Kind> = { food: "cafe", drinks: "cafe", outdoors: "outdoor", culture: "art", market: "cafe" };
export const MAX_CARDS = 5;
export const MIN_CARDS = 3;

/** Up to five spots with a video, café / outdoor / street art. Falls back to any spots with videos if picks were unpublished. */
export function pickFirstScreenSpots(spots: Spot[]): FirstScreenSpot[] {
  const withVideo = spots.filter((s) => s.video_file_url);
  const out: FirstScreenSpot[] = [];
  for (const pick of PICKS) {
    const spot = withVideo.find((s) => s.id === pick.id);
    if (spot) out.push({ spot, kind: pick.kind, poster: `/first-screen/${spot.id}.webp` });
  }
  if (out.length < MIN_CARDS) {
    for (const spot of withVideo) {
      if (out.length >= MAX_CARDS) break;
      const kind = KIND_BY_CATEGORY[spot.category];
      if (!kind || out.some((o) => o.spot.id === spot.id)) continue;
      out.push({ spot, kind, poster: hasLocalPoster.has(spot.id) ? `/first-screen/${spot.id}.webp` : spot.poster_url });
    }
  }
  return out.slice(0, MAX_CARDS);
}

/** The six choices on the first screen. "Other" starts the plan without moving the map. */
export const FIRST_AREAS = ["Kreuzberg", "Neukölln", "Mitte", "Friedrichshain", "Prenzlauer Berg", "Other"] as const;
export type FirstArea = (typeof FIRST_AREAS)[number];
