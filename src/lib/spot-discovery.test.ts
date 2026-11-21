import { describe, expect, it } from "vitest";
import { discoverSpots, loadInventory, supportedNeighbourhood } from "./spot-discovery";
import type { Spot } from "./spots";

const saturday = new Date("2026-11-21T12:00:00Z"); // 13:00 in Berlin
const spot = (changes: Partial<Spot> = {}): Spot => ({
  id: "spot-1", name: "Test venue", neighbourhood: "neukoelln", category: "culture",
  price: 1, indoor: true, published: true, created_at: "2026-11-21T00:00:00Z",
  sat_open: "10:00", sat_close: "18:00", sun_open: "11:00", sun_close: "18:00",
  address: "Berlin", station: null, note_de: null, note_en: null,
  creator_handle: null, venue_handle: null, video_url: "https://example.test/video",
  ...changes,
});

describe("loadInventory", () => {
  it("preserves a successful empty public inventory", async () => {
    await expect(loadInventory(async () => ({ data: [], error: null })))
      .resolves.toEqual({ spots: [], loadError: false });
  });
  it("preserves populated inventory", async () => {
    const spots = [spot()];
    await expect(loadInventory(async () => ({ data: spots, error: null })))
      .resolves.toEqual({ spots, loadError: false });
  });
  it("does not disguise a service error as empty inventory", async () => {
    await expect(loadInventory(async () => ({ data: null, error: { code: "42501" } })))
      .resolves.toEqual({ spots: [], loadError: true });
  });
  it("handles thrown connection failures without leaking error details", async () => {
    await expect(loadInventory(async () => { throw new Error("private service details"); }))
      .resolves.toEqual({ spots: [], loadError: true });
  });
  it("treats missing data without an error as a failed response", async () => {
    await expect(loadInventory(async () => ({ data: null, error: null })))
      .resolves.toEqual({ spots: [], loadError: true });
  });
});

describe("supportedNeighbourhood", () => {
  it.each(["Neukölln", "neukoelln", "Neukoelln", " Neukölln ", "NEUKÖLLN"])("recognizes %s", (name) => {
    expect(supportedNeighbourhood(name)).toBe("neukoelln");
  });
  it("recognizes Kreuzberg display labels", () => expect(supportedNeighbourhood("Kreuzberg")).toBe("kreuzberg"));
  it.each(["Lichtenberg", "Mitte", "Tempelhof", "Grunewald", "Friedrichshain-Kreuzberg", "Neukölln-Nord"])("does not reclassify %s", (name) => {
    expect(supportedNeighbourhood(name)).toBeNull();
  });
});

describe("discoverSpots", () => {
  it("shows a published display-label Neukölln venue without moving other localities", () => {
    const berlin = [spot({ neighbourhood: "Neukölln" }), spot({ id: "outside", neighbourhood: "Tempelhof" })];
    expect(discoverSpots(berlin, "neukoelln", [], [], saturday).inventory.map((s) => s.id)).toEqual(["spot-1"]);
    expect(discoverSpots(berlin, "kreuzberg", [], [], saturday).inventory).toEqual([]);
  });
  it("distinguishes filters from empty inventory", () => {
    const result = discoverSpots([spot()], "neukoelln", ["food"], [], saturday);
    expect(result.inventory).toHaveLength(1);
    expect(result.visible).toHaveLength(0);
    expect(discoverSpots([spot()], "neukoelln", [], [], saturday).visible).toHaveLength(1);
  });
  it("applies affordability and indoor filters together", () => {
    const spots = [spot(), spot({ id: "expensive", price: 2 }), spot({ id: "outdoor", indoor: false })];
    expect(discoverSpots(spots, "neukoelln", [], ["cheap", "indoor"], saturday).visible.map((s) => s.id)).toEqual(["spot-1"]);
    expect(discoverSpots(spots, "neukoelln", [], ["free"], saturday).visible).toEqual([]);
  });
  it("keeps Sunday options visible when the venue is already open on Saturday", () => {
    const result = discoverSpots([spot()], "neukoelln", [], [], saturday);
    expect(result.openNow).toHaveLength(1);
    expect(result.tomorrow.map((s) => s.at)).toEqual(["11:00"]);
  });
  it("keeps later Saturday venues discoverable for Sunday and sorts opening times", () => {
    const result = discoverSpots([spot({ sat_open: "15:00", sun_open: "12:00" }), spot({ id: "early", sat_open: "14:00", sun_open: "09:00" })], "neukoelln", [], [], saturday);
    expect(result.later.map((s) => s.at)).toEqual(["14:00", "15:00"]);
    expect(result.tomorrow.map((s) => s.at)).toEqual(["09:00", "12:00"]);
  });
  it("retains inventory after closing without pretending it is open", () => {
    const result = discoverSpots([spot({ sun_open: null })], "neukoelln", [], [], new Date("2026-11-21T22:00:00Z"));
    expect(result.visible).toHaveLength(1);
    expect(result.openNow.length + result.later.length + result.tomorrow.length).toBe(0);
  });
  it("waits for the browser clock without losing inventory", () => {
    const result = discoverSpots([spot()], "neukoelln", [], [], null);
    expect(result.visible).toHaveLength(1);
    expect(result.openNow.length + result.later.length + result.tomorrow.length).toBe(0);
  });
});
