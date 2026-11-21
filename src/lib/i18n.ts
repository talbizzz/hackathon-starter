import { useSyncExternalStore } from "react";

export type Lang = "en" | "de";

// ALL UI copy lives here. Both languages must have the same keys (enforced by i18n.test.ts).
export const dict: Record<Lang, Record<string, string>> = {
  en: {
    "lang.toggle": "Switch language",
    "app.tagline": "Pick up to 3 spots. Send one link. Your friends vote.",
    "search.placeholder": "Search activities",
    "card.video": "Video",
    "reel.close": "Close",
    "reel.soundOn": "Turn sound on",
    "reel.soundOff": "Turn sound off",
    "reel.swipe": "Swipe up for the nearest spot",
    "status.closed": "Closed now",
    "sheet.spots": "spots",
    "sheet.spot": "spot",
    "sheet.openNow": "open now",
    "section.closed": "Closed right now",
    "section.openNow": "Open now",
    "section.later": "Opens later today",
    "section.tomorrow": "Tomorrow (Sunday)",
    "spot.sunday": "Sun",
    "vote.vote": "vote",
    "share.failed": "Sharing is blocked in this browser. Open the plan and copy its link.",
    "section.empty": "Nothing here with these filters.",
    "spot.opensAt": "Opens at",
    "cat.food": "Food",
    "cat.drinks": "Drinks",
    "cat.market": "Market",
    "cat.culture": "Culture",
    "cat.sport": "Sport",
    "cat.outdoors": "Outdoors",
    "cat.nightlife": "Nightlife",
    "cat.other": "Other",
    "filter.indoor": "Indoor",
    "filter.free": "Free",
    "filter.cheap": "Under €15",
    "price.free": "Free",
    "video.original": "Open original",
    "video.by": "Video",
    "plan.add": "Add to plan",
    "plan.added": "Added ✓",
    "plan.max": "A plan has at most 3 spots.",
    "plan.picked": "picked",
    "plan.share": "Send to friends",
    "plan.error": "Could not save the plan. Tap again.",
    "plan.copied": "Link copied",
    "plan.view": "View plan",
    "plan.shareText": "Where are we going? Vote here:",
    "vote.title": "Where are we going?",
    "vote.intro": "Watch, then vote for one.",
    "vote.name": "Your first name",
    "vote.button": "Vote for this",
    "vote.mine": "Your vote ✓",
    "vote.leading": "Leading",
    "vote.votes": "votes",
    "vote.directions": "Take us there",
    "vote.notFound": "This plan does not exist.",
    "vote.loading": "Loading…",
    "vote.error": "That did not work. Try again.",
    "vote.own": "Make your own plan",
    "vote.share": "Share this plan",
  },
  de: {
    "lang.toggle": "Sprache wechseln",
    "app.tagline": "Wähl bis zu 3 Spots. Schick einen Link. Deine Freunde stimmen ab.",
    "search.placeholder": "Aktivität suchen",
    "card.video": "Video",
    "reel.close": "Schließen",
    "reel.soundOn": "Ton an",
    "reel.soundOff": "Ton aus",
    "reel.swipe": "Nach oben wischen für den nächsten Spot",
    "status.closed": "Gerade geschlossen",
    "sheet.spots": "Spots",
    "sheet.spot": "Spot",
    "sheet.openNow": "jetzt geöffnet",
    "section.closed": "Gerade geschlossen",
    "section.openNow": "Jetzt geöffnet",
    "section.later": "Öffnet später heute",
    "section.tomorrow": "Morgen (Sonntag)",
    "spot.sunday": "So",
    "vote.vote": "Stimme",
    "share.failed": "Teilen ist in diesem Browser blockiert. Öffne den Plan und kopiere den Link.",
    "section.empty": "Nichts gefunden mit diesen Filtern.",
    "spot.opensAt": "Öffnet um",
    "cat.food": "Essen",
    "cat.drinks": "Drinks",
    "cat.market": "Markt",
    "cat.culture": "Kultur",
    "cat.sport": "Sport",
    "cat.outdoors": "Draußen",
    "cat.nightlife": "Nachtleben",
    "cat.other": "Sonstiges",
    "filter.indoor": "Drinnen",
    "filter.free": "Kostenlos",
    "filter.cheap": "Unter 15 €",
    "price.free": "Kostenlos",
    "video.original": "Original öffnen",
    "video.by": "Video",
    "plan.add": "Zum Plan",
    "plan.added": "Dabei ✓",
    "plan.max": "Ein Plan hat höchstens 3 Spots.",
    "plan.picked": "ausgewählt",
    "plan.share": "An Freunde senden",
    "plan.error": "Plan konnte nicht gespeichert werden. Tipp nochmal.",
    "plan.copied": "Link kopiert",
    "plan.view": "Plan ansehen",
    "plan.shareText": "Wohin gehen wir? Stimm hier ab:",
    "vote.title": "Wohin gehen wir?",
    "vote.intro": "Schau rein und stimm für einen ab.",
    "vote.name": "Dein Vorname",
    "vote.button": "Dafür stimmen",
    "vote.mine": "Deine Stimme ✓",
    "vote.leading": "Vorne",
    "vote.votes": "Stimmen",
    "vote.directions": "Bring uns hin",
    "vote.notFound": "Diesen Plan gibt es nicht.",
    "vote.loading": "Lädt…",
    "vote.error": "Das hat nicht geklappt. Versuch es nochmal.",
    "vote.own": "Eigenen Plan erstellen",
    "vote.share": "Plan teilen",
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
