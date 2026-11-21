import { useSyncExternalStore } from "react";

export type Lang = "en" | "de";

// ALL UI copy lives here. Both languages must have the same keys (enforced by i18n.test.ts).
export const dict: Record<Lang, Record<string, string>> = {
  en: {
    "lang.toggle": "Switch language",
    "hood.neukoelln": "Neukölln",
    "hood.kreuzberg": "Kreuzberg",
  },
  de: {
    "lang.toggle": "Sprache wechseln",
    "hood.neukoelln": "Neukölln",
    "hood.kreuzberg": "Kreuzberg",
  },
};

export function detectLang(saved: string | null, browser: string | undefined): Lang {
  if (saved === "en" || saved === "de") return saved;
  return browser?.toLowerCase().startsWith("de") ? "de" : "en";
}

const KEY = "lang";
const listeners = new Set<() => void>();
let chosen: Lang | null = null;

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

function currentLang(): Lang {
  if (chosen) return chosen;
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(KEY);
  } catch {}
  return detectLang(saved, navigator.language);
}

function setLang(lang: Lang) {
  chosen = lang;
  try {
    localStorage.setItem(KEY, lang);
  } catch {}
  listeners.forEach((notify) => notify());
}

/** Client components only. Renders English on the server, then switches to the visitor's language. */
export function useT() {
  const lang = useSyncExternalStore(subscribe, currentLang, () => "en" as Lang);
  const t = (key: string) => dict[lang][key] ?? key;
  return { t, lang, setLang };
}
