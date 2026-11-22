import { describe, expect, it } from "vitest";
import type { Spot } from "./spots";
import { pickFirstScreenSpots } from "./first-screen";

const spot = (id: string, category: string, video: string | null = "v.mp4") => ({ id, category, video_file_url: video, poster_url: "p.jpg", name: id }) as unknown as Spot;

describe("pickFirstScreenSpots", () => {
  it("uses the curated spots, with the compressed local poster, in order", () => {
    const picks = pickFirstScreenSpots([
      spot("292b2b7b-5b11-599b-8aaa-0ed3d7c83920", "food"),
      spot("e3d652a8-3d17-5e40-9a0e-237a262f43a1", "outdoors"),
      spot("18aa0f4f-747f-4e7c-9b78-ae27266edf0a", "culture"),
    ]);
    expect(picks.map((p) => p.kind)).toEqual(["outdoor", "cafe", "art"]);
    expect(picks[0].poster).toBe("/first-screen/e3d652a8-3d17-5e40-9a0e-237a262f43a1.webp");
  });
  it("falls back to any spots with a video when the picks are gone, and never shows videoless spots", () => {
    const picks = pickFirstScreenSpots([spot("a", "food"), spot("b", "outdoors"), spot("c", "culture"), spot("d", "culture", null), spot("e", "sport")]);
    expect(picks.map((p) => p.spot.id)).toEqual(["a", "b", "c"]);
    expect(picks[0].poster).toBe("p.jpg");
  });
});
