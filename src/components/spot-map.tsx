"use client";

import "leaflet/dist/leaflet.css";
import type { LayerGroup, Map as LeafletMap, Marker } from "leaflet";
import { useEffect, useRef, useState } from "react";
import { BRAND, categoryColor } from "@/lib/categories";

export type Pin = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  category: string;
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

// Leaflet draws pins from HTML strings. A pin shows the still from the spot's video, or a plain dot without one,
// in the colour of its category: bright and pulsing when the spot is open now, faded when it is closed, and in the
// brand colour once it is part of the plan. The tip of the little tail is the spot's location.
function pinHtml(pin: Pin, opts: { enterDelay: number | null; bounce: boolean }) {
  const name = escapeHtml(pin.name);
  const selected = pin.state === "selected";
  const color = selected ? BRAND : categoryColor(pin.category);
  const open = pin.state === "open";
  // The size is set inline: the map library forces width:auto on images inside pins, which let landscape stills grow wide.
  const [w, h] = pin.imageUrl ? (pin.picked ? [64, 96] : [36, 48]) : pin.picked ? [34, 34] : [26, 26];
  const shape = pin.imageUrl ? "rounded-lg" : "rounded-full";
  const glow = selected ? `box-shadow:0 0 0 5px ${BRAND}44,0 2px 6px rgba(0,0,0,.3);` : "";
  const face = pin.imageUrl
    ? `<img src="${escapeHtml(pin.imageUrl)}" alt="" style="width:${w}px;height:${h}px;border:3px solid ${color};${glow}" class="relative z-[1] block ${shape} bg-ink object-cover shadow-md" />`
    : `<span style="width:${w}px;height:${h}px;background:${color};border:3px solid #fff;${glow}" class="relative z-[1] block ${shape} shadow-md"></span>`;
  const pulse = open && !selected ? `<span class="pin-pulse absolute inset-0 ${shape}" style="--c0:${color}b3;--c1:${color}00"></span>` : "";
  const tail = `<span class="-mt-[7px] block h-3 w-3 rotate-45 rounded-[3px]" style="background:${color}"></span>`;
  const label = pin.picked
    ? `<span class="absolute bottom-full left-1/2 mb-1.5 max-w-40 -translate-x-1/2 truncate whitespace-nowrap rounded-full bg-ink px-2.5 py-1 text-xs font-semibold text-white shadow-md">${name}</span>`
    : "";
  const classes = [
    "relative flex flex-col items-center",
    opts.enterDelay !== null ? "pin-enter" : "",
    opts.bounce ? "pin-bounce" : "",
    pin.state === "closed" ? "pin-closed" : "",
    selected ? "pin-selected" : "",
  ].join(" ");
  return `<div title="${name}" data-picked="${pin.picked}" data-state="${pin.state}" class="absolute -translate-x-1/2 -translate-y-full cursor-pointer"><div class="${classes}" style="--d:${opts.enterDelay ?? 0}ms">${label}<div class="relative">${pulse}${face}</div>${tail}</div></div>`;
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
  const seen = useRef(new Set<string>());
  // What is on the map now, by spot, with the signature of what each pin looks like.
  const markers = useRef(new Map<string, { marker: Marker; sig: string }>());
  const bounced = useRef<string | null>(null);
  const pick = useRef(onPick);
  const inset = useRef(bottomInset);
  useEffect(() => {
    pick.current = onPick;
    inset.current = bottomInset;
  });

  // Leaflet needs `window`, so it is loaded in the browser only.
  useEffect(() => {
    let cancelled = false;
    const drawn = markers.current;
    import("leaflet").then(({ default: L }) => {
      if (cancelled || !container.current) return;
      const map = L.map(container.current, {
        zoomControl: false,
        attributionControl: false,
        // The map cannot be dragged or zoomed away from Berlin.
        maxBounds: BERLIN_BOUNDS,
        maxBoundsViscosity: 1,
        minZoom: 10,
        maxZoom: 18,
      }).setView(BERLIN, 11);
      L.control.attribution({ position: "topright", prefix: false }).addTo(map);
      // Humanitarian OpenStreetMap style: pastel streets, teal water, fresh greens. A little extra saturation
      // is added in globals.css. Hosted by OpenStreetMap France for light use; see the credit below.
      L.tileLayer("https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png", {
        subdomains: "abc",
        maxZoom: 18,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, tiles by HOT',
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
      drawn.clear();
    };
  }, []);

  useEffect(() => {
    const ctx = leaflet.current;
    if (!ready || !ctx) return;
    // Pins pop in one after another the first time they appear; redrawing them later (a pick, a filter) is silent.
    // Only pins that changed are redrawn. Rebuilding every picture pin on each tap made them all flash dark while the stills repainted.
    const live = new Set(pins.map((p) => p.id));
    for (const [id, m] of markers.current)
      if (!live.has(id)) {
        ctx.layer.removeLayer(m.marker);
        markers.current.delete(id);
      }
    let fresh = 0;
    for (const pin of pins) {
      const isNew = !seen.current.has(pin.id);
      seen.current.add(pin.id);
      const bounce = pin.picked && bounced.current !== pin.id;
      if (pin.picked) bounced.current = pin.id;
      else if (bounced.current === pin.id) bounced.current = null;
      const sig = [pin.state, pin.picked, pin.imageUrl, pin.lat, pin.lng, pin.name, pin.category].join("|");
      const existing = markers.current.get(pin.id);
      if (existing?.sig === sig) continue;
      const icon = ctx.L.divIcon({ html: pinHtml(pin, { enterDelay: isNew ? Math.min(fresh++ * 70, 700) : null, bounce }), className: "", iconSize: [0, 0] });
      // Open and selected spots sit on top of closed ones where pins overlap.
      const zIndexOffset = pin.picked ? 3000 : pin.state === "selected" ? 2000 : pin.state === "open" ? 1000 : 0;
      if (existing) {
        existing.marker.setIcon(icon).setLatLng([pin.lat, pin.lng]).setZIndexOffset(zIndexOffset);
        existing.sig = sig;
        continue;
      }
      const marker = ctx.L.marker([pin.lat, pin.lng], { icon, zIndexOffset })
        .on("click", () => pick.current(pin.id))
        .addTo(ctx.layer);
      markers.current.set(pin.id, { marker, sig });
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
