import { describe, expect, it } from "vitest";
import { detectLang, dict } from "./i18n";

describe("detectLang", () => {
  it("prefers a saved language", () => expect(detectLang("de", "en-US")).toBe("de"));
  it("uses German for a German browser", () => expect(detectLang(null, "de-DE")).toBe("de"));
  it("falls back to English for other browsers", () => expect(detectLang(null, "fr")).toBe("en"));
  it("ignores an unknown saved value", () => expect(detectLang("xx", undefined)).toBe("en"));
});

describe("dict", () => {
  it("has the same keys in both languages", () => {
    expect(Object.keys(dict.de).sort()).toEqual(Object.keys(dict.en).sort());
  });
});
