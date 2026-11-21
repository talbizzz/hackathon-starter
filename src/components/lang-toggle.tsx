"use client";

import { useT } from "@/lib/i18n";

export function LangToggle() {
  const { t, lang, setLang } = useT();
  const other = lang === "en" ? "de" : "en";
  return (
    <button
      onClick={() => setLang(other)}
      aria-label={t("lang.toggle")}
      className="rounded-lg border border-neutral-300 px-2 py-1 text-sm font-medium uppercase"
    >
      {other}
    </button>
  );
}
