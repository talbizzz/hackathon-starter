"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { SiteHeader } from "@/components/site-header";
import { SpotCard } from "@/components/spot-card";
import { Events, getAttribution, track } from "@/lib/analytics";
import { getDeviceId } from "@/lib/device";
import { env } from "@/lib/env";
import { useT } from "@/lib/i18n";
import { shareLink } from "@/lib/share";
import { isOpenNow, opensLaterToday, opensTomorrow, type Spot } from "@/lib/spots";
import { setStored, useStored } from "@/lib/stored";
import { createClient } from "@/lib/supabase/client";
import { siteConfig } from "@/lib/site-config";

const HOODS = ["neukoelln", "kreuzberg"] as const;
const CATEGORIES = ["food", "drinks", "market", "culture", "sport", "outdoors", "nightlife", "other"] as const;
const FLAGS = {
  indoor: (s: Spot) => s.indoor,
  free: (s: Spot) => s.price === 0,
  cheap: (s: Spot) => s.price <= 1,
} as const;
type Flag = keyof typeof FLAGS;
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

export function SpotList({ spots }: { spots: Spot[] }) {
  const { t } = useT();
  const minute = useSyncExternalStore(subscribeClock, currentMinute, () => null);
  const hood = useStored("hood") === "kreuzberg" ? "kreuzberg" : "neukoelln";
  const [categories, setCategories] = useState<string[]>([]);
  const [flags, setFlags] = useState<Flag[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [openVideo, setOpenVideo] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  // The plan saved for the current selection, so sharing twice does not create two plans.
  const [savedPlanId, setSavedPlanId] = useState<string | null>(null);

  const now = minute === null ? null : new Date(minute * 60_000);
  const visible = spots.filter(
    (s) =>
      s.neighbourhood === hood &&
      (categories.length === 0 || categories.includes(s.category)) &&
      flags.every((f) => FLAGS[f](s)),
  );
  const openNow = now ? visible.filter((s) => isOpenNow(s, now)) : [];
  const later = now
    ? visible
        .map((spot) => ({ spot, at: opensLaterToday(spot, now) }))
        .filter((x): x is { spot: Spot; at: string } => x.at !== null)
        .sort((a, b) => a.at.localeCompare(b.at))
    : [];
  // Saturday only: what opens on Sunday, so tomorrow can be planned tonight. Spots already listed above are left out.
  const tomorrow = now
    ? visible
        .filter((s) => !openNow.includes(s) && !later.some((l) => l.spot === s))
        .map((spot) => ({ spot, at: opensTomorrow(spot, now) }))
        .filter((x): x is { spot: Spot; at: string } => x.at !== null)
        .sort((a, b) => a.at.localeCompare(b.at))
    : [];

  function toggleSpot(id: string) {
    if (!selected.includes(id) && selected.length >= MAX_SPOTS) return setHint(t("plan.max"));
    setHint(null);
    setSavedPlanId(null);
    setSelected(toggled(selected, id));
  }

  async function share() {
    track(Events.shareTapped);
    setHint(null);
    const id = savedPlanId ?? crypto.randomUUID();
    const url = `${env.NEXT_PUBLIC_SITE_URL}/p/${id}?utm_source=share`;
    // Open the share sheet right away (it must run inside the tap) and save the plan in parallel.
    const sharing = shareLink({ title: siteConfig.name, text: t("plan.shareText"), url });
    if (!savedPlanId) {
      const { error } = await createClient()
        .from("plans")
        .insert({ id, spot_ids: selected, device_id: getDeviceId(), neighbourhood: hood, source: getAttribution().source });
      if (error) {
        await sharing;
        return setHint(t("plan.error"));
      }
      track(Events.planCreated, { plan_id: id, spots: selected.length });
      setSavedPlanId(id);
    }
    const result = await sharing;
    if (result === "copied") setHint(t("plan.copied"));
    if (result === "failed") setHint(t("share.failed"));
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
        onClick={() => toggleSpot(spot.id)}
        className={`w-full rounded-lg px-4 py-2.5 font-medium ${selected.includes(spot.id) ? "bg-black text-white" : "border border-neutral-300"}`}
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
            onClick={() => setStored("hood", h)}
            className={`rounded-lg py-2 font-medium ${hood === h ? "bg-white shadow-sm" : "text-neutral-600"}`}
          >
            {t(`hood.${h}`)}
          </button>
        ))}
      </div>

      <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1">
        {(Object.keys(FLAGS) as Flag[]).map((f) => (
          <button key={f} onClick={() => setFlags(toggled(flags, f))} className={chip(flags.includes(f))}>
            {t(`filter.${f}`)}
          </button>
        ))}
        {CATEGORIES.map((c) => (
          <button key={c} onClick={() => setCategories(toggled(categories, c))} className={chip(categories.includes(c))}>
            {t(`cat.${c}`)}
          </button>
        ))}
      </div>

      {now && (
        <>
          <h2 className="mt-6 text-sm font-semibold uppercase tracking-wide text-neutral-500">{t("section.openNow")}</h2>
          <div className="mt-2 space-y-3">
            {openNow.map((s) => card(s))}
            {openNow.length === 0 && <p className="py-4 text-sm text-neutral-500">{t("section.empty")}</p>}
          </div>

          {later.length > 0 && (
            <>
              <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-neutral-500">{t("section.later")}</h2>
              <div className="mt-2 space-y-3">{later.map(({ spot, at }) => card(spot, `${t("spot.opensAt")} ${at}`))}</div>
            </>
          )}

          {tomorrow.length > 0 && (
            <>
              <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-neutral-500">{t("section.tomorrow")}</h2>
              <div className="mt-2 space-y-3">{tomorrow.map(({ spot, at }) => card(spot, `${t("spot.sunday")} ${at}`))}</div>
            </>
          )}
        </>
      )}

      {selected.length > 0 && (
        <div data-testid="plan-bar" className="fixed inset-x-0 bottom-0 border-t border-neutral-200 bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
          <div className="mx-auto max-w-md">
            {hint && <p className="mb-2 text-center text-sm text-neutral-700">{hint}</p>}
            <div className="flex items-center gap-3">
              <span className="shrink-0 text-sm font-medium">
                {selected.length}/{MAX_SPOTS} {t("plan.picked")}
              </span>
              <button data-testid="share-plan" onClick={share} className="flex-1 rounded-lg bg-black px-4 py-3 font-medium text-white">
                {t("plan.share")}
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
