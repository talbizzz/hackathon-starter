"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore, useTransition } from "react";
import { SiteHeader } from "@/components/site-header";
import { SpotCard } from "@/components/spot-card";
import { Events, getAttribution, track } from "@/lib/analytics";
import { getDeviceId } from "@/lib/device";
import { env } from "@/lib/env";
import { useT } from "@/lib/i18n";
import { shareLink } from "@/lib/share";
import { PlanSharing } from "@/lib/plan-sharing";
import { discoverSpots, type SpotFlag } from "@/lib/spot-discovery";
import type { Spot } from "@/lib/spots";
import { setStored, useStored } from "@/lib/stored";
import { createClient } from "@/lib/supabase/client";
import { siteConfig } from "@/lib/site-config";

const HOODS = ["neukoelln", "kreuzberg"] as const;
const CATEGORIES = ["food", "drinks", "market", "culture", "sport", "outdoors", "nightlife", "other"] as const;
const FLAGS: SpotFlag[] = ["indoor", "free", "cheap"];
type Flag = SpotFlag;
const MAX_SPOTS = 3;

// The current minute, null on the server so opening hours are only evaluated in the browser.
const subscribeClock = (tick: () => void) => {
  const id = setInterval(tick, 30_000);
  return () => clearInterval(id);
};
const currentMinute = () => Math.floor(Date.now() / 60_000);

function toggled<T>(list: T[], item: T) {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}

