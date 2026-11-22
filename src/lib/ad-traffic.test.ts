import { describe, expect, it } from "vitest";
import { isSocialReferrer, landingSkipTarget, SKIP_LANDING_FOR_ALL } from "./ad-traffic";

const u = (s: string) => new URL(`https://nebenmir.app${s}`);

describe("landingSkipTarget", () => {
  it("sends everyone into the app, with plan=new", () => {
    expect(SKIP_LANDING_FOR_ALL).toBe(true);
    expect(landingSkipTarget(u("/"), null)!.search).toBe("?plan=new");
    expect(landingSkipTarget(u("/?utm_campaign=x"), "https://google.com/")!.search).toBe("?utm_campaign=x&plan=new");
  });
  it("leaves crawlers and link-preview fetchers on the real page", () => {
    expect(landingSkipTarget(u("/"), null, "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uagent.php)")).toBeNull();
    expect(landingSkipTarget(u("/"), null, "Mozilla/5.0 (compatible; Googlebot/2.1)")).toBeNull();
    expect(landingSkipTarget(u("/"), null, "WhatsApp/2.23")).toBeNull();
    expect(landingSkipTarget(u("/"), null, "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) Mobile/21F90 Instagram 340.0")).not.toBeNull();
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
