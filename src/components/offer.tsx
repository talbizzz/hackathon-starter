"use client";

import Link from "next/link";
import { useEffect } from "react";
import { LangToggle } from "@/components/lang-toggle";
import { Logo } from "@/components/logo";
import { Events, track } from "@/lib/analytics";
import { useT } from "@/lib/i18n";
import { siteConfig } from "@/lib/site-config";

type Tier = "ready" | "custom";

export function paypalUrl(handle: string, price: string) {
  return `https://paypal.me/${encodeURIComponent(handle)}/${price}EUR`;
}

function TierCard({ tier, title, body, when, price }: { tier: Tier; title: string; body: string; when: string; price: string }) {
  const { t } = useT();
  const handle = siteConfig.offer.paypalMe;
  return (
    <section className="flex flex-col rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm" data-testid={`tier-${tier}`}>
      <h2 className="text-xl font-bold text-ink">{title}</h2>
      <p className="mt-1 text-3xl font-extrabold text-ink">
        €{price} <span className="text-base font-medium text-neutral-500">{t("offer.once")}</span>
      </p>
      <p className="mt-3 text-neutral-700">{body}</p>
      <p className="mt-2 text-sm font-medium text-neutral-600">{when}</p>
      <div className="mt-auto pt-5">
        {handle ? (
          <a
            href={paypalUrl(handle, price)}
            target="_blank"
            rel="noopener noreferrer"
            data-testid={`buy-${tier}`}
            onClick={() => track(Events.checkoutClicked, { tier, price })}
            className="flex min-h-12 w-full items-center justify-center rounded-full bg-brand px-6 font-bold text-white transition-colors hover:bg-[#c2335d] focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-ink active:scale-[0.98]"
          >
            {t("offer.buy")} · €{price}
          </a>
        ) : (
          <a
            href={siteConfig.social.instagram}
            target="_blank"
            rel="noopener noreferrer"
            data-testid={`dm-${tier}`}
            onClick={() => track(Events.checkoutClicked, { tier, price, via: "instagram" })}
            className="flex min-h-12 w-full items-center justify-center rounded-full border-2 border-ink px-6 text-center font-bold text-ink"
          >
            {t("offer.soon")}
          </a>
        )}
      </div>
    </section>
  );
}

export function Offer() {
  const { t } = useT();
  useEffect(() => {
    track(Events.offerViewed);
  }, []);
  const { readyPlanPrice, customPlanPrice } = siteConfig.offer;
  return (
    <main className="min-h-screen bg-neutral-50 px-4 pb-16 pt-6 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <header className="flex items-center justify-between">
          <Link href="/" aria-label={siteConfig.name}>
            <Logo />
          </Link>
          <LangToggle />
        </header>

        <p className="mt-10 text-sm font-bold uppercase tracking-wide text-brand">{t("offer.kicker")}</p>
        <h1 className="mt-2 text-4xl font-extrabold leading-tight text-ink sm:text-5xl">{t("offer.h1")}</h1>
        <p className="mt-4 text-lg text-neutral-700">{t("offer.sub")}</p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <TierCard tier="ready" title={t("offer.a.t")} body={t("offer.a.b")} when={t("offer.a.when")} price={readyPlanPrice} />
          <TierCard tier="custom" title={t("offer.b.t")} body={t("offer.b.b")} when={t("offer.b.when")} price={customPlanPrice} />
        </div>

        <section className="mt-10">
          <h2 className="text-lg font-bold text-ink">{t("offer.note.t")}</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-neutral-700">
            <li>{t("offer.note.1")}</li>
            <li>{t("offer.note.2")}</li>
            <li>{t("offer.note.3")}</li>
          </ol>
          <p className="mt-4 text-sm text-neutral-600">{t("offer.excl")}</p>
        </section>

        <p className="mt-8">
          <Link href="/map" className="font-medium underline underline-offset-4">
            {t("offer.free")}
          </Link>
        </p>
      </div>
    </main>
  );
}
