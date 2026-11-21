import { describe, expect, it } from "vitest";
import { AREAS, findAreas } from "./areas";

describe("findAreas", () => {
  it("returns every area for an empty query", () => expect(findAreas("  ")).toHaveLength(AREAS.length));
  it("finds Neukölln without the umlaut", () => expect(findAreas("neukolln")[0].name).toBe("Neukölln"));
  it("finds Neukölln spelled with oe", () => expect(findAreas("Neukoelln")[0].name).toBe("Neukölln"));
  it("matches from the first letters", () => expect(findAreas("kre")[0].name).toBe("Kreuzberg"));
  it("puts names starting with the query before names containing it", () =>
    expect(findAreas("berg").map((a) => a.name)).toEqual(["Kreuzberg", "Prenzlauer Berg", "Schöneberg", "Lichtenberg"].sort((a, b) => Number(!a.toLowerCase().startsWith("berg")) - Number(!b.toLowerCase().startsWith("berg")))));
  it("returns nothing for an unknown place", () => expect(findAreas("hamburg")).toEqual([]));
  it("keeps every area inside the map limits", () =>
    AREAS.forEach((a) => expect(a.lat > 52.3 && a.lat < 52.7 && a.lng > 13.0 && a.lng < 13.8, a.name).toBe(true)));
});
