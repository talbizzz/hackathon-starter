// Pure helpers for spots: opening hours (this weekend only) and directions.
import type { Database } from "@/lib/database.types";

export type Spot = Database["public"]["Tables"]["spots"]["Row"];
/** What get_plan / cast_vote return (see supabase/migrations/20261121020000_core.sql). */
export type PlanSpot = Omit<Spot, "published" | "created_at"> & { votes: number; voters: string[] };
export type Plan = { id: string; created_at: string; my_vote: string | null; total_votes: number; spots: PlanSpot[] };

/** Opening hours as Postgres `time` strings ("HH:MM" or "HH:MM:SS"). A null open time means closed that day. */
export type Hours = {
  sat_open: string | null;
  sat_close: string | null;
  sun_open: string | null;
  sun_close: string | null;
};

const berlinClock = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Berlin",
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

// Always Berlin time, never the device's or the server's time zone.
function berlinNow(now: Date) {
  const parts = Object.fromEntries(berlinClock.formatToParts(now).map((p) => [p.type, p.value]));
  return { day: parts.weekday, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}

function toMinutes(time: string) {
  const [h, m] = time.split(":");
  return Number(h) * 60 + Number(m);
}

// A window whose close is not after its open runs past midnight into the next day.
function dayWindow(open: string | null, close: string | null) {
  if (!open) return null;
  const from = toMinutes(open);
  const to = close ? toMinutes(close) : 24 * 60;
  return { from, to, pastMidnight: to <= from };
}

export function isOpenNow(spot: Hours, now: Date): boolean {
  const { day, minutes } = berlinNow(now);
  const sat = dayWindow(spot.sat_open, spot.sat_close);
  const sun = dayWindow(spot.sun_open, spot.sun_close);
  const inWindow = (w: ReturnType<typeof dayWindow>) => !!w && minutes >= w.from && (w.pastMidnight || minutes < w.to);
  if (day === "Sat") return inWindow(sat);
  if (day === "Sun") return inWindow(sun) || (!!sat && sat.pastMidnight && minutes < sat.to);
  return false;
}

/** "HH:MM" if the spot is closed now but opens later today, else null. */
export function opensLaterToday(spot: Hours, now: Date): string | null {
  const { day, minutes } = berlinNow(now);
  const open = day === "Sat" ? spot.sat_open : day === "Sun" ? spot.sun_open : null;
  if (!open || toMinutes(open) <= minutes || isOpenNow(spot, now)) return null;
  return open.slice(0, 5);
}

/** On Saturday, Sunday's opening time ("HH:MM"), so people can plan the next day; otherwise null. */
export function opensTomorrow(spot: Hours, now: Date): string | null {
  return berlinNow(now).day === "Sat" && spot.sun_open ? spot.sun_open.slice(0, 5) : null;
}

export function mapsUrl(spot: { name: string; address: string }): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${spot.name}, ${spot.address}`)}`;
}
