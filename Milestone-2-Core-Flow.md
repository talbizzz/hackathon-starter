# Milestone 2: Core Flow

Target: live on production by Sunday 02:30 Berlin time. This is the version the team starts sharing.

## Goal

On production, a stranger on a phone can browse open spots in Neukölln or Kreuzberg, watch a spot's video, create a plan of up to three spots, share the link, and friends can vote without signing up and open directions.

## Context

- Milestone 1 delivered: tracking live (`events` table, `track()`, `/stats`), Vitest, `getDeviceId()`, `dict` and `useT()`, `LangToggle`, and the embed decision recorded in `Project-Plan.md` (read it before T2.6).
- Read `Project-Plan.md` ADR-1 to ADR-9. They define identity, data access, opening hours, embeds, polling and routing.
- `AGENTS.md`: consult `node_modules/next/dist/docs/` before writing Next code (dynamic route params are a Promise; the middleware file is `src/proxy.ts`).
- Existing conventions: Supabase clients in `src/lib/supabase/{client,server}.ts`; all copy for the old landing page in `src/lib/site-config.ts`; Tailwind utility classes, neutral palette, `rounded-lg`/`rounded-2xl`; every table has RLS enabled.
- Migrations go to the real database with `pnpm db:push`, then `pnpm db:types`.

## Scope

### In Scope

- Tables `spots`, `plans`, `votes`; column `events.anon_id`; functions `get_plan`, `cast_vote`.
- Home page as the spot list with neighbourhood switch, open-now and open-later sections, filters.
- Tap-to-load video with credit.
- Plan creation, share, plan page with voting, polling results and directions.
- Events for each step with `anon_id`.
- Both languages for every string added.

### Out of Scope

- `/stats` changes, Open Graph previews for plan links (Milestone 3).
- Thumbnails, map, GPS, accounts, story image.

## Contracts (build these first)

### Database (`supabase/migrations/20261121020000_core.sql`)

`spots`

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid pk default `gen_random_uuid()` | |
| name | text not null | |
| neighbourhood | text not null | check in (`neukoelln`, `kreuzberg`) |
| category | text not null | check in (`food`, `drinks`, `market`, `culture`, `sport`, `outdoors`, `nightlife`, `other`) |
| indoor | boolean not null default true | |
| price | smallint not null default 1 | check between 0 and 3 |
| address | text not null | |
| station | text | |
| sat_open, sat_close, sun_open, sun_close | time | nullable |
| video_url | text not null | |
| venue_handle, creator_handle | text | |
| note_en, note_de | text | |
| published | boolean not null default true | |
| created_at | timestamptz not null default now() | |

RLS on. Policy: `select` to `anon, authenticated` using `(published)`. `grant select`. No write policies.

`plans`

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid pk | supplied by the client, no default |
| spot_ids | uuid[] not null | check `cardinality(spot_ids) between 1 and 3` |
| device_id | uuid not null | |
| neighbourhood | text | |
| source | text | check `length(source) <= 100` |
| created_at | timestamptz not null default now() | |

RLS on. Policy: `insert` to `anon, authenticated` with check `(true)`. `grant insert`. No select policy.

`votes`

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid pk default `gen_random_uuid()` | |
| plan_id | uuid not null references `plans(id)` on delete cascade | |
| spot_id | uuid not null | |
| device_id | uuid not null | |
| voter_name | text not null | check `length(voter_name) between 1 and 30` |
| created_at | timestamptz not null default now() | |

Unique `(plan_id, device_id)`. RLS on, no policies.

`events`: `alter table public.events add column anon_id uuid;`

Functions, both `language plpgsql security definer set search_path = ''`, execute granted to `anon, authenticated`:

- `get_plan(p_plan_id uuid, p_device_id uuid default null) returns jsonb`
  - Returns `null` if the plan does not exist.
  - Otherwise `{ "id", "created_at", "my_vote": <spot uuid or null>, "total_votes": <int>, "spots": [ { all spots columns except published and created_at, "votes": <int>, "voters": [<name>, ...] } ] }`, spots in the order of `spot_ids`, unpublished or deleted spots omitted. `get_plan` is `stable`.
- `cast_vote(p_plan_id uuid, p_spot_id uuid, p_device_id uuid, p_name text) returns jsonb`
  - Raises `plan not found` (errcode `P0002`) if the plan is missing; raises `spot not in plan` (errcode `22023`) if `p_spot_id` is not in `spot_ids`.
  - Trims `p_name`; upserts on `(plan_id, device_id)` updating `spot_id` and `voter_name`.
  - Returns `get_plan(p_plan_id, p_device_id)`.

