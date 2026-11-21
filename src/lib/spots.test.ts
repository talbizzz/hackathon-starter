import { describe, expect, it } from "vitest";
import { isOpenNow, mapsUrl, opensLaterToday, parseVideo } from "./spots";

// Berlin is UTC+1 on this weekend.
const at = (iso: string) => new Date(iso);
const SAT_21_00 = at("2026-11-21T20:00:00Z");
const SUN_01_30 = at("2026-11-22T00:30:00Z");
const SUN_05_00 = at("2026-11-22T04:00:00Z");
const SUN_09_00 = at("2026-11-22T08:00:00Z");
const SUN_12_00 = at("2026-11-22T11:00:00Z");
const MON_12_00 = at("2026-11-23T11:00:00Z");

const closed = { sat_open: null, sat_close: null, sun_open: null, sun_close: null };
const satEvening = { ...closed, sat_open: "18:00:00", sat_close: "23:00:00" };
const satLate = { ...closed, sat_open: "20:00", sat_close: "04:00" };
const sunDay = { ...closed, sun_open: "10:00:00", sun_close: "18:00:00" };

describe("isOpenNow", () => {
  it("is open inside Saturday's window", () => expect(isOpenNow(satEvening, SAT_21_00)).toBe(true));
  it("is closed when Saturday has no hours", () => expect(isOpenNow(closed, SAT_21_00)).toBe(false));
  it("carries a past-midnight Saturday window into Sunday morning", () => expect(isOpenNow(satLate, SUN_01_30)).toBe(true));
  it("closes after the past-midnight window ends", () => expect(isOpenNow(satLate, SUN_05_00)).toBe(false));
  it("is closed before Sunday opening", () => expect(isOpenNow(sunDay, SUN_09_00)).toBe(false));
  it("is open inside Sunday's window", () => expect(isOpenNow(sunDay, SUN_12_00)).toBe(true));
  it("is closed on other weekdays", () => expect(isOpenNow(sunDay, MON_12_00)).toBe(false));
});

describe("opensLaterToday", () => {
  it("returns the opening time before opening", () => expect(opensLaterToday(sunDay, SUN_09_00)).toBe("10:00"));
  it("returns null once open", () => expect(opensLaterToday(sunDay, SUN_12_00)).toBeNull());
  it("returns null when closed all day", () => expect(opensLaterToday(closed, SUN_09_00)).toBeNull());
});

describe("parseVideo", () => {
  it("parses a TikTok URL with a query string", () =>
    expect(parseVideo("https://www.tiktok.com/@scout2015/video/6718335390845095173?lang=en&q=1")).toEqual({
      platform: "tiktok",
      id: "6718335390845095173",
    }));
  it("parses an Instagram reel URL with a trailing slash", () =>
    expect(parseVideo("https://www.instagram.com/reel/Df9daAtIwTJ/")).toEqual({ platform: "instagram", id: "Df9daAtIwTJ" }));
  it("parses an Instagram post URL", () =>
    expect(parseVideo("https://www.instagram.com/p/Df9daAtIwTJ/?igsh=abc")).toEqual({ platform: "instagram", id: "Df9daAtIwTJ" }));
  it("rejects TikTok short links", () => expect(parseVideo("https://vm.tiktok.com/ZGabc123/")).toBeNull());
  it("rejects garbage", () => expect(parseVideo("not a url")).toBeNull());
});

describe("mapsUrl", () => {
  it("encodes the destination", () =>
    expect(mapsUrl({ name: "Café Müller", address: "Weserstraße 1, Berlin" })).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=Caf%C3%A9%20M%C3%BCller%2C%20Weserstra%C3%9Fe%201%2C%20Berlin",
    ));
});
