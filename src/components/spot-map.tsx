"use client";

import "leaflet/dist/leaflet.css";
import type { LayerGroup, Map as LeafletMap } from "leaflet";
import { useEffect, useRef, useState } from "react";

export type Pin = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  emoji: string;
  imageUrl: string | null;
  state: "open" | "closed" | "selected";
  /** Show the name next to the icon. Off by default: with dozens of spots the labels would cover each other. */
  label: boolean;
};

const BERLIN: [number, number] = [52.5, 13.4];
const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

// Leaflet draws pins from HTML strings. A pin shows the spot's picture when it has one, else its category icon.
function pinHtml(pin: Pin) {
  const tone =
    pin.state === "selected"
      ? "bg-black text-white border-black"
      : pin.state === "open"
        ? "bg-white text-black border-black"
        : "bg-white text-neutral-500 border-neutral-300";
  const name = escapeHtml(pin.name);
  const body = pin.imageUrl
    ? `<img src="${escapeHtml(pin.imageUrl)}" alt="" class="h-16 w-12 rounded-md object-cover" /><span class="block max-w-12 truncate text-center text-[10px] font-semibold">${name}</span>`
    : `<span class="text-lg leading-none">${pin.emoji}</span>${pin.label ? `<span class="max-w-28 truncate pr-1 text-xs font-semibold">${name}</span>` : ""}`;
  return `<div title="${name}" class="absolute flex -translate-x-1/2 -translate-y-full cursor-pointer items-center gap-1 whitespace-nowrap rounded-full border-2 p-1.5 shadow-md ${pin.imageUrl ? "flex-col rounded-xl p-1" : ""} ${tone}">${body}</div>`;
}

export function SpotMap({ pins, onPick }: { pins: Pin[]; onPick: (id: string) => void }) {
  const container = useRef<HTMLDivElement>(null);
  const leaflet = useRef<{ L: typeof import("leaflet"); map: LeafletMap; layer: LayerGroup } | null>(null);
  const [ready, setReady] = useState(false);
  const fitted = useRef(false);
  const pick = useRef(onPick);
  useEffect(() => {
    pick.current = onPick;
  });

  // Leaflet needs `window`, so it is loaded in the browser only.
  useEffect(() => {
    let cancelled = false;
    import("leaflet").then(({ default: L }) => {
      if (cancelled || !container.current) return;
      const map = L.map(container.current, { zoomControl: false }).setView(BERLIN, 11);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);
      leaflet.current = { L, map, layer: L.layerGroup().addTo(map) };
      setReady(true);
    });
    return () => {
      cancelled = true;
      leaflet.current?.map.remove();
      leaflet.current = null;
    };
  }, []);

  useEffect(() => {
    const ctx = leaflet.current;
    if (!ready || !ctx) return;
    ctx.layer.clearLayers();
    for (const pin of pins) {
      ctx.L.marker([pin.lat, pin.lng], {
        icon: ctx.L.divIcon({ html: pinHtml(pin), className: "", iconSize: [0, 0] }),
        // Open and selected spots sit on top of closed ones where pins overlap.
        zIndexOffset: pin.label ? 3000 : pin.state === "selected" ? 2000 : pin.state === "open" ? 1000 : 0,
      })
        .on("click", () => pick.current(pin.id))
        .addTo(ctx.layer);
    }
    if (!fitted.current && pins.length > 0) {
      fitted.current = true;
      ctx.map.fitBounds(ctx.L.latLngBounds(pins.map((p) => [p.lat, p.lng])), { paddingTopLeft: [28, 84], paddingBottomRight: [28, 28], maxZoom: 14 });
    }
  }, [ready, pins]);

  return <div ref={container} data-testid="spot-map" className="h-full w-full bg-neutral-200" />;
}
