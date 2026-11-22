"use client";

import { HeartButton } from "@/components/heart-button";
import { useT } from "@/lib/i18n";
import type { PlanSpot, Spot } from "@/lib/spots";

type Props = {
  spot: Spot | PlanSpot;
  /** Small label next to the name, e.g. an opening time. */
  badge?: React.ReactNode;
  /** Extra actions next to the video button (add to plan, choose). */
  children?: React.ReactNode;
  highlighted?: boolean;
  /** Opens this spot's video fullscreen. */
  onWatch?: () => void;
  favorite?: { on: boolean; toggle: () => void };
};

const playIcon = (
  <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden>
    <path d="M8 5v14l11-7z" />
  </svg>
);

export function SpotCard({ spot, badge, children, highlighted, onWatch, favorite }: Props) {
  const { t, lang } = useT();
  const price = spot.price === 0 ? t("price.free") : "€".repeat(spot.price);
  const note = lang === "de" ? (spot.note_de ?? spot.note_en) : (spot.note_en ?? spot.note_de);
  const meta = [t(`cat.${spot.category}`), spot.neighbourhood, spot.station, price].filter(Boolean).join(" · ");

  return (
    <article
      id={`spot-${spot.id}`}
      data-testid="spot-card"
      className={`scroll-mt-2 rounded-2xl border bg-white p-4 ${highlighted ? "border-ink ring-2 ring-ink" : "border-neutral-200"}`}
    >
      <div className="flex gap-3">
        {/* The still from the video doubles as a second way to open it. */}
        <button
          onClick={onWatch}
          disabled={!onWatch}
          aria-label={`${t("card.video")}: ${spot.name}`}
          className="relative aspect-[9/16] w-16 shrink-0 overflow-hidden rounded-xl bg-ink text-white"
        >
          {spot.poster_url && (
            // eslint-disable-next-line @next/next/no-img-element -- small remote still, served as is
            <img src={spot.poster_url} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
          )}
          {onWatch && (
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-black/55">{playIcon}</span>
            </span>
          )}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-1">
            <h3 className="pt-1.5 font-semibold">{spot.name}</h3>
            {favorite && <HeartButton on={favorite.on} onClick={favorite.toggle} />}
          </div>
          {badge && <span className="inline-block rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium">{badge}</span>}
          <p className="mt-0.5 text-sm text-secondary">{meta}</p>
          {note && <p className="mt-1.5 line-clamp-2 text-sm text-ink">{note}</p>}
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        {onWatch && (
          <button data-testid="watch-video" onClick={onWatch} className="flex items-center gap-1.5 rounded-full border border-neutral-300 px-4 py-2.5 font-medium">
            {playIcon}
            {t("card.video")}
          </button>
        )}
        {children && <div className="flex-1">{children}</div>}
      </div>
    </article>
  );
}
