"use client";

import { Events, track } from "@/lib/analytics";
import { useT } from "@/lib/i18n";
import { parseVideo } from "@/lib/spots";

type Props = {
  spot: { id: string; video_url: string; creator_handle: string | null; venue_handle: string | null };
  open: boolean;
  onOpen: () => void;
};

// Official embeds, loaded only after a tap: nothing from TikTok or Instagram is requested before that.
export function VideoEmbed({ spot, open, onOpen }: Props) {
  const { t } = useT();
  const video = parseVideo(spot.video_url);
  const platform = video?.platform === "tiktok" ? "TikTok" : "Instagram";

  return (
    <div className="mt-3">
      {video && open && (
        <iframe
          src={
            video.platform === "tiktok"
              ? `https://www.tiktok.com/player/v1/${video.id}?autoplay=1&music_info=1&description=1`
              : `https://www.instagram.com/p/${video.id}/embed/`
          }
          title={platform}
          // Instagram adds its own header and footer around the video, so it needs a fixed, taller frame.
          className={`w-full rounded-xl border-0 bg-black ${video.platform === "tiktok" ? "aspect-[9/16] max-h-[70vh]" : "h-[min(720px,80vh)] bg-white"}`}
          allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
          allowFullScreen
        />
      )}
      {video && !open && (
        <button
          data-testid="play-video"
          onClick={() => {
            track(Events.videoPlayed, { spot_id: spot.id, platform: video.platform });
            onOpen();
          }}
          className="flex h-24 w-full items-center justify-center gap-2 rounded-xl bg-neutral-900 font-medium text-white"
        >
          <span aria-hidden>▶</span>
          {/* Instagram needs a second tap on its own play button, so do not promise "play". */}
          {t(video.platform === "tiktok" ? "video.play" : "video.load")} · {platform}
        </button>
      )}
      <p className="mt-2 flex flex-wrap gap-x-3 text-xs text-neutral-500">
        {spot.creator_handle && (
          <span>
            {t("video.by")}: @{spot.creator_handle}
          </span>
        )}
        {spot.venue_handle && <span>@{spot.venue_handle}</span>}
        <a href={spot.video_url} target="_blank" rel="noreferrer" className="underline">
          {t("video.original")}
        </a>
      </p>
    </div>
  );
}
