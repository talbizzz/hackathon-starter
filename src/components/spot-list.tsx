"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import { SiteHeader } from "@/components/site-header";
import { SpotCard } from "@/components/spot-card";
import { SpotMap, type Pin } from "@/components/spot-map";
import { Events, getAttribution, track } from "@/lib/analytics";
import { getDeviceId } from "@/lib/device";
import { env } from "@/lib/env";
import { useT } from "@/lib/i18n";
import { shareLink } from "@/lib/share";
import { isOpenNow, opensLaterToday, opensTomorrow, type Spot } from "@/lib/spots";
import { createClient } from "@/lib/supabase/client";
import { siteConfig } from "@/lib/site-config";

const CATEGORIES = {
  food: "🍜",
  drinks: "🍸",
  market: "🧺",
  culture: "🎨",
  sport: "🧗",
  outdoors: "🌳",
  nightlife: "🪩",
  other: "✨",
} as const;
type Category = keyof typeof CATEGORIES;
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
  const [search, setSearch] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [flags, setFlags] = useState<Flag[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [openVideo, setOpenVideo] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  // The plan saved for the current selection, so sharing twice does not create two plans.
  const [savedPlanId, setSavedPlanId] = useState<string | null>(null);

  const now = useMemo(() => (minute === null ? null : new Date(minute * 60_000)), [minute]);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return spots.filter(
      (s) =>
        (categories.length === 0 || categories.includes(s.category)) &&
        flags.every((f) => FLAGS[f](s)) &&
        (!query ||
          [s.name, s.neighbourhood, s.station, s.note_en, s.note_de, t(`cat.${s.category}`)].some((field) =>
            field?.toLowerCase().includes(query),
          )),
    );
  }, [spots, search, categories, flags, t]);

  // Each visible spot lands in exactly one section.
  const sections = useMemo(() => {
    const openNow: Spot[] = [];
    const later: { spot: Spot; at: string }[] = [];
    const tomorrow: { spot: Spot; at: string }[] = [];
    const closed: Spot[] = [];
    if (now)
      for (const spot of visible) {
        const laterAt = opensLaterToday(spot, now);
        const tomorrowAt = opensTomorrow(spot, now);
        if (isOpenNow(spot, now)) openNow.push(spot);
        else if (laterAt) later.push({ spot, at: laterAt });
        else if (tomorrowAt) tomorrow.push({ spot, at: tomorrowAt });
        else closed.push(spot);
      }
    const byTime = (a: { at: string }, b: { at: string }) => a.at.localeCompare(b.at);
    return { openNow, later: later.sort(byTime), tomorrow: tomorrow.sort(byTime), closed };
  }, [visible, now]);

  const pins = useMemo<Pin[]>(
    () =>
      visible
        .filter((s) => s.lat !== null && s.lng !== null)
        .map((s) => ({
          id: s.id,
          name: s.name,
          lat: s.lat!,
          lng: s.lng!,
          emoji: CATEGORIES[s.category as Category] ?? CATEGORIES.other,
          imageUrl: s.image_url,
          state: selected.includes(s.id) ? "selected" : sections.openNow.includes(s) ? "open" : "closed",
          label: picked === s.id,
        })),
    [visible, selected, sections, picked],
  );

  function pickFromMap(id: string) {
    setPicked(id);
    document.getElementById(`spot-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

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
        .insert({ id, spot_ids: selected, device_id: getDeviceId(), source: getAttribution().source });
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
      highlighted={selected.includes(spot.id) || picked === spot.id}
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

  const section = (title: string, cards: React.ReactNode[]) =>
    cards.length > 0 && (
      <>
        <h2 className="mt-7 text-sm font-semibold uppercase tracking-wide text-neutral-500">{title}</h2>
        <div className="mt-2 space-y-3">{cards}</div>
      </>
    );

  return (
    <div className="mx-auto min-h-screen max-w-md bg-neutral-50 px-4 pb-40">
      <SiteHeader />
      <p className="text-neutral-600">{t("app.tagline")}</p>

      <div className="relative isolate mt-4 h-[46vh] overflow-hidden rounded-2xl border border-neutral-200">
        <SpotMap pins={pins} onPick={pickFromMap} />
        <input
          type="search"
          data-testid="spot-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("search.placeholder")}
          className="absolute inset-x-3 top-3 z-[1000] rounded-full border border-neutral-300 bg-white px-4 py-2.5 shadow-md"
        />
      </div>

      <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1">
        {(Object.keys(FLAGS) as Flag[]).map((f) => (
          <button key={f} onClick={() => setFlags(toggled(flags, f))} className={chip(flags.includes(f))}>
            {t(`filter.${f}`)}
          </button>
        ))}
        {(Object.keys(CATEGORIES) as Category[]).map((c) => (
          <button key={c} onClick={() => setCategories(toggled(categories, c))} className={chip(categories.includes(c))}>
            {CATEGORIES[c]} {t(`cat.${c}`)}
          </button>
        ))}
      </div>

      {now && (
        <>
          {section(t("section.openNow"), sections.openNow.map((s) => card(s)))}
          {section(t("section.later"), sections.later.map(({ spot, at }) => card(spot, `${t("spot.opensAt")} ${at}`)))}
          {section(t("section.tomorrow"), sections.tomorrow.map(({ spot, at }) => card(spot, `${t("spot.sunday")} ${at}`)))}
          {section(t("section.closed"), sections.closed.map((s) => card(s)))}
          {visible.length === 0 && <p className="py-8 text-center text-sm text-neutral-500">{t("section.empty")}</p>}
        </>
      )}

      {selected.length > 0 && (
        <div data-testid="plan-bar" className="fixed inset-x-0 bottom-0 z-[1100] border-t border-neutral-200 bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
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
