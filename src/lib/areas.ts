// Berlin districts and neighbourhoods for the location search, with an approximate centre each.
// Good enough to move the map there; not a boundary.
export type Area = { name: string; lat: number; lng: number };

export const AREAS: Area[] = [
  { name: "Mitte", lat: 52.52, lng: 13.405 },
  { name: "Kreuzberg", lat: 52.499, lng: 13.403 },
  { name: "Neukölln", lat: 52.481, lng: 13.435 },
  { name: "Friedrichshain", lat: 52.516, lng: 13.454 },
  { name: "Prenzlauer Berg", lat: 52.539, lng: 13.424 },
  { name: "Charlottenburg", lat: 52.516, lng: 13.304 },
  { name: "Wilmersdorf", lat: 52.487, lng: 13.32 },
  { name: "Schöneberg", lat: 52.483, lng: 13.353 },
  { name: "Tempelhof", lat: 52.466, lng: 13.386 },
  { name: "Tiergarten", lat: 52.514, lng: 13.35 },
  { name: "Moabit", lat: 52.53, lng: 13.342 },
  { name: "Wedding", lat: 52.55, lng: 13.359 },
  { name: "Pankow", lat: 52.569, lng: 13.402 },
  { name: "Weißensee", lat: 52.554, lng: 13.463 },
  { name: "Lichtenberg", lat: 52.516, lng: 13.499 },
  { name: "Rummelsburg", lat: 52.5, lng: 13.482 },
  { name: "Treptow", lat: 52.49, lng: 13.469 },
  { name: "Köpenick", lat: 52.446, lng: 13.575 },
  { name: "Adlershof", lat: 52.435, lng: 13.548 },
  { name: "Britz", lat: 52.446, lng: 13.438 },
  { name: "Steglitz", lat: 52.456, lng: 13.322 },
  { name: "Friedenau", lat: 52.472, lng: 13.329 },
  { name: "Dahlem", lat: 52.458, lng: 13.287 },
  { name: "Zehlendorf", lat: 52.434, lng: 13.259 },
  { name: "Grunewald", lat: 52.483, lng: 13.265 },
  { name: "Wannsee", lat: 52.421, lng: 13.157 },
  { name: "Spandau", lat: 52.536, lng: 13.2 },
  { name: "Reinickendorf", lat: 52.575, lng: 13.348 },
  { name: "Tegel", lat: 52.588, lng: 13.283 },
  { name: "Hohenschönhausen", lat: 52.556, lng: 13.504 },
  { name: "Marzahn", lat: 52.545, lng: 13.564 },
  { name: "Hellersdorf", lat: 52.536, lng: 13.605 },
];

// "neukolln", "Neukoelln" and "NEUKÖLLN" all find Neukölln.
function fold(text: string) {
  return text
    .toLowerCase()
    .replace(/ä/g, "a")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .replace(/ß/g, "ss")
    .replace(/ae/g, "a")
    .replace(/oe/g, "o")
    .replace(/ue/g, "u")
    .replace(/[^a-z]/g, "");
}

/** Areas matching what was typed: names starting with it first, then names containing it. All areas for an empty query. */
export function findAreas(query: string): Area[] {
  const q = fold(query);
  if (!q) return AREAS;
  const starts = AREAS.filter((a) => fold(a.name).startsWith(q));
  const contains = AREAS.filter((a) => !starts.includes(a) && fold(a.name).includes(q));
  return [...starts, ...contains];
}
