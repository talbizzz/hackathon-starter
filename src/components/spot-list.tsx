"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useSyncExternalStore } from "react";
import { BottomSheet, halfHeight, type Snap } from "@/components/bottom-sheet";
import { LangToggle } from "@/components/lang-toggle";
import { LocationSearch } from "@/components/location-search";
import { PlanSetup, type PlanConfig } from "@/components/plan-setup";
import { ReelViewer } from "@/components/reel-viewer";
import { SpotCard } from "@/components/spot-card";
import { SpotMap, type Pin } from "@/components/spot-map";
import { Events, getAttribution, track } from "@/lib/analytics";
import type { Area } from "@/lib/areas";
import { CATEGORIES, categoryColor } from "@/lib/categories";
import { getDeviceId, uuid } from "@/lib/device";
import { env } from "@/lib/env";
import { useFavorites } from "@/lib/favorites";
import { useT } from "@/lib/i18n";
import { shareLink } from "@/lib/share";
import { isOpenNow, opensLaterToday, opensTomorrow, type Spot } from "@/lib/spots";
import { createClient } from "@/lib/supabase/client";
import { siteConfig } from "@/lib/site-config";

const FLAGS = {
  indoor: (s: Spot) => s.indoor,
  free: (s: Spot) => s.price === 0,
  cheap: (s: Spot) => s.price <= 1,
} as const;
type Flag = keyof typeof FLAGS;

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
  const router = useRouter();
  const favorites = useFavorites();
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  // Browsing by default. A plan starts from the setup screen, and only then can spots be added.
  const [plan, setPlan] = useState<PlanConfig | null>(null);
  const [setupOpen, setSetupOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const minute = useSyncExternalStore(subscribeClock, currentMinute, () => null);
  const [search, setSearch] = useState("");
  const [area, setArea] = useState<Area | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [flags, setFlags] = useState<Flag[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [picked, setPicked] = useState<string | null>(null);
  // Spots in the fullscreen video viewer, in viewing order. Null when it is closed.
  const [reel, setReel] = useState<Spot[] | null>(null);
  const [snap, setSnap] = useState<Snap>("half");
  // Pixels of the map hidden under the sheet, so pins are framed in the part that stays visible.
  const [mapInset, setMapInset] = useState(() => (typeof window === "undefined" ? 0 : halfHeight()));
  const [hint, setHint] = useState<string | null>(null);

  const now = useMemo(() => (minute === null ? null : new Date(minute * 60_000)), [minute]);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return spots.filter(
      (s) =>
        (!onlyFavorites || favorites.ids.includes(s.id)) &&
        (categories.length === 0 || categories.includes(s.category)) &&
        flags.every((f) => FLAGS[f](s)) &&
        (!query ||
          [s.name, s.neighbourhood, s.station, s.note_en, s.note_de, t(`cat.${s.category}`)].some((field) =>
            field?.toLowerCase().includes(query),
          )),
    );
  }, [spots, search, categories, flags, onlyFavorites, favorites.ids, t]);

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
    // Wait for the clock so every pin is drawn once, already in its final open or closed state.
    () =>
      !now
        ? []
        : visible
        .filter((s) => s.lat !== null && s.lng !== null)
        .map((s) => ({
          id: s.id,
          name: s.name,
          lat: s.lat!,
          lng: s.lng!,
          category: s.category,
          imageUrl: s.poster_url,
          state: selected.includes(s.id) ? "selected" : sections.openNow.includes(s) ? "open" : "closed",
          picked: picked === s.id,
        })),
    [now, visible, selected, sections, picked],
  );

  // Open the fullscreen videos on one spot; swiping continues with its neighbours, nearest first.
  function watch(start: Spot) {
    const distance = (s: Spot) =>
      s.lat === null || s.lng === null || start.lat === null || start.lng === null
        ? Infinity
        : Math.hypot(s.lat - start.lat, (s.lng - start.lng) * Math.cos((start.lat * Math.PI) / 180));
    const others = visible.filter((s) => s.id !== start.id && s.video_file_url).sort((a, b) => distance(a) - distance(b));
    setReel([start, ...others]);
  }

  function statusOf(spot: Spot) {
    if (sections.openNow.includes(spot)) return t("section.openNow");
    const later = sections.later.find((x) => x.spot === spot);
    if (later) return `${t("spot.opensAt")} ${later.at}`;
    const tomorrow = sections.tomorrow.find((x) => x.spot === spot);
    if (tomorrow) return `${t("spot.sunday")} ${tomorrow.at}`;
    return t("status.closed");
  }

  // Move the map to a part of the city. The sheet steps down if it is covering the map.
  function showArea(next: Area | null) {
    setArea(next);
    setPicked(null);
    if (snap === "full") setSnap("half");
    setMapInset(halfHeight());
    if (next) track(Events.areaPicked, { area: next.name });
  }

  function pickFromMap(id: string | null) {
    setPicked(id);
    if (!id) return;
    const wasCollapsed = snap === "peek";
    if (wasCollapsed) setSnap("half");
    // Frame the pin above a half-open sheet (fully open, the map is hidden anyway).
    setMapInset(halfHeight());
    // Wait for the sheet to open before scrolling its list to the card.
    setTimeout(() => document.getElementById(`spot-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), wasCollapsed ? 320 : 0);
  }

  function startPlan(config: PlanConfig) {
    setPlan(config);
    setSetupOpen(false);
    setSelected([]);
    setHint(null);
    track(Events.planStarted, config);
  }

  function cancelPlan() {
    setPlan(null);
    setSelected([]);
    setHint(null);
  }

  function toggleSpot(id: string) {
    if (!plan) return;
    if (!selected.includes(id) && selected.length >= plan.choices) return setHint(t("plan.max"));
    setHint(null);
    setSelected(toggled(selected, id));
  }

  // Save the plan, hand the link to the share sheet, then go to the plan page to vote.
  async function share() {
    if (!plan || sending) return;
    if (selected.length === 0) return setHint(t("plan.pickFirst"));
    track(Events.shareTapped);
    setHint(null);
    setSending(true);
    const id = uuid();
    const url = `${env.NEXT_PUBLIC_SITE_URL}/p/${id}?utm_source=share`;
    // Open the share sheet right away (it must run inside the tap) and save the plan in parallel.
    const sharing = shareLink({ title: siteConfig.name, text: t("plan.shareText"), url });
    const { error } = await createClient()
      .from("plans")
      .insert({ id, spot_ids: selected, participants: plan.participants, device_id: getDeviceId(), source: getAttribution().source });
    if (error) {
      await sharing;
      setSending(false);
      return setHint(t("plan.error"));
    }
    track(Events.planCreated, { plan_id: id, spots: selected.length, participants: plan.participants });
    // Go to the plan page to vote. Do not wait on a share sheet that stays open: it sits on top of the new page.
    const result = await Promise.race([sharing, new Promise<"open">((resolve) => setTimeout(() => resolve("open"), 1500))]);
    router.push(`/p/${id}${result === "copied" || result === "failed" ? `?s=${result}` : ""}`);
  }

  const chip = (active: boolean) =>
    `shrink-0 rounded-full border px-3 py-1.5 text-sm ${active ? "border-ink bg-ink text-white" : "border-neutral-300 bg-white"}`;

  const card = (spot: Spot, badge?: string) => (
    <SpotCard
      key={spot.id}
      spot={spot}
      badge={badge}
      highlighted={picked === spot.id}
      onWatch={spot.video_file_url ? () => watch(spot) : undefined}
      favorite={{ on: favorites.ids.includes(spot.id), toggle: () => favorites.toggle(spot.id) }}
    >
      {plan && (
        <button
          data-testid="add-to-plan"
          onClick={() => toggleSpot(spot.id)}
          className={`w-full rounded-full px-4 py-2.5 font-medium ${selected.includes(spot.id) ? "bg-brand text-white" : "border border-neutral-300"}`}
        >
          {t(selected.includes(spot.id) ? "plan.added" : "plan.add")}
        </button>
      )}
    </SpotCard>
  );

  const section = (title: string, cards: React.ReactNode[]) =>
    cards.length > 0 && (
      <>
        <h2 className="mt-6 text-base font-semibold">{title}</h2>
        <div className="mt-2 space-y-3">{cards}</div>
      </>
    );

  // The sheet's footer: an invitation to start a plan, or the plan being built.
  const footer = (
    <div data-testid="plan-bar" className="border-t border-neutral-200 bg-white px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
      {!plan ? (
        <button data-testid="start-plan" onClick={() => setSetupOpen(true)} className="w-full rounded-full bg-brand px-4 py-3 font-semibold text-white">
          {t("home.start")}
        </button>
      ) : (
        <>
          {hint && <p className="mb-2 text-center text-sm text-ink">{hint}</p>}
          <div className="flex items-center gap-3">
            <span className="shrink-0 text-sm font-medium">
              {selected.length}/{plan.choices} {t("plan.picked")}
            </span>
            <button
              data-testid="share-plan"
              onClick={share}
              disabled={sending}
              className={`flex-1 rounded-full px-4 py-3 font-semibold text-white ${selected.length > 0 ? "bg-brand" : "bg-muted"}`}
            >
              {t("plan.share")}
            </button>
          </div>
          <button data-testid="cancel-plan" onClick={cancelPlan} className="mt-2 block w-full text-center text-sm text-secondary underline">
            {t("plan.cancel")}
          </button>
        </>
      )}
    </div>
  );

  return (
    // Mobile-first: on a wide screen the app stays a phone-width column, centred on a dark backdrop.
    <div className="fixed inset-0 bg-ink">
      <div className="relative mx-auto h-full max-w-md overflow-hidden bg-neutral-200">
      <SpotMap pins={pins} onPick={pickFromMap} bottomInset={mapInset} focusId={picked} area={area} />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-[1100] flex items-center gap-2 px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <LocationSearch area={area} onPick={showArea} />
        <div className="pointer-events-auto rounded-full bg-white shadow-md">
          <LangToggle />
        </div>
      </div>

      <BottomSheet
        snap={snap}
        onSnap={setSnap}
        footer={footer}
        header={
          <>
            <div className="flex items-baseline justify-between gap-3 px-4">
              <h1 className="text-xl font-bold tracking-tight">{siteConfig.name}</h1>
              {now && (
                <p className="text-sm text-secondary">
                  {visible.length} {t(visible.length === 1 ? "sheet.spot" : "sheet.spots")} · {sections.openNow.length} {t("sheet.openNow")}
                </p>
              )}
            </div>
            <div className="mt-3 px-4">
              <input
                type="search"
                data-testid="spot-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("search.placeholder")}
                className="w-full rounded-full border border-neutral-300 bg-neutral-50 px-4 py-2.5"
              />
            </div>
            <div className="mt-3 flex gap-2 overflow-x-auto px-4 pb-3">
              <button data-testid="filter-favorites" onClick={() => setOnlyFavorites(!onlyFavorites)} className={chip(onlyFavorites)}>
                {t("filter.favs")}
              </button>
              {(Object.keys(FLAGS) as Flag[]).map((f) => (
                <button key={f} onClick={() => setFlags(toggled(flags, f))} className={chip(flags.includes(f))}>
                  {t(`filter.${f}`)}
                </button>
              ))}
              {CATEGORIES.map((c) => (
                <button key={c} onClick={() => setCategories(toggled(categories, c))} className={chip(categories.includes(c))}>
                  <span className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle" style={{ background: categoryColor(c) }} />
                  {t(`cat.${c}`)}
                </button>
              ))}
            </div>
          </>
        }
      >
        <p className="text-secondary">{t("app.tagline")}</p>
        {now && (
          <>
            {section(t("section.openNow"), sections.openNow.map((s) => card(s)))}
            {section(t("section.later"), sections.later.map(({ spot, at }) => card(spot, `${t("spot.opensAt")} ${at}`)))}
            {section(t("section.tomorrow"), sections.tomorrow.map(({ spot, at }) => card(spot, `${t("spot.sunday")} ${at}`)))}
            {section(t("section.closed"), sections.closed.map((s) => card(s)))}
            {visible.length === 0 && <p className="py-8 text-center text-sm text-secondary">{t("section.empty")}</p>}
          </>
        )}
      </BottomSheet>

      {reel && (
        <ReelViewer
          spots={reel}
          statusOf={statusOf}
          favorites={favorites}
          action={plan ? { isOn: (id) => selected.includes(id), toggle: toggleSpot, onLabel: t("plan.added"), offLabel: t("plan.add") } : undefined}
          onClose={() => setReel(null)}
        />
      )}
      {setupOpen && <PlanSetup onStart={startPlan} onClose={() => setSetupOpen(false)} />}
      </div>
    </div>
  );
}
