"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { LangToggle } from "@/components/lang-toggle";
import { Logo, LogoMark } from "@/components/logo";
import { Events, track } from "@/lib/analytics";
import { useT } from "@/lib/i18n";
import { siteConfig } from "@/lib/site-config";

const START = "/map?plan=new"; // the app, opened on the "start a plan" screen
const BROWSE = "/map";

// One button, used three times. Large, solid brand colour: it is the only thing on the page that looks like this.
function StartButton({ where, className }: { where: string; className: string }) {
  const { t } = useT();
  return (
    <Link
      href={START}
      data-testid={`cta-${where}`}
      onClick={() => track(Events.ctaClicked, { where })}
      className={`items-center justify-center rounded-full bg-brand font-bold text-white transition-colors hover:bg-[#c2335d] focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-ink active:scale-[0.98] ${className}`}
    >
      {t("land.cta")}
    </Link>
  );
}

function BrowseLink() {
  const { t } = useT();
  return (
    <Link href={BROWSE} data-testid="browse-link" onClick={() => track(Events.ctaClicked, { where: "browse" })} className="inline-block text-lg font-medium underline underline-offset-4">
      {t("land.browse")}
    </Link>
  );
}

// The picture next to the headline. To change it, replace the files in public/landing/ or edit this one constant.
//   kind "video": a muted, looping clip. It behaves like a GIF but is about ten times smaller. MP4 (H.264) plays everywhere.
//     Keep the file at public/landing/hero.mp4 (src/app/media/hero.mp4/route.ts serves it); for another file name, change FILE there.
//   kind "image": any GIF, PNG or JPG photo. Keep a GIF under about 2 MB so it loads quickly inside Instagram.
// The frame is portrait (about 9:19) and crops the file to fit, so portrait files work best.
const HERO_MEDIA: { kind: "video" | "image"; src: string; poster?: string } = {
  kind: "video",
  src: "/media/hero.mp4", // served by src/app/media/hero.mp4/route.ts from public/landing/hero.mp4 (range requests, for iPhones)
  poster: "/landing/hero-poster.jpg",
};

