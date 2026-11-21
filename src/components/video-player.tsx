"use client";

import { useRef } from "react";
import { Events, track } from "@/lib/analytics";
import { useT } from "@/lib/i18n";

type Props = {
  spot: {
    id: string;
    video_file_url: string | null;
    poster_url: string | null;
    video_url: string | null;
    creator_handle: string | null;
    venue_handle: string | null;
  };
};

// Videos are hosted by us (uploaded with the owner's permission) and play in the browser's own player.
// Nothing is downloaded until the visitor presses play.
export function VideoPlayer({ spot }: Props) {
  const { t } = useT();
  const counted = useRef(false);
  if (!spot.video_file_url) return null;

  return (
    <div className="mt-3">
      <video
        data-testid="spot-video"
        src={spot.video_file_url}
        poster={spot.poster_url ?? undefined}
        // Without a poster, load the first frame so the card is not a black box.
        preload={spot.poster_url ? "none" : "metadata"}
        controls
        playsInline
        onPlay={(e) => {
          // One video at a time.
          document.querySelectorAll("video").forEach((other) => other !== e.currentTarget && other.pause());
          if (!counted.current) track(Events.videoPlayed, { spot_id: spot.id });
          counted.current = true;
        }}
        className="aspect-[9/16] max-h-[65vh] w-full rounded-xl bg-black object-contain"
      />
      {(spot.creator_handle || spot.venue_handle || spot.video_url) && (
        <p className="mt-2 flex flex-wrap gap-x-3 text-xs text-neutral-500">
          {spot.creator_handle && (
            <span>
              {t("video.by")}: @{spot.creator_handle}
            </span>
          )}
          {spot.venue_handle && <span>@{spot.venue_handle}</span>}
          {spot.video_url && (
            <a href={spot.video_url} target="_blank" rel="noreferrer" className="underline">
              {t("video.original")}
            </a>
          )}
        </p>
      )}
    </div>
  );
}
