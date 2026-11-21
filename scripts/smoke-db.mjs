// Checks the anonymous database paths against the real Supabase project.
// Usage: node --env-file=.env.local scripts/smoke-db.mjs
// Writes a test plan and vote tagged source = "smoke-test".
import { createClient } from "@supabase/supabase-js";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
let failed = 0;
function check(label, ok, detail = "") {
  console.log(`${ok ? "ok  " : "FAIL"} ${label}${ok || !detail ? "" : `: ${detail}`}`);
  if (!ok) failed++;
}

const spots = await db.from("spots").select("id").limit(4);
check("anon can read spots", !spots.error, spots.error?.message);

const random = await db.rpc("get_plan", { p_plan_id: crypto.randomUUID() });
check("get_plan on unknown id returns null", !random.error && random.data === null, random.error?.message);

const hiddenPlans = await db.from("plans").select("id").limit(1);
check("anon cannot list plans", !hiddenPlans.data?.length);
const hiddenVotes = await db.from("votes").select("id").limit(1);
check("anon cannot list votes", !hiddenVotes.data?.length);

const fakeIds = Array.from({ length: 11 }, () => crypto.randomUUID());
const tooMany = await db.from("plans").insert({ id: crypto.randomUUID(), spot_ids: fakeIds, device_id: crypto.randomUUID() });
check("plan with eleven spots is rejected", !!tooMany.error);

if (!spots.data?.length) {
  console.log("skip plan + vote checks: no published spots yet");
} else {
  const planId = crypto.randomUUID();
  const device = crypto.randomUUID();
  const spotId = spots.data[0].id;
  const plan = await db.from("plans").insert({ id: planId, spot_ids: [spotId], device_id: device, participants: 2, source: "smoke-test" });
  check("anon can create a plan", !plan.error, plan.error?.message);

  const first = await db.rpc("cast_vote", { p_plan_id: planId, p_spot_id: spotId, p_device_id: device, p_name: "First" });
  check("cast_vote works", !first.error && first.data?.total_votes === 1, first.error?.message);
  const second = await db.rpc("cast_vote", { p_plan_id: planId, p_spot_id: spotId, p_device_id: device, p_name: "Second" });
  check(
    "voting again from the same device replaces the vote",
    !second.error && second.data?.total_votes === 1 && second.data?.spots?.[0]?.voters?.[0] === "Second" && second.data?.my_vote === spotId,
    second.error?.message ?? JSON.stringify(second.data),
  );
  check("one vote of two: not finalized yet", second.data?.participants === 2 && second.data?.finalized === false);
  const other = await db.rpc("cast_vote", { p_plan_id: planId, p_spot_id: spotId, p_device_id: crypto.randomUUID(), p_name: "Third" });
  check("second voter finalizes the plan", !other.error && other.data?.total_votes === 2 && other.data?.finalized === true, other.error?.message);
  const wrong = await db.rpc("cast_vote", { p_plan_id: planId, p_spot_id: crypto.randomUUID(), p_device_id: device, p_name: "X" });
  check("vote for a spot outside the plan is rejected", !!wrong.error);
}

process.exit(failed ? 1 : 0);
