"use client";

import { useT } from "@/lib/i18n";

/** Save or unsave a spot. `onDark` is for use over a video. */
export function HeartButton({ on, onClick, onDark }: { on: boolean; onClick: () => void; onDark?: boolean }) {
  const { t } = useT();
  return (
    <button
      data-testid="favorite"
      aria-pressed={on}
      aria-label={t(on ? "fav.remove" : "fav.add")}
      onClick={onClick}
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${onDark ? "bg-black/50 text-white" : "text-ink"}`}
    >
      <svg viewBox="0 0 24 24" className={`h-6 w-6 stroke-2 ${on ? "fill-brand stroke-brand" : "fill-none stroke-current"}`}>
        <path d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.600-7.5 10.2-7.5 10.2z" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
