"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { uuid } from "@/lib/device";
import type { Spot } from "@/lib/spots";
import { createClient } from "@/lib/supabase/client";

const BUCKET = "spot-media";
const MAX_BYTES = 50 * 1024 * 1024;

// A still frame from the video, used as its poster and as the picture on the map pin.
async function makePoster(file: File): Promise<Blob | null> {
  const url = URL.createObjectURL(file);
  try {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.src = url;
    await new Promise<void>((resolve, reject) => {
      video.onloadeddata = () => resolve();
      video.onerror = () => reject(new Error("cannot read video"));
    });
    // A moment in, so the frame is not a black fade-in.
    video.currentTime = Math.min(1, (video.duration || 2) / 2);
    await new Promise<void>((resolve) => {
      video.onseeked = () => resolve();
    });
    const scale = Math.min(1, 540 / video.videoWidth);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext("2d")!.drawImage(video, 0, 0, canvas.width, canvas.height);
    return await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.8));
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Team-only page: attach a video file to each spot. A spot goes live on the site once it has one.
// Only upload videos you filmed yourself or have the owner's permission to host.
export function AdminSpots() {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ spotId: string; text: string } | null>(null);

  const { data, isPending } = useQuery({
    queryKey: ["admin-spots"],
    queryFn: async () => {
      const [{ data: isAdmin }, { data: auth }] = await Promise.all([supabase.rpc("is_admin"), supabase.auth.getUser()]);
      if (!isAdmin) return { isAdmin: false as const, userId: auth.user?.id };
      const { data: spots, error } = await supabase.from("spots").select("*").order("name");
      if (error) throw error;
      return { isAdmin: true as const, spots };
    },
  });

  async function upload(spot: Spot, file: File) {
    setMessage(null);
    if (file.size > MAX_BYTES) return setMessage({ spotId: spot.id, text: "File is over 50 MB. Export a smaller version." });
    setBusy(spot.id);
    try {
      const stamp = uuid(); // unique name per upload, so a replaced video is never served from cache
      const extension = file.name.split(".").pop()?.toLowerCase() || "mp4";
      const videoPath = `${spot.id}/${stamp}.${extension}`;
      const uploaded = await supabase.storage.from(BUCKET).upload(videoPath, file, { contentType: file.type, cacheControl: "31536000" });
      if (uploaded.error) throw uploaded.error;

      let posterUrl: string | null = null;
      const poster = await makePoster(file);
      if (poster) {
        const posterPath = `${spot.id}/${stamp}.jpg`;
        const posted = await supabase.storage.from(BUCKET).upload(posterPath, poster, { contentType: "image/jpeg", cacheControl: "31536000" });
        if (!posted.error) posterUrl = supabase.storage.from(BUCKET).getPublicUrl(posterPath).data.publicUrl;
      }

      const saved = await supabase
        .from("spots")
        .update({ video_file_url: supabase.storage.from(BUCKET).getPublicUrl(videoPath).data.publicUrl, poster_url: posterUrl })
        .eq("id", spot.id);
      if (saved.error) throw saved.error;
      setMessage({ spotId: spot.id, text: posterUrl ? "Uploaded. The spot is live." : "Uploaded and live, but no still could be made from this file (the map pin shows an icon)." });
      await queryClient.invalidateQueries({ queryKey: ["admin-spots"] });
    } catch (error) {
      setMessage({ spotId: spot.id, text: `Upload failed: ${error instanceof Error ? error.message : "unknown error"}` });
    } finally {
      setBusy(null);
    }
  }

  if (isPending) return <p className="text-neutral-500">Loading…</p>;
  if (!data?.isAdmin)
    return (
      <div>
        <h1 className="text-2xl font-semibold">Admin</h1>
        <p className="mt-4 text-neutral-600">This account is not an admin. Run this in the Supabase SQL editor, then reload:</p>
        <pre className="mt-2 overflow-x-auto rounded-lg bg-neutral-900 p-4 text-sm text-white">
          insert into public.admins values (&apos;{data?.userId}&apos;);
        </pre>
      </div>
    );

  const live = data.spots.filter((s) => s.video_file_url).length;
  return (
    <div>
      <h1 className="text-2xl font-semibold">Spot videos</h1>
      <p className="mt-1 text-sm text-neutral-500">
        {live} of {data.spots.length} spots are live. A spot appears on the site once it has a video. Upload MP4 (H.264), vertical, under 50 MB,
        and only videos you filmed or have permission to host.
      </p>
      <ul className="mt-6 divide-y divide-neutral-200 rounded-2xl border border-neutral-200 bg-white">
        {data.spots.map((spot) => (
          <li key={spot.id} data-testid="admin-spot" className="flex flex-wrap items-center gap-4 p-4">
            {spot.poster_url ? (
              // eslint-disable-next-line @next/next/no-img-element -- remote poster, no optimisation needed on an internal page
              <img src={spot.poster_url} alt="" className="h-16 w-10 rounded object-cover" />
            ) : (
              <div className="h-16 w-10 rounded bg-neutral-100" />
            )}
            <div className="min-w-0 flex-1">
              <p className="font-medium">{spot.name}</p>
              <p className="text-sm text-neutral-500">
                {spot.neighbourhood} · {spot.video_file_url ? "Live ✓" : "Hidden: no video yet"}
              </p>
              {message?.spotId === spot.id && <p className="mt-1 text-sm text-neutral-800">{message.text}</p>}
            </div>
            <label className={`cursor-pointer rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium ${busy ? "pointer-events-none opacity-50" : ""}`}>
              {busy === spot.id ? "Uploading…" : spot.video_file_url ? "Replace video" : "Upload video"}
              <input
                type="file"
                accept="video/mp4,video/quicktime,video/webm"
                className="hidden"
                disabled={!!busy}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) upload(spot, file);
                }}
              />
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
