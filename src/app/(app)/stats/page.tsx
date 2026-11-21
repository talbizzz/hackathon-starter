import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Stats" };

type Row = { source: string; visits: number; waitlist: number; signups: number; activated: number };

const COLUMNS = [
  { key: "visits", label: "Visits" },
  { key: "waitlist", label: "Waitlist" },
  { key: "signups", label: "Signups" },
  { key: "activated", label: "Real users" },
] as const;

// Admin-only traction numbers, straight from Supabase (see traction_stats() in supabase/migrations).
export default async function StatsPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("traction_stats");

  if (error) {
    const { data: auth } = await supabase.auth.getUser();
    return (
      <div>
        <h1 className="text-2xl font-semibold">Stats</h1>
        <p className="mt-4 text-neutral-600">Could not load stats: {error.message}</p>
        <p className="mt-4 text-neutral-600">To give this account access, run this in the Supabase SQL editor:</p>
        <pre className="mt-2 overflow-x-auto rounded-lg bg-neutral-900 p-4 text-sm text-white">
          insert into public.admins values (&apos;{auth.user?.id}&apos;);
        </pre>
      </div>
    );
  }

  const rows = (data ?? []) as unknown as Row[];
  const total = (key: (typeof COLUMNS)[number]["key"]) => rows.reduce((sum, r) => sum + r[key], 0);

  return (
    <div>
      <h1 className="text-2xl font-semibold">Stats</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Real users = signed-in users who did the core action at least once. Channel = first-touch utm_source or referrer.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        {COLUMNS.map((c) => (
          <div key={c.key} className="rounded-2xl border border-neutral-200 bg-white p-5">
            <p className="text-sm text-neutral-500">{c.label}</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums">{total(c.key)}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-neutral-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-neutral-500">
              <th className="px-5 py-3 font-medium">Channel</th>
              {COLUMNS.map((c) => (
                <th key={c.key} className="px-5 py-3 text-right font-medium">{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.source} className="border-b border-neutral-100 last:border-0">
                <td className="px-5 py-3 font-medium">{r.source}</td>
                {COLUMNS.map((c) => (
                  <td key={c.key} className="px-5 py-3 text-right tabular-nums">{r[c.key]}</td>
                ))}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length + 1} className="px-5 py-8 text-center text-neutral-500">No data yet</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