### Shared code (`src/lib/spots.ts`)

```ts
export type Spot = Database["public"]["Tables"]["spots"]["Row"];
export type Video = { platform: "tiktok" | "instagram"; id: string };
export type PlanSpot = Omit<Spot, "published" | "created_at"> & { votes: number; voters: string[] };
export type Plan = { id: string; created_at: string; my_vote: string | null; total_votes: number; spots: PlanSpot[] };

export function isOpenNow(spot: Hours, now: Date): boolean;
export function opensLaterToday(spot: Hours, now: Date): string | null; // "HH:MM" or null
export function parseVideo(url: string): Video | null;
export function mapsUrl(spot: { name: string; address: string }): string;
```

- `Hours` is the four time columns as `string | null` (`"HH:MM:SS"` from Postgres).
- Day and time are evaluated in `Europe/Berlin` using `Intl.DateTimeFormat`, never the device time zone.
- A window with close `<=` open runs past midnight. On Sunday before Saturday's close, a Saturday past-midnight window counts as open. On Saturday, Friday is ignored. On any other weekday every spot is closed.
- `parseVideo`: `tiktok.com/@{user}/video/{digits}` gives `{ tiktok, digits }`; `instagram.com/reel/{code}`, `/reels/{code}` or `/p/{code}` gives `{ instagram, code }`; query strings and trailing slashes ignored; anything else gives `null`.
- `mapsUrl`: `https://www.google.com/maps/dir/?api=1&destination=` + `encodeURIComponent(name + ", " + address)`.

### Events (`src/lib/analytics.ts`)

Add to `Events`: `videoPlayed: "video_played"`, `planCreated: "plan_created"`, `shareTapped: "share_tapped"`, `planOpened: "plan_opened"`, `voteCast: "vote_cast"`, `directionsTapped: "directions_tapped"`. `track()` adds `anon_id: getDeviceId()` to the `events` insert.

### Routes and test ids

- `/` spot list. `/p/[id]` plan page.
- `data-testid`: `hood-switch`, `spot-card`, `play-video`, `add-to-plan`, `plan-bar`, `share-plan`, `vote-button`, `vote-name`, `directions-link`.

## Tasks

### T2.1 — Core migration and database smoke script

