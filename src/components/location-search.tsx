"use client";

import { useState } from "react";
import { findAreas, type Area } from "@/lib/areas";
import { useT } from "@/lib/i18n";

type Props = {
  /** The area the map is showing, or null for the whole city. */
  area: Area | null;
  onPick: (area: Area | null) => void;
};

// Search for a part of Berlin; picking one moves the map there.
export function LocationSearch({ area, onPick }: Props) {
  const { t } = useT();
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const matches = findAreas(text).slice(0, 7);

  function pick(next: Area | null) {
    onPick(next);
    setText("");
    setOpen(false);
    // Put the keyboard away so the map is visible.
    (document.activeElement as HTMLElement | null)?.blur();
  }

  return (
    <div className="pointer-events-auto relative min-w-0 flex-1">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (matches[0]) pick(matches[0]);
        }}
      >
        <input
          type="search"
          data-testid="location-search"
          value={open ? text : (area?.name ?? "")}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          // Let a tap on a suggestion land before the list closes.
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={t("location.placeholder")}
          autoComplete="off"
          className="w-full rounded-full border border-neutral-300 bg-white px-4 py-3 shadow-md"
        />
      </form>
      {open && (
        <ul data-testid="location-options" className="absolute inset-x-0 top-full mt-2 max-h-[50vh] overflow-y-auto rounded-2xl bg-white py-1 shadow-lg">
          {area && (
            <li>
              <button onMouseDown={(e) => e.preventDefault()} onClick={() => pick(null)} className="w-full px-4 py-3 text-left font-medium">
                {t("location.all")}
              </button>
            </li>
          )}
          {matches.map((a) => (
            <li key={a.name}>
              <button data-testid="location-option" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(a)} className="w-full px-4 py-3 text-left">
                {a.name}
              </button>
            </li>
          ))}
          {matches.length === 0 && <li className="px-4 py-3 text-secondary">{t("location.none")}</li>}
        </ul>
      )}
    </div>
  );
}
