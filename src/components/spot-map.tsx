"use client";

import "leaflet/dist/leaflet.css";
import type { LayerGroup, Map as LeafletMap } from "leaflet";
import { useEffect, useRef, useState } from "react";

export type Pin = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  imageUrl: string | null;
  state: "open" | "closed" | "selected";
  /** The spot the visitor tapped: drawn larger, with its name, above the other pins. */
  picked: boolean;
};

const BERLIN: [number, number] = [52.5, 13.4];
const AREA_ZOOM = 14; // a neighbourhood fills the screen
// The city with a margin, more of it to the south: the sheet covers the lower part of the map,
// so southern spots must still be able to sit above it.
const BERLIN_BOUNDS: [[number, number], [number, number]] = [
  [52.12, 12.95],
  [52.75, 13.9],
];
const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

// Leaflet draws pins from HTML strings. A pin shows the still from the spot's video, or a plain dot without one.
function pinHtml(pin: Pin) {
  const name = escapeHtml(pin.name);
  // Border colour says what the spot is: in your plan, open now, or closed.
  const border = pin.state === "selected" ? "border-brand" : pin.state === "open" ? "border-ink" : "border-white";
  // Pins stay small so they do not cover each other; the tapped one grows and shows its name.
  // The size is set inline: the map library forces width:auto on images inside pins, which let landscape stills grow wide.
  const face = pin.imageUrl
    ? `<img src="${escapeHtml(pin.imageUrl)}" alt="" style="width:${pin.picked ? 64 : 36}px;height:${pin.picked ? 96 : 48}px" class="rounded-lg border-[3px] ${border} bg-ink object-cover shadow-md" />`
    : `<span class="block ${pin.picked ? "h-8 w-8" : "h-6 w-6"} rounded-full border-[3px] ${border} bg-white shadow-md"></span>`;
  const label = pin.picked
    ? `<span class="mt-1 max-w-36 truncate rounded-full bg-ink px-2.5 py-1 text-xs font-semibold text-white shadow-md">${name}</span>`
    : "";
  return `<div title="${name}" data-picked="${pin.picked}" class="absolute flex -translate-x-1/2 -translate-y-full cursor-pointer flex-col items-center">${face}${label}</div>`;
}

type Props = {
  pins: Pin[];
  /** Called with the tapped spot, or null when the visitor taps the empty map. */
  onPick: (id: string | null) => void;
  /** How many pixels at the bottom of the map are covered by the sheet. */
  bottomInset: number;
  /** The spot to bring into the visible part of the map. */
  focusId: string | null;
  /** A part of the city to show, or null for the whole city. */
  area: { lat: number; lng: number } | null;
};

// The search bar, plus the height of a tapped picture pin with its name: pins hang upwards from their location.
const TOP_INSET = 96 + 130;

export function SpotMap({ pins, onPick, bottomInset, focusId, area }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const leaflet = useRef<{ L: typeof import("leaflet"); map: LeafletMap; layer: LayerGroup } | null>(null);
  const [ready, setReady] = useState(false);
  const fitted = useRef(false);
  const pick = useRef(onPick);
  const inset = useRef(bottomInset);
  useEffect(() => {
    pick.current = onPick;
    inset.current = bottomInset;
  });

  // Leaflet needs `window`, so it is loaded in the browser only.
  useEffect(() => {
    let cancelled = false;
    import("leaflet").then(({ default: L }) => {
      if (cancelled || !container.current) return;
      const map = L.map(container.current, {
        zoomControl: false,
        attributionControl: false,
        // The map cannot be dragged or zoomed away from Berlin.
        maxBounds: BERLIN_BOUNDS,
        maxBoundsViscosity: 1,
        minZoom: 10,
      }).setView(BERLIN, 11);
      L.control.attribution({ position: "topright", prefix: false }).addTo(map);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);
      // Tapping the empty map lets go of the tapped spot, so its enlarged pin stops covering its neighbours.
      map.on("click", () => pick.current(null));
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
        zIndexOffset: pin.picked ? 3000 : pin.state === "selected" ? 2000 : pin.state === "open" ? 1000 : 0,
      })
        .on("click", () => pick.current(pin.id))
        .addTo(ctx.layer);
    }
    if (!fitted.current && pins.length > 0) {
      fitted.current = true;
      ctx.map.fitBounds(ctx.L.latLngBounds(pins.map((p) => [p.lat, p.lng])), { paddingTopLeft: [32, TOP_INSET], paddingBottomRight: [32, inset.current + 24], maxZoom: 14 });
    }
  }, [ready, pins]);

  // Bring the tapped spot into the part of the map that the sheet and search bar leave visible.
  useEffect(() => {
    const ctx = leaflet.current;
    const pin = pins.find((p) => p.id === focusId);
    if (!ready || !ctx || !pin) return;
    ctx.map.panInside([pin.lat, pin.lng], { paddingTopLeft: [40, TOP_INSET], paddingBottomRight: [40, bottomInset + 40] });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pan when the focus or the sheet height changes, not on every pin refresh
  }, [ready, focusId, bottomInset]);

  // Show the chosen part of the city, centred in the strip of map between the search bar and the sheet.
  // Clearing the area goes back to framing every pin.
  const hadArea = useRef(false);
  useEffect(() => {
    const ctx = leaflet.current;
    if (!ready || !ctx) return;
    if (area) {
      hadArea.current = true;
      const centre = ctx.map.project([area.lat, area.lng], AREA_ZOOM).add([0, (inset.current - 72) / 2]);
      ctx.map.setView(ctx.map.unproject(centre, AREA_ZOOM), AREA_ZOOM, { animate: true });
    } else if (hadArea.current && pins.length > 0) {
      hadArea.current = false;
      ctx.map.fitBounds(ctx.L.latLngBounds(pins.map((p) => [p.lat, p.lng])), { paddingTopLeft: [32, TOP_INSET], paddingBottomRight: [32, inset.current + 24], maxZoom: 14 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- move only when the chosen area changes
  }, [ready, area]);

  return <div ref={container} data-testid="spot-map" className="h-full w-full bg-neutral-200" />;
}
