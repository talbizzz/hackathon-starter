"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { SpotCard } from "@/components/spot-card";
import { Events, track } from "@/lib/analytics";
import { getDeviceId } from "@/lib/device";
import { env } from "@/lib/env";
import { useT } from "@/lib/i18n";
import { shareLink } from "@/lib/share";
import { mapsUrl, type Plan } from "@/lib/spots";
import { setStored, useStored } from "@/lib/stored";
import { createClient } from "@/lib/supabase/client";
import { siteConfig } from "@/lib/site-config";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function PlanView({ planId }: { planId: string }) {
  const { t } = useT();
  const queryClient = useQueryClient();
  const valid = UUID.test(planId);
  const key = ["plan", planId];

  // Results are refreshed by polling (see ADR-6); cheap enough for a group chat.
  const { data: plan, isPending } = useQuery({
    queryKey: key,
    enabled: valid,
    refetchInterval: 3000,
    queryFn: async () => {
      const { data, error } = await createClient().rpc("get_plan", { p_plan_id: planId, p_device_id: getDeviceId() });
      if (error) throw error;
      return data as unknown as Plan | null;
    },
  });

  const storedName = useStored("voter_name");
  const [typedName, setTypedName] = useState<string | null>(null);
  const name = typedName ?? storedName ?? "";
  const nameInput = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);

  const found = !!plan;
  useEffect(() => {
    if (found) track(Events.planOpened, { plan_id: planId });
  }, [found, planId]);

  async function vote(spotId: string) {
    const voter = name.trim();
    if (!voter) return nameInput.current?.focus();
    setMessage(null);
    setStored("voter_name", voter);
    const { data, error } = await createClient().rpc("cast_vote", {
      p_plan_id: planId,
      p_spot_id: spotId,
      p_device_id: getDeviceId(),
      p_name: voter,
    });
    if (error) return setMessage(t("vote.error"));
    queryClient.setQueryData(key, data);
    track(Events.voteCast, { plan_id: planId, spot_id: spotId });
  }

  async function share() {
    track(Events.shareTapped, { plan_id: planId });
    const url = `${env.NEXT_PUBLIC_SITE_URL}/p/${planId}?utm_source=share`;
    const result = await shareLink({ title: siteConfig.name, text: t("plan.shareText"), url });
    if (result === "copied") setMessage(t("plan.copied"));
    if (result === "failed") setMessage(t("share.failed"));
  }

  const shell = (children: React.ReactNode) => (
    <div className="mx-auto min-h-screen max-w-md bg-neutral-50 px-4 pb-16">
      <SiteHeader />
      {children}
    </div>
  );

  if (valid && isPending) return shell(<p className="py-10 text-center text-neutral-500">{t("vote.loading")}</p>);
  if (!plan)
    return shell(
      <div className="py-10 text-center">
        <p className="text-neutral-700">{t("vote.notFound")}</p>
        <Link href="/" className="mt-4 inline-block rounded-lg bg-black px-4 py-2.5 font-medium text-white">
          {t("vote.own")}
        </Link>
      </div>,
    );

  const top = Math.max(...plan.spots.map((s) => s.votes));
  const leaders = plan.spots.filter((s) => s.votes === top);
  const leaderId = top > 0 && leaders.length === 1 ? leaders[0].id : null;

  return shell(
    <>
      <h1 className="text-2xl font-bold tracking-tight">{t("vote.title")}</h1>
      <p className="mt-1 text-neutral-600">{t("vote.intro")}</p>

      <input
        ref={nameInput}
        data-testid="vote-name"
        value={name}
        onChange={(e) => setTypedName(e.target.value)}
        maxLength={30}
        placeholder={t("vote.name")}
        autoComplete="given-name"
        className="mt-4 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5"
      />
      {message && <p className="mt-2 text-sm text-neutral-700">{message}</p>}

      <div className="mt-4 space-y-3">
        {plan.spots.map((spot) => {
          const mine = plan.my_vote === spot.id;
          return (
            <SpotCard
              key={spot.id}
              spot={spot}
              highlighted={mine}
              badge={spot.id === leaderId ? `★ ${t("vote.leading")}` : undefined}
            >
              <p className="mb-2 text-sm">
                <span className="font-semibold">
                  {spot.votes} {t(spot.votes === 1 ? "vote.vote" : "vote.votes")}
                </span>
                {spot.voters.length > 0 && <span className="text-neutral-500"> · {spot.voters.join(", ")}</span>}
              </p>
              <div className="flex gap-2">
                <button
                  data-testid="vote-button"
                  onClick={() => vote(spot.id)}
                  className={`flex-1 rounded-lg px-4 py-2.5 font-medium ${mine ? "bg-black text-white" : "border border-neutral-300"}`}
                >
                  {t(mine ? "vote.mine" : "vote.button")}
                </button>
                <a
                  data-testid="directions-link"
                  href={mapsUrl(spot)}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => track(Events.directionsTapped, { plan_id: planId, spot_id: spot.id })}
                  className="rounded-lg border border-neutral-300 px-4 py-2.5 font-medium"
                >
                  {t("vote.directions")}
                </a>
              </div>
            </SpotCard>
          );
        })}
      </div>

      <div className="mt-8 flex flex-col items-center gap-3">
        <button onClick={share} className="w-full rounded-lg bg-black px-4 py-3 font-medium text-white">
          {t("vote.share")}
        </button>
        <Link href="/" className="text-sm font-medium underline">
          {t("vote.own")}
        </Link>
      </div>
    </>,
  );
}
