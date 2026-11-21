"use client";

import { useEffect, useRef, useState } from "react";

export type Snap = "peek" | "half" | "full";

const TOP_GAP = 76; // room left for the search bar when the sheet is fully open
const HALF = 0.52;

/** Height of the half-open sheet in pixels (browser only). */
export function halfHeight() {
  return Math.round(window.innerHeight * HALF);
}

function snapHeight(snap: Snap, peekPx: number) {
  return snap === "peek" ? peekPx : snap === "half" ? halfHeight() : window.innerHeight - TOP_GAP;
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

// A sheet over the map with three resting heights. Drag the handle, or tap it to step through them.
// The content scrolls inside the sheet, so dragging the list never moves the sheet by accident.
export function BottomSheet({ snap, onSnap, header, footer, children }: Props) {
  const drag = useRef<{ startY: number; startHeight: number; moved: boolean } | null>(null);
  const [dragHeight, setDragHeight] = useState<number | null>(null);

  // Collapsed, the sheet is exactly as tall as its header and footer, whatever they currently contain.
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

  const restingHeight = snap === "peek" ? `${peekPx}px` : snap === "half" ? `${HALF * 100}dvh` : `calc(100dvh - ${TOP_GAP}px)`;

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { startY: e.clientY, startHeight: snapHeight(snap, peekPx), moved: false };
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d) return;
    const delta = d.startY - e.clientY;
    if (Math.abs(delta) > 6) d.moved = true;
    if (d.moved) setDragHeight(Math.max(peekPx, Math.min(window.innerHeight - TOP_GAP, d.startHeight + delta)));
  }

  function onPointerUp() {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (!d.moved) {
      // A tap steps through the heights: collapsed opens to half, half to full, full back to half.
      onSnap(snap === "half" ? "full" : "half");
    } else if (dragHeight !== null) {
      const nearest = (["peek", "half", "full"] as Snap[]).reduce((best, s) =>
        Math.abs(snapHeight(s, peekPx) - dragHeight) < Math.abs(snapHeight(best, peekPx) - dragHeight) ? s : best,
      );
      onSnap(nearest);
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
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSnap(snap === "half" ? "full" : "half")}
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
