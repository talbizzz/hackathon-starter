import { describe, expect, it } from "vitest";
import { isSocialReferrer, landingSkipTarget } from "./ad-traffic";

const u = (s: string) => new URL(`https://nebenmir.app${s}`);

describe("landingSkipTarget", () => {
  it("shows the landing page without utm_source or social referrer", () => {
    expect(landingSkipTarget(u("/"), null)).toBeNull();
    expect(landingSkipTarget(u("/?utm_campaign=x"), "https://google.com/")).toBeNull();
  });
  it("skips on any utm_source and keeps every param", () => {
    const t = landingSkipTarget(u("/?utm_source=ig&utm_medium=paid&utm_campaign=c1"), null)!;
    expect(t.path).toBe("/map");
    const p = new URLSearchParams(t.search);
    expect(p.get("plan")).toBe("new");
    expect(p.get("utm_source")).toBe("ig");
    expect(p.get("utm_medium")).toBe("paid");
    expect(p.get("utm_campaign")).toBe("c1");
  });
  it("skips on a social referrer", () => {
    const t = landingSkipTarget(u("/"), "https://l.instagram.com/?u=x")!;
    expect(t.search).toBe("?plan=new");
    expect(t.referrer).toBe("https://l.instagram.com/?u=x");
    expect(landingSkipTarget(u("/"), "https://m.facebook.com/")).not.toBeNull();
  });
});

describe("isSocialReferrer", () => {
  it("does not match look-alike hosts", () => {
    expect(isSocialReferrer("https://notinstagram.com/")).toBe(false);
    expect(isSocialReferrer("https://instagram.com.evil.io/")).toBe(false);
    expect(isSocialReferrer("garbage")).toBe(false);
  });
});
