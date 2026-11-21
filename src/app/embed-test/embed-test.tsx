"use client";

import { useState } from "react";

const EMBEDS = {
  tiktok: {
    label: "TikTok",
    src: "https://www.tiktok.com/player/v1/6718335390845095173?autoplay=1&music_info=1&description=1",
    className: "aspect-[9/16] w-full",
  },
  instagram: {
    label: "Instagram",
    src: "https://www.instagram.com/p/Df9daAtIwTJ/embed/",
    className: "h-[720px] w-full",
  },
} as const;

export function EmbedTest() {
  const [open, setOpen] = useState<keyof typeof EMBEDS | null>(null);
  return (
    <main className="mx-auto max-w-md space-y-6 px-4 py-8">
      <h1 className="text-xl font-semibold">Embed test</h1>
      <p className="text-sm text-neutral-600">
        Nothing from TikTok or Instagram loads until you tap. Check: does it play here, with sound, without leaving the page?
      </p>
      {(Object.keys(EMBEDS) as (keyof typeof EMBEDS)[]).map((key) => {
        const embed = EMBEDS[key];
        return (
          <section key={key}>
            {open === key ? (
              <iframe
                src={embed.src}
                title={embed.label}
                className={`${embed.className} rounded-2xl border-0`}
                allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <button
                onClick={() => setOpen(key)}
                className="flex aspect-[9/16] w-full items-center justify-center rounded-2xl border border-neutral-300 bg-neutral-100 text-lg font-medium"
              >
                ▶ Play video ({embed.label})
              </button>
            )}
          </section>
        );
      })}
    </main>
  );
}
