"use client";

import { useEffect, useRef } from "react";
import { LangToggle } from "@/components/lang-toggle";
import { Logo } from "@/components/logo";
import { Events, track } from "@/lib/analytics";
import { FIRST_AREAS, type FirstArea, type FirstScreenSpot } from "@/lib/first-screen";
import { useT } from "@/lib/i18n";

const WATCHED_MS = 2000; // "first_video_viewed": the first video has been playing this long

// What a new visitor sees first: autoplaying Berlin spots, one headline, one question. No login, no map yet.
export function FirstScreen({ cards, onPick }: { cards: FirstScreenSpot[]; onPick: (area: FirstArea) => void }) {
  const { t } = useT();
  const videos = useRef(new Map<string, HTMLVideoElement>());
  const reported = useRef(false);

  useEffect(() => {
    const els = [...videos.current.values()];
    const timers = new Map<HTMLVideoElement, ReturnType<typeof setTimeout>>();
    const started = performance.now();
    const clear = (el: HTMLVideoElement) => {
      clearTimeout(timers.get(el));
      timers.delete(el);
    };
    const cleanups: (() => void)[] = [];

    for (const el of els) {
      el.muted = true; // iOS only autoplays what is muted before play() is called
      const onPlaying = () => {
        if (reported.current || timers.has(el)) return;
        timers.set(
          el,
          setTimeout(() => {
            if (reported.current) return;
            reported.current = true;
            track(Events.firstVideoViewed, { spot_id: el.dataset.spot, ms_since_load: Math.round(performance.now() - started) });
          }, WATCHED_MS),
        );
      };
      const onStop = () => clear(el);
      el.addEventListener("playing", onPlaying);
      el.addEventListener("pause", onStop);
      el.addEventListener("waiting", onStop);
      el.addEventListener("ended", onStop);
      cleanups.push(() => {
        el.removeEventListener("playing", onPlaying);
        el.removeEventListener("pause", onStop);
        el.removeEventListener("waiting", onStop);
        el.removeEventListener("ended", onStop);
        clear(el);
      });
    }

    // Only the cards on screen play, so a slow connection is not asked for five videos at once.
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const el = e.target as HTMLVideoElement;
          if (e.isIntersecting && !reduce) el.play().catch(() => {});
          else el.pause();
        }
      },
      { threshold: 0.6 },
    );
    els.forEach((el) => observer.observe(el));
    return () => {
      observer.disconnect();
      cleanups.forEach((fn) => fn());
    };
  }, []);

  return (
    <div data-testid="first-screen" className="absolute inset-0 z-[1200] flex flex-col overflow-y-auto bg-ink text-white pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))]">
      <div className="flex items-center justify-between px-4">
        <Logo />
        <div className="rounded-full bg-white text-ink">
          <LangToggle />
        </div>
      </div>

      <h1 className="mt-4 text-balance px-4 text-[1.75rem] font-bold leading-tight tracking-tight">{t("fs.h1")}</h1>

      <div data-testid="first-screen-videos" className="mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {cards.map(({ spot, kind, poster }, i) => (
          <figure key={spot.id} className="relative aspect-[9/16] w-[52vw] max-w-56 shrink-0 snap-start overflow-hidden rounded-2xl bg-neutral-800">
            <video
              ref={(el) => {
                if (el) videos.current.set(spot.id, el);
                else videos.current.delete(spot.id);
              }}
              data-testid="first-screen-video"
              data-spot={spot.id}
              src={spot.video_file_url ?? undefined}
              poster={poster ?? undefined}
              aria-label={spot.name}
              autoPlay={i < 2}
              muted
              loop
              playsInline
              // The two cards in view fetch right away; the rest wait until they scroll in.
              preload={i < 2 ? "auto" : "none"}
              className="absolute inset-0 h-full w-full object-cover"
            />
            <figcaption className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2.5 pb-2.5 pt-10">
              <span className="rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-semibold text-ink">{t(`fs.kind.${kind}`)}</span>
              <p className="mt-1 line-clamp-2 text-sm font-semibold leading-snug">{spot.name}</p>
            </figcaption>
          </figure>
        ))}
      </div>

      <div className="mt-auto px-4 pt-5">
        <h2 className="text-lg font-semibold">{t("fs.pick")}</h2>
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          {FIRST_AREAS.map((area) => (
            <button
              key={area}
              data-testid={`area-${area}`}
              onClick={() => onPick(area)}
              className={`min-h-14 rounded-full px-4 text-lg font-semibold active:scale-[0.98] ${area === "Other" ? "border-2 border-white/60 text-white" : "bg-brand text-white"}`}
            >
              {area === "Other" ? t("fs.other") : area}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
