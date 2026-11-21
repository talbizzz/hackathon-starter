"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ReelViewer } from "@/components/reel-viewer";
import { SiteHeader } from "@/components/site-header";
import { SpotCard } from "@/components/spot-card";
import { Events, track } from "@/lib/analytics";
import { getDeviceId } from "@/lib/device";
import { env } from "@/lib/env";
import { useFavorites } from "@/lib/favorites";
import { useT } from "@/lib/i18n";
import { shareLink } from "@/lib/share";
import { mapsUrl, type Plan, type PlanSpot } from "@/lib/spots";
import { setStored, useStored } from "@/lib/stored";
import { createClient } from "@/lib/supabase/client";
import { siteConfig } from "@/lib/site-config";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// One plan, two screens. Until you have voted (or while changing your vote): pick one spot and submit.
// After that: who has voted so far, and the result once everyone has.
export function PlanView({ planId }: { planId: string }) {
  const { t } = useT();
  const queryClient = useQueryClient();
  const favorites = useFavorites();
  const valid = UUID.test(planId);
  const key = ["plan", planId];

  // Refreshed by polling (see ADR-6); cheap enough for a group chat.
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
  // The spot picked on the vote screen, before it is submitted.
  const [choice, setChoice] = useState<string | null>(null);
  const [changing, setChanging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // Arriving straight from creating the plan: say what happened to the link if there was no share sheet.
  const [message, setMessage] = useState<string | null>(() => {
    const shared = typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("s");
    return shared === "copied" ? t("plan.copied") : shared === "failed" ? t("share.failed") : null;
  });
  const [reel, setReel] = useState<PlanSpot[] | null>(null);

  const found = !!plan;
  useEffect(() => {
    if (found) track(Events.planOpened, { plan_id: planId });
  }, [found, planId]);

  const shell = (children: React.ReactNode) => (
    <div className="min-h-screen bg-ink">
      <div className="mx-auto min-h-screen max-w-md bg-neutral-50 px-4 pb-10">
        <SiteHeader />
        {children}
      </div>
    </div>
  );

  if (valid && isPending) return shell(<p className="py-10 text-center text-secondary">{t("vote.loading")}</p>);
  if (!plan)
    return shell(
      <div className="py-10 text-center">
        <p className="text-ink">{t("vote.notFound")}</p>
        <Link href="/" className="mt-4 inline-block rounded-full bg-brand px-5 py-2.5 font-semibold text-white">
          {t("vote.own")}
        </Link>
      </div>,
    );

  const voting = !plan.my_vote || changing;
  const selected = choice ?? plan.my_vote;
  const mine = plan.spots.find((s) => s.id === plan.my_vote);
  const top = Math.max(0, ...plan.spots.map((s) => s.votes));
  const leaders = plan.spots.filter((s) => s.votes === top && top > 0);
  const winner = plan.finalized && leaders.length === 1 ? leaders[0] : null;
  const missing = Math.max(0, plan.participants - plan.total_votes);
  const voters = plan.spots.flatMap((s) => s.voters);

  async function submit() {
    const voter = name.trim();
    if (!voter) {
      setMessage(t("vote.needName"));
      return nameInput.current?.focus();
    }
    if (!selected) return;
    setMessage(null);
    setSubmitting(true);
    setStored("voter_name", voter);
    const { data, error } = await createClient().rpc("cast_vote", {
      p_plan_id: planId,
      p_spot_id: selected,
      p_device_id: getDeviceId(),
      p_name: voter,
    });
    setSubmitting(false);
    if (error) return setMessage(t("vote.error"));
    queryClient.setQueryData(key, data);
    track(Events.voteCast, { plan_id: planId, spot_id: selected });
    setChanging(false);
    setChoice(null);
    window.scrollTo({ top: 0 });
  }

  async function invite() {
    track(Events.shareTapped, { plan_id: planId });
    const url = `${env.NEXT_PUBLIC_SITE_URL}/p/${planId}?utm_source=share`;
    const result = await shareLink({ title: siteConfig.name, text: t("plan.shareText"), url });
    if (result === "copied") setMessage(t("plan.copied"));
    if (result === "failed") setMessage(t("share.failed"));
  }

  // The fullscreen videos start on the tapped spot and continue through the rest of the plan.
  const watch = (spot: PlanSpot) => setReel([spot, ...plan.spots.filter((s) => s.id !== spot.id)]);
  const progress = (
    <p data-testid="vote-progress" className="text-sm text-secondary">
      {plan.total_votes} {t("vote.of")} {plan.participants} {t("vote.haveVoted")}
      {voters.length > 0 && `: ${voters.join(", ")}`}
    </p>
  );
  const viewer = reel && (
    <div className="fixed inset-0 z-50 bg-ink">
      <div className="relative mx-auto h-full max-w-md">
        <ReelViewer
          spots={reel}
          favorites={favorites}
          action={voting ? { isOn: (id) => id === selected, toggle: setChoice, onLabel: t("vote.chosen"), offLabel: t("vote.choose") } : undefined}
          onClose={() => setReel(null)}
        />
      </div>
    </div>
  );

  if (voting)
    return shell(
      <div data-testid="vote-screen" className="pb-28">
        <h1 className="text-2xl font-bold tracking-tight">{t("vote.title")}</h1>
        <p className="mt-1 text-secondary">{t("vote.intro")}</p>
        <div className="mt-1">{progress}</div>

        <input
          ref={nameInput}
          data-testid="vote-name"
          value={name}
          onChange={(e) => setTypedName(e.target.value)}
          maxLength={30}
          placeholder={t("vote.name")}
          autoComplete="given-name"
          className="mt-4 w-full rounded-full border border-neutral-300 bg-white px-4 py-3"
        />

        <div className="mt-4 space-y-3">
          {plan.spots.map((spot) => (
            <SpotCard key={spot.id} spot={spot} highlighted={spot.id === selected} onWatch={spot.video_file_url ? () => watch(spot) : undefined}>
              <button
                data-testid="choose-spot"
                aria-pressed={spot.id === selected}
                onClick={() => setChoice(spot.id)}
                className={`w-full rounded-full px-4 py-2.5 font-medium ${spot.id === selected ? "bg-ink text-white" : "border border-neutral-300"}`}
              >
                {t(spot.id === selected ? "vote.chosen" : "vote.choose")}
              </button>
            </SpotCard>
          ))}
        </div>

        <div className="fixed inset-x-0 bottom-0 z-10">
          <div className="mx-auto max-w-md border-t border-neutral-200 bg-white px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
            {message && <p className="mb-2 text-center text-sm text-ink">{message}</p>}
            <button
              data-testid="submit-vote"
              onClick={submit}
              disabled={!selected || submitting}
              className={`w-full rounded-full px-4 py-3.5 font-semibold text-white ${selected ? "bg-brand" : "bg-muted"}`}
            >
              {t("vote.submit")}
            </button>
          </div>
        </div>
        {viewer}
      </div>,
    );

  return shell(
    <div data-testid="status-screen">
      <h1 className="text-3xl font-bold tracking-tight">
        {!plan.finalized ? t("status.voted") : winner ? `${t("status.decided")}: ${winner.name}` : t("status.tie")}
      </h1>
      {!plan.finalized && (
        <p className="mt-2 text-lg text-ink">
          {t("status.waitingFor")} {missing} {t(missing === 1 ? "status.moreVote" : "status.moreVotes")}.
        </p>
      )}
      <div className="mt-2">{progress}</div>

      {winner && (
        <div className="mt-5">
          <SpotCard spot={winner} onWatch={winner.video_file_url ? () => watch(winner) : undefined}>
            <a
              data-testid="directions-link"
              href={mapsUrl(winner)}
              target="_blank"
              rel="noreferrer"
              onClick={() => track(Events.directionsTapped, { plan_id: planId, spot_id: winner.id })}
              className="block w-full rounded-full bg-brand px-4 py-2.5 text-center font-semibold text-white"
            >
              {t("vote.directions")}
            </a>
          </SpotCard>
        </div>
      )}

      <div className="mt-5 rounded-2xl bg-white p-4">
        {mine && (
          <p>
            {t("status.youVoted")} <span className="font-semibold">{mine.name}</span>.
          </p>
        )}
        <button
          data-testid="change-vote"
          onClick={() => {
            setChoice(null);
            setMessage(null);
            setChanging(true);
          }}
          className="mt-3 w-full rounded-full border border-neutral-300 px-4 py-2.5 font-medium"
        >
          {t("status.change")}
        </button>
      </div>

      {plan.finalized ? (
        <div data-testid="results" className="mt-5">
          <h2 className="text-base font-semibold">{t("status.result")}</h2>
          <ul className="mt-2 space-y-3">
            {[...plan.spots]
              .sort((a, b) => b.votes - a.votes)
              .map((spot) => (
                <li key={spot.id} className="rounded-2xl bg-white p-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-semibold">{spot.name}</span>
                    <span className="shrink-0 text-sm tabular-nums">
                      {spot.votes} {t(spot.votes === 1 ? "vote.vote" : "vote.votes")}
                    </span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-neutral-100">
                    <div className="h-2 rounded-full bg-brand" style={{ width: `${plan.total_votes ? (spot.votes / plan.total_votes) * 100 : 0}%` }} />
                  </div>
                  {spot.voters.length > 0 && <p className="mt-2 text-sm text-secondary">{spot.voters.join(", ")}</p>}
                </li>
              ))}
          </ul>
        </div>
      ) : (
        <p className="mt-5 text-secondary">{t("status.hidden")}</p>
      )}

      {message && <p className="mt-4 text-center text-sm text-ink">{message}</p>}
      <div className="mt-6 flex flex-col items-center gap-3">
        <button data-testid="invite" onClick={invite} className="w-full rounded-full bg-ink px-4 py-3 font-semibold text-white">
          {t("status.invite")}
        </button>
        <Link href="/" className="text-sm font-medium underline">
          {t("vote.own")}
        </Link>
      </div>
      {viewer}
    </div>,
  );
}