- **Depends on:** —
- **Area:** database
- **What:** Write the migration per the contracts. Write `scripts/smoke-db.mjs` (plain Node, `@supabase/supabase-js`, reads `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from the environment; run with `node --env-file=.env.local scripts/smoke-db.mjs`). Then `pnpm db:push && pnpm db:types`.
- **Tests (write first):** the script, as the anonymous role, asserts: (1) `select` on `spots` succeeds; (2) inserting a plan with a client uuid, `source: "smoke-test"` and one published spot id succeeds (skip with a clear message if there are no spots yet); (3) inserting a plan with four spot ids fails; (4) `select` on `plans` and on `votes` returns no rows; (5) `get_plan` on a random uuid returns `null`; (6) `cast_vote` twice with the same device id and different names leaves `total_votes` at 1 and the latest name; (7) `cast_vote` with a spot not in the plan errors. Exits non-zero on any failure.
- **Done when:** the script exits 0 against the real project (re-run after T2.4 so nothing is skipped) and `pnpm exec tsc --noEmit` passes.

### T2.2 — Opening-hours, video and maps logic

- **Depends on:** T2.1 (for the generated `Spot` type)
- **Area:** shared
- **What:** Implement `src/lib/spots.ts` per the contract.
- **Tests (write first):** `src/lib/spots.test.ts` with fixed UTC instants: Saturday 21 Nov 2026 21:00 Berlin inside `sat 18:00–23:00` is open; same instant with `sat_open` null is closed; Sunday 01:30 Berlin inside `sat 20:00–04:00` is open; Sunday 05:00 Berlin with only that Saturday window is closed; Sunday 09:00 with `sun 10:00–18:00` is closed and `opensLaterToday` returns `"10:00"`; Sunday 12:00 is open and `opensLaterToday` returns `null`; a Monday instant is closed. `parseVideo` for a TikTok URL with query string, an Instagram `/reel/` URL with trailing slash, an Instagram `/p/` URL, a `vm.tiktok.com` short link (null) and garbage (null). `mapsUrl` encodes spaces, commas and umlauts.
- **Done when:** `pnpm test` passes.

### T2.3 — Tracking with device id

- **Depends on:** T2.1
- **Area:** shared
- **What:** Extend `Events` and `track()` per the contract. PostHog props are unchanged.
- **Tests (write first):** manual: after loading the local site in a private window, the newest `events` row in the Supabase table editor has a non-null `anon_id`, and a second event from the same window has the same value.
- **Done when:** the manual check holds and lint is clean.

### T2.4 — Load real spots

- **Depends on:** T2.1
- **Area:** database
- **What:** Import the curators' CSV through the Supabase table editor (header row equals the column names in `Project-Plan.md`, "Parallel tracks"). If the sheet is not ready, insert three real Neukölln spots by SQL to unblock development and replace them later. Check every `video_url` with `parseVideo` (a small loop in the Vitest file is fine, or a one-off script); send unparseable rows back to the curators.
- **Tests (write first):** re-run `scripts/smoke-db.mjs`; no step is skipped.
- **Done when:** at least 15 published spots exist, each with a parseable `video_url` and hours for Sunday or Saturday night.

### T2.5 — Home page: spot list

- **Depends on:** T2.2, T2.4
- **Area:** web
- **What:** Replace `src/app/(marketing)/page.tsx`: server component that selects published spots ordered by `name` and renders `<SpotList spots={...} />`. `src/components/spot-list.tsx` (client): header with product name and `LangToggle`; `hood-switch` (two buttons, default `neukoelln`, persisted in `localStorage["hood"]`); filter chips for the eight categories plus "Indoor", "Free" (`price = 0`) and "Under €15" (`price <= 1`), multi-select, categories OR-ed, flags AND-ed; section "Open now" (spots where `isOpenNow`), then section "Opens later today" (where `opensLaterToday` is non-null, sorted by that time). "Now" is computed on the client after mount and refreshed every 60 seconds. Empty state per section. `src/components/spot-card.tsx`: name, category label, `station`, price as `Free`/`€`/`€€`/`€€€`, localized note, video area (T2.6), add button (T2.7). Update `siteConfig.name`, `tagline` and `description` with the values from the branding teammate (keep placeholders if not delivered). All strings through `t()`, added to both languages.
- **Tests (write first):** extend `src/lib/i18n.test.ts` key-parity test (already fails on a missing translation). Manual on a phone-sized viewport: switching neighbourhood changes the list; each filter narrows it; with the system clock at a time when nothing is open, "Opens later today" lists spots with times.
- **Done when:** the manual checks hold locally with real spots and `pnpm test`, `pnpm lint`, `pnpm build` pass.

### T2.6 — Tap-to-load video

- **Depends on:** T2.2, and the embed decision from Milestone 1
- **Area:** web
- **What:** `src/components/video-embed.tsx` (client). Before tap: a 9:16 placeholder block with a play button (`play-video`) and the platform name; no request to TikTok or Instagram. On tap: render the iframe from ADR-5 with `allow="autoplay; encrypted-media; fullscreen; picture-in-picture"`, `loading="lazy"`, and fire `track(Events.videoPlayed, { spot_id, platform })`. Only one video is expanded at a time on the list (expanding another collapses the first). Under the video: "Video: @{creator_handle}" and "@{venue_handle}" when present, and "Open original" linking to `video_url` in a new tab. If `parseVideo` returns null, or the Milestone 1 decision was link-out for Instagram, render only the "Open original" button for that spot. Delete `src/app/embed-test/`.
- **Tests (write first):** manual: with the browser network panel open, loading `/` makes zero requests to `tiktok.com` or `instagram.com`; tapping play makes them; a second play collapses the first.
- **Done when:** the manual checks hold and a `video_played` row appears in `events`.

### T2.7 — Create and share a plan

- **Depends on:** T2.3, T2.5
- **Area:** web
- **What:** In `SpotList`, keep selected spot ids in state (max 3; the add button becomes "Added" and toggles; a fourth add shows a short hint). `plan-bar`: fixed to the bottom when at least one spot is selected, shows the count and the `share-plan` button. On tap: `id = crypto.randomUUID()`; insert `{ id, spot_ids, device_id: getDeviceId(), neighbourhood, source: getAttribution().source }` into `plans`; on error show a retry message and stop; on success `track(Events.planCreated, { plan_id: id, spots: spot_ids.length })`, then call `navigator.share({ title, text, url })` with `url = {NEXT_PUBLIC_SITE_URL}/p/{id}?utm_source=share`; if `navigator.share` is missing or rejects with anything other than `AbortError`, copy the URL to the clipboard and show "Link copied". Fire `track(Events.shareTapped)`. After sharing, show a "View plan" link to `/p/{id}`.
- **Tests (write first):** manual: adding a fourth spot is refused; after sharing, a row exists in `plans` with three ids and the right `source`; desktop Chrome (no share sheet) copies the link.
- **Done when:** the manual checks hold and a `plan_created` event with `anon_id` exists.

### T2.8 — Plan page: vote, results, directions

- **Depends on:** T2.1, T2.6
- **Area:** web
- **What:** `src/app/p/[id]/page.tsx` (server component; `params` is a Promise; `metadata` with `robots: { index: false }`) renders `<PlanView planId={id} />`. `src/components/plan-view.tsx` (client): `useQuery` on `supabase.rpc("get_plan", { p_plan_id, p_device_id: getDeviceId() })` with `refetchInterval: 3000`; fire `track(Events.planOpened, { plan_id })` once on first successful load. Not found: friendly message and a link to `/`. For each spot: the card content and `VideoEmbed` from T2.6, vote count, voter names, a `vote-button`, and a `directions-link` to `mapsUrl(spot)` opening in a new tab that fires `track(Events.directionsTapped, { plan_id, spot_id })`. A `vote-name` text input above the spots (max 30 chars, remembered in `localStorage["voter_name"]`); voting with an empty name focuses the input. Voting calls `cast_vote`, writes the returned plan into the query cache, and fires `track(Events.voteCast, { plan_id, spot_id })`. The spot with the most votes is marked as leading (no marker on a tie or at zero votes); the user's own vote is highlighted using `my_vote`. Footer link: "Make your own plan" to `/`.
- **Tests (write first):** manual with two browsers (one private window): both vote for different spots and each sees the other's vote within about 3 seconds; changing a vote moves the count and keeps `total_votes` at 2; the directions link opens Google Maps with the spot as destination; `/p/` plus a random uuid shows the not-found message.
- **Done when:** the manual checks hold locally and `pnpm test`, `pnpm lint`, `pnpm build` pass.

### T2.9 — Deploy and production phone check

- **Depends on:** T2.5, T2.6, T2.7, T2.8
- **Area:** infra
- **What:** Commit, push to `main`, wait for the deploy. Run the full flow on real phones against production, needs the teammates: one creates a plan from inside the Instagram in-app browser and shares it to the team group chat; the other two vote. Hand the production link with `utm_source` conventions to the marketing teammate.
- **Tests (write first):** production checklist: list loads in under 3 seconds on mobile data; German phone shows German copy; video plays after one tap; plan link opens from WhatsApp; three votes appear on all phones; directions open Google Maps; `/stats` shows the visits; the `events` table has `plan_created` and `vote_cast` rows with distinct `anon_id` values.
- **Done when:** every checklist item holds on production and the team has started sharing the link.

## Environment & Configuration

No new environment variables or secrets. `scripts/smoke-db.mjs` reads the existing `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from `.env.local`.

## Done Criteria

- [ ] Every task's "Done when" met
- [ ] `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm test` pass in CI
- [ ] Deployed to production and the phone checklist in T2.9 holds
- [ ] Requirements 1 to 10 and 12 of `Project-Raw.md` are satisfied on production
- [ ] At least 15 published spots are live
- [ ] No request to TikTok or Instagram happens before a tap
- [ ] The first plan created by someone outside the team is visible in the `plans` table, or the link has been shared to at least three group chats

## Risks & Watch-Outs

- Time zone: never use `new Date().getHours()` for opening hours; phones abroad and the Worker run in other zones.
- `.insert()` on `plans` must not chain `.select()`; there is no select policy and it would fail.
- Supabase returns `time` columns as `"HH:MM:SS"`; curators type `HH:MM`. Handle both in parsing.
- The home page reads cookies through the server Supabase client, so it is rendered per request; do not add caching directives without reading the Next docs.
- In-app browsers may block `navigator.share` or the clipboard; the "View plan" link is the last-resort path, so always render it after a plan is created.
- If time runs short, cut in this order: filters, "Opens later today", one-video-at-a-time behaviour. Never cut voting, sharing or tracking.
- Smoke-test rows stay in the production database tagged `source = 'smoke-test'`; Milestone 3 excludes them from stats.
