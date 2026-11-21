"use client";

import { useT } from "@/lib/i18n";

export function LangToggle() {
  const { t, lang, setLang } = useT();
  const other = lang === "en" ? "de" : "en";
  return (
    <button
      onClick={() => setLang(other)}
      aria-label={t("lang.toggle")}
      className="rounded-full border border-neutral-300 px-3 py-2.5 text-sm font-semibold uppercase"
    >
      {other}
    </button>
  );
}
