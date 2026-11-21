"use client";

import { useEffect, useRef, useState } from "react";
import { Events, track } from "@/lib/analytics";
import { useT } from "@/lib/i18n";
import type { Spot } from "@/lib/spots";

type Props = {
  /** In viewing order: the opened spot first, then its neighbours by distance. */
  spots: Spot[];
  /** Short status per spot, e.g. "Open now" or "Opens at 10:00". */
  statusOf: (spot: Spot) => string | undefined;
  selected: string[];
  onToggle: (id: string) => void;
  onClose: () => void;
};

const icon = "h-6 w-6 fill-none stroke-current stroke-2";

// Fullscreen videos, one spot per screen. Swipe up or down to move between neighbouring spots.
// The video on screen plays (with sound where the browser allows it); the others are paused.
export function ReelViewer({ spots, statusOf, selected, onToggle, onClose }: Props) {
  const { t, lang } = useT();
  const scroller = useRef<HTMLDivElement>(null);
  const videos = useRef(new Map<string, HTMLVideoElement>());
  const counted = useRef(new Set<string>());
  const [active, setActive] = useState(spots[0]?.id);
  const [muted, setMuted] = useState(false);
  const [paused, setPaused] = useState(false);

  // The spot filling most of the screen is the active one.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const id = (entries.find((e) => e.isIntersecting)?.target as HTMLElement | undefined)?.dataset.spot;
        if (id) {
          setActive(id);
          setPaused(false);
        }
      },
      { root: scroller.current, threshold: 0.6 },
    );
    scroller.current?.querySelectorAll("[data-spot]").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    for (const [id, video] of videos.current) {
      if (id !== active) {
        video.pause();
        video.currentTime = 0;
        continue;
      }
      if (paused) {
        video.pause();
        continue;
      }
      video.muted = muted;
      video.play().catch(() => {
        // Browsers refuse sound without a direct tap on some devices: start silent, the sound button turns it on.
        video.muted = true;
        setMuted(true);
        video.play().catch(() => {});
      });
      if (!counted.current.has(id)) {
        counted.current.add(id);
        track(Events.videoPlayed, { spot_id: id });
      }
    }
  }, [active, muted, paused]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const round = "flex h-11 w-11 items-center justify-center rounded-full bg-black/50 text-white";

  return (
    <div data-testid="reel-viewer" className="absolute inset-0 z-[1200] bg-black text-white">
      <div ref={scroller} className="h-full snap-y snap-mandatory overflow-y-auto overscroll-contain [scrollbar-width:none]">
        {spots.map((spot, index) => {
          const inPlan = selected.includes(spot.id);
          const note = lang === "de" ? (spot.note_de ?? spot.note_en) : (spot.note_en ?? spot.note_de);
          const price = spot.price === 0 ? t("price.free") : "€".repeat(spot.price);
          const status = statusOf(spot);
          return (
            <section key={spot.id} data-spot={spot.id} data-testid="reel-item" className="relative h-full snap-start snap-always">
              <video
                ref={(el) => {
                  if (el) videos.current.set(spot.id, el);
                  else videos.current.delete(spot.id);
                }}
                src={spot.video_file_url ?? undefined}
                poster={spot.poster_url ?? undefined}
                // Only the spot on screen downloads its video; the others show their still until swiped to.
                preload={spot.id === active ? "auto" : "none"}
                loop
                playsInline
                onClick={() => setPaused(!paused)}
                className="absolute inset-0 h-full w-full object-cover"
              />
              {paused && spot.id === active && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <svg viewBox="0 0 24 24" className="h-20 w-20 fill-white/80">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              )}
              {/* A dark fade so the white text stays readable on any video. */}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/50 to-transparent px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-24">
                <h2 className="text-2xl font-bold tracking-tight">{spot.name}</h2>
                <p className="mt-1 text-sm text-white/85">
                  {[status, t(`cat.${spot.category}`), spot.neighbourhood, price].filter(Boolean).join(" · ")}
                </p>
                {note && <p className="mt-2 text-sm">{note}</p>}
                {(spot.creator_handle || spot.venue_handle) && (
                  <p className="mt-2 text-xs text-white/70">
                    {[spot.creator_handle && `${t("video.by")}: @${spot.creator_handle}`, spot.venue_handle && spot.venue_handle !== spot.creator_handle && `@${spot.venue_handle}`]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                )}
                <button
                  data-testid="reel-add"
                  onClick={() => onToggle(spot.id)}
                  className={`pointer-events-auto mt-4 w-full rounded-full px-4 py-3 font-semibold ${inPlan ? "bg-white text-black" : "border-2 border-white text-white"}`}
                >
                  {t(inPlan ? "plan.added" : "plan.add")}
                </button>
                {index === 0 && spots.length > 1 && <p className="mt-3 text-center text-xs text-white/70">{t("reel.swipe")}</p>}
              </div>
            </section>
          );
        })}
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button data-testid="reel-close" onClick={onClose} aria-label={t("reel.close")} className={`pointer-events-auto ${round}`}>
          <svg viewBox="0 0 24 24" className={icon}>
            <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
          </svg>
        </button>
        <button
          data-testid="reel-sound"
          onClick={() => setMuted(!muted)}
          aria-label={t(muted ? "reel.soundOn" : "reel.soundOff")}
          className={`pointer-events-auto ${round}`}
        >
          <svg viewBox="0 0 24 24" className={icon}>
            <path d="M4 9v6h4l5 4V5L8 9H4z" strokeLinejoin="round" />
            {muted ? <path d="M17 9l5 6M22 9l-5 6" strokeLinecap="round" /> : <path d="M17 8.5a5 5 0 010 7" strokeLinecap="round" />}
          </svg>
        </button>
      </div>
    </div>
  );
}
