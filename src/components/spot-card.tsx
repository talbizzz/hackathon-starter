"use client";

import { VideoPlayer } from "@/components/video-player";
import { useT } from "@/lib/i18n";
import type { PlanSpot, Spot } from "@/lib/spots";

type Props = {
  spot: Spot | PlanSpot;
  /** Small label next to the name, e.g. an opening time or "Leading". */
  badge?: React.ReactNode;
  /** Action area under the video (add to plan, vote, directions). */
  children?: React.ReactNode;
  highlighted?: boolean;
};

export function SpotCard({ spot, badge, children, highlighted }: Props) {
  const { t, lang } = useT();
  const price = spot.price === 0 ? t("price.free") : "€".repeat(spot.price);
  const note = lang === "de" ? (spot.note_de ?? spot.note_en) : (spot.note_en ?? spot.note_de);
  return (
    <article id={`spot-${spot.id}`} data-testid="spot-card" className={`scroll-mt-2 rounded-2xl border bg-white p-4 ${highlighted ? "border-black" : "border-neutral-200"}`}>
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold">{spot.name}</h3>
        {badge && <span className="shrink-0 rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium">{badge}</span>}
      </div>
      <p className="mt-0.5 text-sm text-neutral-500">
        {[t(`cat.${spot.category}`), spot.neighbourhood, spot.station, price].filter(Boolean).join(" · ")}
      </p>
      {note && <p className="mt-2 text-sm text-neutral-700">{note}</p>}
      <VideoPlayer spot={spot} />
      {children && <div className="mt-3">{children}</div>}
    </article>
  );
}
