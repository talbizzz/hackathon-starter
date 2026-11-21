import { describe, expect, it, vi } from "vitest";
import { PlanSharing } from "./plan-sharing";

describe("durable plan sharing", () => {
  it("saves on the first tap and invokes sharing synchronously on the second", async () => {
    const session = new PlanSharing();
    const save = vi.fn(async () => "plan-a");
    const share = vi.fn(async () => "copied");
    expect(await session.activate("a", save, share)).toEqual({ kind: "saved", id: "plan-a" });
    expect(share).not.toHaveBeenCalled();
    const sharing = session.activate("a", save, share);
    expect(share).toHaveBeenCalledWith("plan-a");
    expect(await sharing).toEqual({ kind: "shared", result: "copied" });
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("blocks rapid repeated taps and selection resets while a save is pending", async () => {
    const session = new PlanSharing();
    let finish!: (id: string) => void;
    const save = vi.fn(() => new Promise<string>((resolve) => { finish = resolve; }));
    const share = vi.fn(async () => "shared");
    const first = session.activate("a", save, share);
    expect(session.busy).toBe(true);
    expect(session.reset()).toBe(false);
    expect(await session.activate("a", save, share)).toEqual({ kind: "busy" });
    expect(save).toHaveBeenCalledTimes(1);
    finish("plan-a");
    await first;
    expect(session.busy).toBe(false);
    expect(share).not.toHaveBeenCalled();
  });

  it("never shares after a rejected save and allows a fresh save on retry", async () => {
    const session = new PlanSharing();
    const save = vi.fn<() => Promise<string>>().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce("plan-a");
    const share = vi.fn(async () => "shared");
    await expect(session.activate("a", save, share)).rejects.toThrow("offline");
    expect(session.savedId("a")).toBeNull();
    expect(session.busy).toBe(false);
    expect(await session.activate("a", save, share)).toEqual({ kind: "saved", id: "plan-a" });
    expect(share).not.toHaveBeenCalled();
  });

  it("blocks duplicate sharing while the native share sheet remains open", async () => {
    const session = new PlanSharing();
    const save = vi.fn(async () => "plan-a");
    let finish!: (result: string) => void;
    const share = vi.fn(() => new Promise<string>((resolve) => { finish = resolve; }));
    await session.activate("a", save, share);
    const first = session.activate("a", save, share);
    expect(session.reset()).toBe(false);
    expect(await session.activate("a", save, share)).toEqual({ kind: "busy" });
    expect(share).toHaveBeenCalledTimes(1);
    finish("shared");
    await first;
    expect(session.busy).toBe(false);
  });

  it("saves changed selections instead of sharing the previous plan", async () => {
    const session = new PlanSharing();
    const save = vi.fn<() => Promise<string>>().mockResolvedValueOnce("plan-a").mockResolvedValueOnce("plan-b");
    const share = vi.fn(async () => "shared");
    await session.activate("a", save, share);
    expect(session.savedId("b")).toBeNull();
    expect(await session.activate("b", save, share)).toEqual({ kind: "saved", id: "plan-b" });
    expect(share).not.toHaveBeenCalled();
    expect(session.reset()).toBe(true);
    expect(session.savedId("b")).toBeNull();
  });

  it("retains a saved plan across cancelled or rejected shares without duplicating it", async () => {
    const session = new PlanSharing();
    const save = vi.fn(async () => "plan-a");
    const share = vi.fn<() => Promise<string>>().mockResolvedValueOnce("cancelled").mockRejectedValueOnce(new Error("blocked")).mockResolvedValueOnce("copied");
    await session.activate("a", save, share);
    await session.activate("a", save, share);
    await expect(session.activate("a", save, share)).rejects.toThrow("blocked");
    expect(session.busy).toBe(false);
    expect(await session.activate("a", save, share)).toEqual({ kind: "shared", result: "copied" });
    expect(save).toHaveBeenCalledTimes(1);
  });
});
