"use client";

import { useEffect, useRef, useState } from "react";

export type Snap = "peek" | "full";

// Two resting heights, as shares of the screen: collapsed and open. Nothing in between.
const PEEK = 0.2;
const FULL = 0.9;

/** Height of the collapsed sheet in pixels (browser only). */
export function collapsedHeight() {
  return Math.round(window.innerHeight * PEEK);
}

// Collapsed, the sheet is 20% of the screen, or taller if its header and footer need more room.
function snapHeight(snap: Snap, minPx: number) {
  return snap === "peek" ? Math.max(collapsedHeight(), minPx) : Math.round(window.innerHeight * FULL);
}

type Props = {
  snap: Snap;
  onSnap: (snap: Snap) => void;
  /** Always visible. Its top strip is the drag handle. */
  header: React.ReactNode;
  /** Pinned to the bottom of the sheet, e.g. the plan bar. */
  footer?: React.ReactNode;
  children: React.ReactNode;
};

// A sheet over the map with two resting heights. Drag the handle, or tap it to toggle.
// The content scrolls inside the sheet, so dragging the list never moves the sheet by accident.
export function BottomSheet({ snap, onSnap, header, footer, children }: Props) {
  const drag = useRef<{ startY: number; startHeight: number; moved: boolean } | null>(null);
  const [dragHeight, setDragHeight] = useState<number | null>(null);

  // The room the header and footer need, so a collapsed sheet never cuts them off.
  const top = useRef<HTMLDivElement>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const [peekPx, setPeekPx] = useState(120);
  useEffect(() => {
    const measure = () => setPeekPx((top.current?.offsetHeight ?? 0) + (bottom.current?.offsetHeight ?? 0));
    const observer = new ResizeObserver(measure);
    if (top.current) observer.observe(top.current);
    if (bottom.current) observer.observe(bottom.current);
    return () => observer.disconnect();
  }, []);

  const restingHeight = snap === "peek" ? `max(${PEEK * 100}dvh, ${peekPx}px)` : `${FULL * 100}dvh`;

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { startY: e.clientY, startHeight: snapHeight(snap, peekPx), moved: false };
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d) return;
    const delta = d.startY - e.clientY;
    if (Math.abs(delta) > 6) d.moved = true;
    if (d.moved) setDragHeight(Math.max(snapHeight("peek", peekPx), Math.min(snapHeight("full", peekPx), d.startHeight + delta)));
  }

  function onPointerUp() {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (!d.moved) {
      // A tap toggles between collapsed and open.
      onSnap(snap === "peek" ? "full" : "peek");
    } else if (dragHeight !== null) {
      // Let go past the midpoint and it opens; otherwise it collapses.
      const midpoint = (snapHeight("peek", peekPx) + snapHeight("full", peekPx)) / 2;
      onSnap(dragHeight > midpoint ? "full" : "peek");
    }
    setDragHeight(null);
  }

  return (
    <section
      data-testid="bottom-sheet"
      data-snap={snap}
      style={{ height: dragHeight !== null ? `${dragHeight}px` : restingHeight }}
      className={`absolute inset-x-0 bottom-0 z-[1100] flex flex-col rounded-t-3xl bg-white shadow-[0_-8px_30px_rgba(0,0,0,0.18)] ${
        dragHeight === null ? "transition-[height] duration-300 ease-out motion-reduce:transition-none" : ""
      }`}
    >
      <div ref={top} className="shrink-0">
      <div
        data-testid="sheet-handle"
        role="button"
        aria-label="Resize list"
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSnap(snap === "peek" ? "full" : "peek")}
        className="shrink-0 cursor-grab touch-none select-none px-4 pb-2 pt-2.5 active:cursor-grabbing"
      >
        <div className="mx-auto h-1.5 w-10 rounded-full bg-neutral-300" />
      </div>
      {header}
      </div>
      {/* Padding sits on the inner element so the scroll area can shrink to nothing when the sheet is collapsed. */}
      <div data-testid="sheet-scroll" className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="px-4 pb-6">{children}</div>
      </div>
      <div ref={bottom} className="shrink-0">
        {footer}
      </div>
    </section>
  );
}
