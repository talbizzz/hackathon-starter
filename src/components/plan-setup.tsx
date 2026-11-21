"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n";

export type PlanConfig = { participants: number; choices: number };
const CHOICES = [3, 5, 10];
const MIN_PEOPLE = 2;
const MAX_PEOPLE = 20;

// Shown before any spot can be added: what a plan is, and how big this one should be.
export function PlanSetup({ onStart, onClose }: { onStart: (config: PlanConfig) => void; onClose: () => void }) {
  const { t } = useT();
  const [participants, setParticipants] = useState(3);
  const [choices, setChoices] = useState(3);
  const step = "flex h-12 w-12 items-center justify-center rounded-full border border-neutral-300 text-2xl disabled:opacity-30";

  return (
    <div data-testid="plan-setup" className="absolute inset-0 z-[1200] flex flex-col overflow-y-auto bg-white px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
      <button onClick={onClose} aria-label={t("reel.close")} className="-ml-2 flex h-11 w-11 items-center justify-center rounded-full">
        <svg viewBox="0 0 24 24" className="h-6 w-6 fill-none stroke-current stroke-2">
          <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
        </svg>
      </button>

      <h2 className="mt-4 text-3xl font-bold tracking-tight">{t("setup.title")}</h2>
      <p className="mt-3 text-lg text-secondary">{t("setup.body")}</p>
      <ol className="mt-5 list-decimal space-y-2 pl-5 font-medium">
        <li>{t("setup.step1")}</li>
        <li>{t("setup.step2")}</li>
        <li>{t("setup.step3")}</li>
      </ol>

      <div className="mt-8 rounded-2xl bg-neutral-100 p-4">
        <p className="font-semibold">{t("setup.people")}</p>
        <p className="text-sm text-secondary">{t("setup.peopleHint")}</p>
        <div className="mt-3 flex items-center justify-between">
          <button className={step} aria-label={t("setup.fewer")} disabled={participants <= MIN_PEOPLE} onClick={() => setParticipants(participants - 1)}>
            −
          </button>
          <span data-testid="setup-people" className="text-4xl font-bold tabular-nums">
            {participants}
          </span>
          <button className={step} aria-label={t("setup.more")} disabled={participants >= MAX_PEOPLE} onClick={() => setParticipants(participants + 1)}>
            +
          </button>
        </div>
      </div>

      <div className="mt-3 rounded-2xl bg-neutral-100 p-4">
        <p className="font-semibold">{t("setup.choices")}</p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {CHOICES.map((n) => (
            <button
              key={n}
              data-testid={`setup-choices-${n}`}
              aria-pressed={choices === n}
              onClick={() => setChoices(n)}
              className={`rounded-full py-3 text-lg font-semibold ${choices === n ? "bg-ink text-white" : "bg-white"}`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-auto pt-6">
        <button data-testid="setup-start" onClick={() => onStart({ participants, choices })} className="w-full rounded-full bg-brand px-4 py-4 text-lg font-semibold text-white">
          {t("setup.start")}
        </button>
      </div>
    </div>
  );
}
