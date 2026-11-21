import { describe, expect, it } from "vitest";
import { authReturnTo } from "./auth-return";

describe("purchase return after sign in", () => {
  it("preserves the PayPal return token on the known plan page", () => {
    expect(authReturnTo("/plans/kreuzberg-sunday?checkout=return&token=ABC")).toBe("/plans/kreuzberg-sunday?checkout=return&token=ABC");
  });
  it.each(["https://evil.test", "//evil.test", "/\\evil.test", "/login", "/signup", "/unknown", undefined])("rejects an unsafe or unsupported target: %s", (target) => {
    expect(authReturnTo(target)).toBe("/dashboard");
  });
});