export function SpotList({ spots, loadError = false }: { spots: Spot[]; loadError?: boolean }) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const { t } = useT();
  const minute = useSyncExternalStore(subscribeClock, currentMinute, () => null);
  const hood = useStored("hood") === "kreuzberg" ? "kreuzberg" : "neukoelln";
  const [categories, setCategories] = useState<string[]>([]);
  const [flags, setFlags] = useState<Flag[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [openVideo, setOpenVideo] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [sharingSession] = useState(() => new PlanSharing());
  const [pending, setPending] = useState<"saving" | "sharing" | null>(null);
  const selectionKey = JSON.stringify([hood, selected]);
  const savedPlanId = sharingSession.savedId(selectionKey);

  const now = minute === null ? null : new Date(minute * 60_000);
  const { inventory, visible, openNow, later, tomorrow } = discoverSpots(spots, hood, categories, flags, now);
  const hasFilters = categories.length > 0 || flags.length > 0;
  const noUpcoming = now && visible.length > 0 && openNow.length + later.length + tomorrow.length === 0;

  function toggleSpot(id: string) {
    if (sharingSession.busy) return;
    if (!selected.includes(id) && selected.length >= MAX_SPOTS) return setHint(t("plan.max"));
    setHint(null);
    sharingSession.reset();
    setSelected(toggled(selected, id));
  }

  async function share() {
    if (sharingSession.busy || selected.length === 0) return;
    setHint(null);
    setPending(savedPlanId ? "sharing" : "saving");
    try {
      const result = await sharingSession.activate(
        selectionKey,
        async () => {
          const id = crypto.randomUUID();
          const { error } = await createClient()
            .from("plans")
            .insert({ id, spot_ids: [...selected], device_id: getDeviceId(), neighbourhood: hood, source: getAttribution().source });
          if (error) throw error;
          return id;
        },
        (id) => {
          track(Events.shareTapped, { plan_id: id });
          const url = `${env.NEXT_PUBLIC_SITE_URL}/p/${id}?utm_source=share`;
          return shareLink({ title: siteConfig.name, text: t("plan.shareText"), url });
        },
      );
      if (result.kind === "saved") {
        track(Events.planCreated, { plan_id: result.id, spots: selected.length });
        setHint(t("plan.ready"));
      }
      if (result.kind === "shared" && result.result === "copied") setHint(t("plan.copied"));
      if (result.kind === "shared" && result.result === "failed") setHint(t("share.failed"));
    } catch {
      setHint(t(savedPlanId ? "share.failed" : "plan.error"));
    } finally {
      setPending(null);
    }
  }

  const chip = (active: boolean) =>
    `shrink-0 rounded-full border px-3 py-1.5 text-sm ${active ? "border-black bg-black text-white" : "border-neutral-300 bg-white"}`;

  const card = (spot: Spot, badge?: string) => (
    <SpotCard
      key={spot.id}
      spot={spot}
      badge={badge}
      highlighted={selected.includes(spot.id)}
      videoOpen={openVideo === spot.id}
      onOpenVideo={() => setOpenVideo(spot.id)}
    >
      <button
        data-testid="add-to-plan"
        disabled={pending !== null}
        onClick={() => toggleSpot(spot.id)}
        className={`w-full rounded-lg px-4 py-2.5 font-medium disabled:opacity-60 ${selected.includes(spot.id) ? "bg-black text-white" : "border border-neutral-300"}`}
      >
        {t(selected.includes(spot.id) ? "plan.added" : "plan.add")}
      </button>
    </SpotCard>
  );

  return (
    <div className="mx-auto min-h-screen max-w-md bg-neutral-50 px-4 pb-40">
      <SiteHeader />
      <p className="text-neutral-600">{t("app.tagline")}</p>

      <div data-testid="hood-switch" className="mt-5 grid grid-cols-2 gap-1 rounded-xl bg-neutral-200 p-1">
        {HOODS.map((h) => (
          <button
            key={h}
            disabled={pending !== null}
            aria-pressed={hood === h}
            onClick={() => {
              if (sharingSession.busy || h === hood) return;
              sharingSession.reset();
              setSelected([]);
              setHint(null);
              setStored("hood", h);
            }}
            className={`rounded-lg py-2 font-medium disabled:opacity-60 ${hood === h ? "bg-white shadow-sm" : "text-neutral-600"}`}
          >
            {t(`hood.${h}`)}
          </button>
        ))}
      </div>

      <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1">
        {FLAGS.map((f) => (
          <button key={f} aria-pressed={flags.includes(f)} onClick={() => setFlags(toggled(flags, f))} className={chip(flags.includes(f))}>
            {t(`filter.${f}`)}
          </button>
        ))}
        {CATEGORIES.map((c) => (
          <button key={c} aria-pressed={categories.includes(c)} onClick={() => setCategories(toggled(categories, c))} className={chip(categories.includes(c))}>
            {t(`cat.${c}`)}
          </button>
        ))}
      </div>

      {hasFilters && (
        <button className="mt-3 text-sm underline" onClick={() => { setCategories([]); setFlags([]); }}>
          {t("filter.clear")}
        </button>
      )}

      {loadError ? (
        <div role="alert" className="mt-6 rounded-xl border border-neutral-300 bg-white p-4">
          <p>{t("section.loadError")}</p>
          <button className="mt-3 rounded-lg bg-black px-4 py-2 text-white disabled:opacity-60" disabled={refreshing} aria-busy={refreshing} onClick={() => startRefresh(() => router.refresh())}>
            {t(refreshing ? "vote.loading" : "action.retry")}
          </button>
        </div>
      ) : inventory.length === 0 ? (
        <p role="status" className="mt-6 text-sm text-neutral-600">{t("section.noInventory")}</p>
      ) : visible.length === 0 ? (
        <p role="status" className="mt-6 text-sm text-neutral-600">{t("section.empty")}</p>
      ) : !now ? (
        <p role="status" className="mt-6 text-sm text-neutral-600">{t("vote.loading")}</p>
      ) : (

        <>
          {tomorrow.length > 0 && <a href="#tomorrow" className="mt-5 inline-block text-sm underline">{t("section.browseTomorrow")} ({tomorrow.length})</a>}
          <h2 className="mt-6 text-sm font-semibold uppercase tracking-wide text-neutral-500">{t("section.openNow")}</h2>
          <div className="mt-2 space-y-3">
            {openNow.map((s) => card(s))}
            {openNow.length === 0 && <p className="py-4 text-sm text-neutral-500">{t("section.noneOpen")}</p>}
          </div>

          {later.length > 0 && (
            <>
              <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-neutral-500">{t("section.later")}</h2>
              <div className="mt-2 space-y-3">{later.map(({ spot, at }) => card(spot, `${t("spot.opensAt")} ${at}`))}</div>
            </>
          )}

          {noUpcoming && (
            <div className="mt-4">
              <p role="status" className="text-sm text-neutral-600">{t("section.noUpcoming")}</p>
              <details className="mt-3">
                <summary className="cursor-pointer text-sm underline">{t("section.browseAll")}</summary>
                <div className="mt-3 space-y-3">{visible.map((s) => card(s, t("spot.checkHours")))}</div>
              </details>
            </div>
          )}

          {tomorrow.length > 0 && (
            <>
              <h2 id="tomorrow" className="mt-8 text-sm font-semibold uppercase tracking-wide text-neutral-500">{t("section.tomorrow")}</h2>
              <div className="mt-2 space-y-3">{tomorrow.map(({ spot, at }) => card(spot, `${t("spot.sunday")} ${at}`))}</div>
            </>
          )}
        </>
      )}

      {selected.length > 0 && (
        <div data-testid="plan-bar" className="fixed inset-x-0 bottom-0 border-t border-neutral-200 bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
          <div className="mx-auto max-w-md">
            <p role="status" className="mb-2 text-center text-sm text-neutral-700">{hint}</p>
            <div className="flex items-center gap-3">
              <span className="shrink-0 text-sm font-medium">
                {selected.length}/{MAX_SPOTS} {t("plan.picked")}
              </span>
              <button data-testid="share-plan" onClick={share} disabled={pending !== null} aria-busy={pending !== null} className="flex-1 rounded-lg bg-black px-4 py-3 font-medium text-white disabled:opacity-60">
                {t(pending === "saving" ? "plan.saving" : pending === "sharing" ? "plan.sharing" : savedPlanId ? "plan.share" : "plan.save")}
              </button>
            </div>
            {savedPlanId && (
              <Link href={`/p/${savedPlanId}`} className="mt-2 block text-center text-sm font-medium underline">
                {t("plan.view")}
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