function HeroMedia() {
  const { t } = useT();
  const video = useRef<HTMLVideoElement>(null);

  // People who ask for less motion get a still: the last frame, which shows the result.
  useEffect(() => {
    const el = video.current;
    if (!el || !window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    el.pause();
    const showEnd = () => {
      el.currentTime = Math.max(0, el.duration - 0.5);
    };
    if (el.readyState >= 1) showEnd();
    else el.addEventListener("loadedmetadata", showEnd, { once: true });
  }, []);

  return (
    <div className="mx-auto aspect-[390/844] w-[260px] shrink-0 overflow-hidden rounded-[2rem] border border-neutral-200 bg-neutral-100 md:mx-0 md:w-[300px]">
      {HERO_MEDIA.kind === "video" ? (
        <video
          ref={video}
          data-testid="hero-media"
          src={HERO_MEDIA.src}
          poster={HERO_MEDIA.poster}
          aria-label={t("land.hero.alt")}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          className="h-full w-full object-cover"
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- a GIF must not be re-encoded by the image optimiser
        <img data-testid="hero-media" src={HERO_MEDIA.src} alt={t("land.hero.alt")} className="h-full w-full object-cover" />
      )}
    </div>
  );
}

// What the result screen looks like, with made-up spots and votes. Clearly labelled as an example.
function ExampleResult() {
  const { t } = useT();
  const rows = [
    { name: t("land.ex.a"), votes: 3 },
    { name: t("land.ex.b"), votes: 1 },
    { name: t("land.ex.c"), votes: 0 },
  ];
  return (
    <figure className="mt-10 rounded-3xl bg-neutral-100 p-5 sm:p-7">
      <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold">{t("land.example")}</span>
      <p className="mt-4 text-2xl font-bold tracking-tight">
        {t("status.decided")}: {rows[0].name}
      </p>
      <p className="mt-1 text-neutral-600">
        4 {t("vote.of")} 4 {t("vote.haveVoted")}
      </p>
      <ul className="mt-5 space-y-3">
        {rows.map((r) => (
          <li key={r.name} className="rounded-2xl bg-white p-4">
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-semibold">{r.name}</span>
              <span className="shrink-0 tabular-nums">
                {r.votes} {t(r.votes === 1 ? "vote.vote" : "vote.votes")}
              </span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-neutral-100">
              <div className="h-2 rounded-full bg-brand" style={{ width: `${(r.votes / 4) * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
      <figcaption className="mt-4 text-neutral-600">{t("land.ex.caption")}</figcaption>
    </figure>
  );
}

export function Landing() {
  const { t } = useT();
  const steps = [1, 2, 3];
  const facts = [1, 2, 3, 4];
  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-20 bg-white">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5">
          <Link href="/" aria-label={siteConfig.name}>
            <Logo />
          </Link>
          <div className="flex items-center gap-2">
            <LangToggle />
            <StartButton where="header" className="hidden h-11 px-5 text-[15px] min-[380px]:inline-flex" />
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-5xl items-center gap-10 px-5 pb-16 pt-10 md:grid-cols-[1fr_auto] md:gap-16 md:pb-24 md:pt-14">
          <div>
            <h1 className="text-balance text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">{t("land.h1")}</h1>
            <p className="mt-5 text-lg leading-relaxed text-neutral-700 sm:text-xl">{t("land.sub")}</p>
            <div className="mt-8">
              <StartButton where="hero" className="inline-flex h-16 w-full px-10 text-xl sm:w-auto" />
            </div>
            <p className="mt-4 text-neutral-600">{t("land.note")}</p>
            <div className="mt-4">
              <BrowseLink />
            </div>
          </div>
          <HeroMedia />
        </section>

        <div className="mx-auto max-w-3xl px-5">
        <section aria-labelledby="how">
          <h2 id="how" className="text-3xl font-bold tracking-tight">
            {t("land.how")}
          </h2>
          <ol className="mt-8 space-y-8">
            {steps.map((n) => (
              <li key={n} className="flex gap-4">
                <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink text-lg font-bold text-white">
                  {n}
                </span>
                <div>
                  <h3 className="text-xl font-semibold">{t(`land.s${n}.t`)}</h3>
                  <p className="mt-1 text-lg leading-relaxed text-neutral-700">{t(`land.s${n}.b`)}</p>
                </div>
              </li>
            ))}
          </ol>
          <ExampleResult />
        </section>

        <section aria-labelledby="good" className="mt-20">
          <h2 id="good" className="text-3xl font-bold tracking-tight">
            {t("land.good")}
          </h2>
          <ul className="mt-6 space-y-5">
            {facts.map((n) => (
              <li key={n} className="text-lg leading-relaxed">
                <span className="font-semibold">{t(`land.g${n}.t`)}</span> <span className="text-neutral-700">{t(`land.g${n}.b`)}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-20 rounded-3xl bg-neutral-100 px-6 py-12 text-center sm:py-16">
          <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">{t("land.final")}</h2>
          <div className="mt-8">
            <StartButton where="footer" className="inline-flex h-16 w-full px-10 text-xl sm:w-auto" />
          </div>
          <div className="mt-4">
            <BrowseLink />
          </div>
        </section>
        </div>
      </main>

      <footer className="mx-auto flex max-w-3xl flex-col items-center gap-4 px-5 py-12 text-center text-neutral-600">
        <div className="flex items-center justify-center gap-2">
          <LogoMark className="h-5 w-5" />
          <span>
            {siteConfig.name} · {t("land.made")}
          </span>
        </div>
        <div>
          <p>{t("land.social")}</p>
          <div className="mt-1 flex flex-wrap justify-center gap-x-4 gap-y-1">
            <a href={siteConfig.social.tiktok} className="inline-flex min-h-11 items-center rounded-sm px-2 underline underline-offset-4 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink">
              {t("land.tiktok")}
            </a>
            <a href={siteConfig.social.instagram} className="inline-flex min-h-11 items-center rounded-sm px-2 underline underline-offset-4 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink">
              {t("land.instagram")}
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
