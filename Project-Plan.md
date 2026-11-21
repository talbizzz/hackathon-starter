# Kiez Plan (working title) — Project Plan

Deadline: Sunday 22 November 2026, 16:00 Berlin time. One engineer. Written Saturday about 20:20.

## Decisions Carried Over

From `Project-Raw.md` and the starter repo. Not up for re-decision.

- Build inside this repo (`/Users/aziztalbi/hackathon-starter`). Next.js 16 App Router, TypeScript, Tailwind, Supabase (Postgres, Auth, RLS), TanStack Query, PostHog, Cloudflare Workers via OpenNext, pnpm only.
- `AGENTS.md` rule: read the relevant guide in `node_modules/next/dist/docs/` before writing Next code. Middleware file is `src/proxy.ts`.
- Workers: Web APIs and `fetch` only. No Node-only libraries in app code.
- Environments: local dev and production only. "Deployed" in this plan always means production.

> **Plan updated:** the repo has no git remote, so the GitHub Actions workflow never runs. Deploy with `pnpm deploy` from the engineer's machine (wrangler is logged in); run `pnpm test` first by hand. Production URL: `https://hackathon-starter.a-talbi890.workers.dev`. Wherever a milestone says "push to `main`", read "commit on `main`, then `pnpm deploy`". (21 Nov 2026)

> **Plan updated:** `supabase/migrations/20261121010000_traction.sql` was already applied to the live database when Milestone 1 started; the generated types match the hand-edited ones and a scripted signup smoke test passed. (21 Nov 2026)
- Tracking from branch `traction-tracking`: `track()` in `src/lib/analytics.ts` writes to PostHog and the Supabase `events` table with first-touch `source` and `campaign`; `/stats` is admin-only. Migration `supabase/migrations/20261121010000_traction.sql` is written but not applied.
- Visitors never need an account. Existing auth stays for admins (`/stats`) only.
- Web only, mobile-first, must work inside the Instagram and TikTok in-app browsers.
- Content: official embeds only, loaded on tap. No scraping, downloading or re-hosting. No embed API calls at page-view time.
- Launch area: Neukölln and Kreuzberg, 40 to 60 curated spots, one video each.
- UI in German and English from one small dictionary; browser language decides, manual toggle.
- Team: one engineer; one person on Instagram, ads and outreach; one on branding, pitch and slides. Curation must not fall on the engineer.
- Budget: €150 for ads.

## Architecture Decision Records

### ADR-1: Anonymous identity is a device id in localStorage

- **Decision:** `getDeviceId()` creates a `crypto.randomUUID()` once per browser, stored under `localStorage["device_id"]` (in-memory fallback if storage throws). It is sent with every event (`events.anon_id`), plan (`plans.device_id`) and vote (`votes.device_id`).
- **Why:** Lets us count distinct real people and enforce one vote per device with no signup and no auth configuration.
- **Rejected:** Supabase anonymous sign-ins (extra dashboard setup, session handling in in-app browsers, more to break). IP-based identity (shared networks at the venue and in flats).

### ADR-2: Plans store their spots as an array; votes go through RPCs

- **Decision:** `plans.spot_ids uuid[]` (1 to 3 entries). The client generates the plan id (`crypto.randomUUID()`) and inserts directly. `plans` and `votes` have no select policy; reads go through `get_plan`, votes through `cast_vote`, both `security definer`.
- **Why:** One insert creates a plan with no transaction. Without select policies nobody can list plans through the API, so the uuid in the link is the only way in. `cast_vote` validates that the spot belongs to the plan and lets a voter change their vote.
- **Rejected:** A `plan_spots` join table (needs a multi-row transactional write from anonymous clients). Open select policies on `plans` and `votes` (anyone could enumerate all plans and voter names).

### ADR-3: Opening hours are four plain time columns for this weekend

- **Decision:** `spots.sat_open`, `sat_close`, `sun_open`, `sun_close` (`time`, nullable; null open means closed that day; close earlier than or equal to open means it closes after midnight). `isOpenNow(spot, now)` evaluates them in the `Europe/Berlin` time zone, including Saturday's window running into Sunday morning.
- **Why:** The product only has to be right until Sunday 16:00, and plain columns can be typed into a sheet and imported as CSV in the Supabase table editor.
- **Rejected:** A weekly schedule model (more logic than two days need). JSON windows (cannot be CSV-imported or edited by curators).

### ADR-4: Curators work in a sheet; import is the Supabase table editor's CSV import

- **Decision:** One shared sheet whose header row is exactly the `spots` columns listed under "Parallel tracks". The engineer imports CSV exports through the Supabase dashboard. Later fixes are made directly in the table editor.
- **Why:** No import script, no service-role key in the repo, and curators can start before any code exists.
- **Rejected:** An admin UI (hours of work). A script with the service-role key (new secret, new failure mode).

### ADR-5: Videos are iframes built from the pasted URL; no embed API at runtime

- **Decision:** Curators paste the full post URL into `video_url`. `parseVideo(url)` derives `{ platform, id }`. On tap the card renders an iframe: TikTok `https://www.tiktok.com/player/v1/{id}?autoplay=1&music_info=1&description=1`, Instagram `https://www.instagram.com/p/{shortcode}/embed/`. Before the tap, nothing from TikTok or Instagram is loaded.
- **Why:** Both URLs were confirmed on 21 November 2026 to respond without a token and without frame-blocking headers. No rate limits, no stored HTML, and third-party trackers load only after an interaction.
- **Rejected:** Calling oEmbed per view (rate limit, latency). `embed.js` blockquotes (extra script, layout shift). Video thumbnails in v1 (TikTok thumbnail URLs are signed and may expire; cards must look good without an image).

### ADR-6: Live results by polling

- **Decision:** The plan page calls `get_plan` through TanStack Query with `refetchInterval: 3000`.
- **Why:** Good enough for a group of five and needs no extra database configuration.
- **Rejected:** Supabase Realtime (needs select policies and publication setup that ADR-2 deliberately avoids).

### ADR-7: Languages via a client-side dictionary

- **Decision:** `src/lib/i18n.ts` exports `dict = { en: {...}, de: {...} }` and `useT()`. Language is `localStorage["lang"]`, else `navigator.language` starting with `de`, else `en`. Server render uses English; the client switches after mount. A toggle in the header flips it.
- **Why:** Smallest thing that gives both languages. Spot names are not translated; the optional one-line note has `note_en` and `note_de`.
- **Rejected:** Locale routes (`/de`, `/en`) and i18n libraries (routing and setup work with no user benefit this weekend).

### ADR-8: The home page is the product

- **Decision:** `/` (currently `src/app/(marketing)/page.tsx`) becomes the spot list. The plan page is `/p/[id]`. The waitlist section is removed from the page; `waitlist-form.tsx` stays in the repo unused. `/login`, `/signup`, `/dashboard`, `/stats` stay as they are.
- **Why:** Every visitor from an ad must land directly in the core flow.
- **Rejected:** A separate landing page in front of the app (one more step before the first real-user action).

### ADR-9: Location is a neighbourhood switch and a station name

- **Decision:** No GPS in v1. The user picks Neukölln or Kreuzberg (default Neukölln, remembered in localStorage). Each card shows `station` (for example "U Hermannplatz") as the distance hint. Directions open `https://www.google.com/maps/dir/?api=1&destination={name, address}`.
- **Why:** Geolocation prompts are unreliable in in-app browsers, and a walking time cannot be computed without a position.
- **Rejected:** GPS-based sorting and coordinates per spot (more curation work, more failure modes).

### ADR-10: Tests are Vitest for pure logic plus a database smoke script

- **Decision:** Vitest covers pure functions (`isOpenNow`, `parseVideo`, `mapsUrl`, dictionary completeness). `scripts/smoke-db.mjs` exercises the anonymous database paths against the real project. UI is verified with the manual phone checklist in each milestone. CI runs `pnpm test` before the build; the build itself typechecks.
- **Why:** There is no local database (no Docker on the machine) and 19 hours; these catch the failures that would break the demo.
- **Rejected:** pgTAP, Playwright (setup time exceeds their value before Sunday).

## Architecture Overview

- Browser (often an in-app browser) loads `/` from the Cloudflare Worker. The server component reads published `spots` from Supabase with the anon key and passes them to a client component that handles language, neighbourhood, open-now, filters and plan selection.
- Creating a plan: the client inserts one row into `plans` (client-generated uuid), then opens the share sheet with `{SITE_URL}/p/{id}`.
- Plan page: client calls `get_plan(p_plan_id, p_device_id)` every 3 seconds and `cast_vote(...)` on tap. Both are Postgres functions; there are no custom API routes.
- Video: on tap, an iframe to TikTok or Instagram. Nothing is proxied or stored.
- Tracking: `track()` sends to PostHog and inserts into `events` with `anon_id`, `source`, `campaign`. `/stats` reads through the admin-only `traction_stats()` function.
- No background jobs. No AI in v1.

## Repository Structure

New and changed paths only:

```
src/app/(marketing)/page.tsx        home: server component, fetches spots
src/app/p/[id]/page.tsx             plan page
src/app/embed-test/page.tsx         spike, deleted in Milestone 2
src/components/spot-list.tsx        client: neighbourhood, filters, sections, plan bar
src/components/spot-card.tsx
src/components/video-embed.tsx      tap-to-load iframe
src/components/plan-view.tsx        client: vote, polling results, directions
src/components/lang-toggle.tsx
src/lib/spots.ts                    types, isOpenNow, opensLaterToday, parseVideo, mapsUrl
src/lib/spots.test.ts
src/lib/device.ts                   getDeviceId
src/lib/i18n.ts                     dict, useT
src/lib/i18n.test.ts
src/lib/analytics.ts                events + anon_id
scripts/smoke-db.mjs
supabase/migrations/20261121020000_core.sql
vitest.config.ts
```

## Parallel tracks (not engineering)

These start now and do not wait for code.

**Curation sheet.** Header row, exactly these column names:

`name, neighbourhood, category, indoor, price, address, station, sat_open, sat_close, sun_open, sun_close, video_url, venue_handle, creator_handle, note_en, note_de`

- `neighbourhood`: `neukoelln` or `kreuzberg`.
- `category`: one of `food`, `drinks`, `market`, `culture`, `sport`, `outdoors`, `nightlife`, `other`.
- `indoor`: `true` or `false`. `price`: `0` free, `1` under €15, `2` €15 to €30, `3` over €30.
- Times as `HH:MM`, empty if closed that day. A place open Saturday 20:00 to Sunday 04:00 is `sat_open 20:00`, `sat_close 04:00`.
- `video_url`: the full link from a browser (`https://www.tiktok.com/@name/video/123...` or `https://www.instagram.com/reel/ABC.../`), not a short share link. Open each video once to confirm it is public.
- Handles without `@`. Notes are one short line each and optional.
- Target: 20 spots by Saturday 23:30 (weighted to Sunday daytime), 40 or more by Sunday 10:00.

**Marketing.** Create the Meta ad account and submit a first ad tonight so review is done by morning. Every shared link carries `?utm_source=...&utm_campaign=...` (for example `utm_source=instagram_ad`, `whatsapp`, `venue_repost`, `tiktok_ad`).

## Pre-Mortem Mitigations

| Risk | Mitigation | Where |
| --- | --- | --- |
| 1. Too few real users | Shareable production version Saturday night; team shares to own group chats immediately; ads and outreach run in parallel; per-channel numbers on `/stats` | M2 done criteria (T2.9), Parallel tracks, M3 |
| 2. Content never curated | Sheet contract defined now so curation starts before code; launch threshold is 15 spots; CSV import, no tooling | Parallel tracks, ADR-4, T2.4 |
| 3. Embeds bad on real phones | Spike on a deployed page tested in both in-app browsers before any feature work; fallback is link-out for Instagram | T1.4, ADR-5 |
| 4. Scope creep | Fixed order; map, GPS, AI, accounts, story image, thumbnails are non-goals; M3 and M4 are stubs that cannot start before M2 is live | Milestone order, Out of Scope |
| 5. Real users not provable | `anon_id` recorded on every event from the first production visit; `/stats` counts distinct people who created a plan or voted | T2.1, T2.3, M3 |
| 6. Production breaks at launch | Pending migration applied and signup smoke-tested first; database smoke script; phone checklist per milestone; freeze at Sunday 13:00 | T1.1, T1.2, T2.1, T2.9, M4 |
| 7. Vote spam | Unique `(plan_id, device_id)`; name length limit; no select policies; plan ids are random uuids | T2.1, ADR-2 |
| 8. Jury questions on rights and privacy | Official embeds, visible credit and link to the original, tap-to-load; answer rehearsed in the pitch | T2.6, M4 |

## Milestones

Target times are Berlin time.

| # | Name | Goal | Depends on | Target | Status |
| --- | --- | --- | --- | --- | --- |
| 1 | Foundation | Pending tracking is live on production, the embed approach is proven on real phones, and test and language scaffolding exist | — | Sat 21:45 | Detailed |
| 2 | Core Flow | A stranger can browse open spots, watch a video, create a plan, share it, and friends can vote and get directions, on production | 1 | Sun 02:30 | Detailed |
| 3 | Measure and Polish | `/stats` proves real users per channel; plan links preview well in chats; rough edges from first real use are fixed | 2 | Sun 12:00 | Stub |
| 4 | Launch Freeze | Production is frozen and demo-ready; pitch numbers are pulled | 3 | Sun 15:00 | Stub |

## Out of Scope for v1

Scraping or re-hosting video; an autoplay feed; visitor accounts; user-submitted spots; map view; GPS; AI recommendations; booking; native apps; other neighbourhoods; video thumbnails; a consent banner; story-image generator (only if M3 finishes early).

## Open Technical Risks

> **Plan updated:** embed spike result (21 Nov 2026, iPhone, Instagram in-app browser, production `/embed-test`): TikTok plays inline with sound after one tap. Instagram loads after our tap, then needs a second tap on Instagram's own play button, and plays inline with sound. Desktop Chrome: Instagram plays inline with sound. Not tested: TikTok in-app browser, Android. **Decision: both platforms are embedded inline; no link-out fallback for Instagram.** Consequences for T2.6: the button reads "Load video" for Instagram spots; cap the video height at about 70% of the viewport (a full-width 9:16 frame is taller than the phone screen); the Instagram iframe needs about 720px for its header and footer; Instagram plays once, replay opens Instagram. Curators should prefer TikTok when both exist.

- Instagram reels inside an iframe on mobile may show a poster that opens Instagram instead of playing inline. T1.4 decides; fallback is a "Watch on Instagram" link.
- `supabase/migrations/20261121010000_traction.sql` has never been executed. T1.1 is the first run.
- Posts whose owners disabled embedding will show an error inside the iframe; only curation can catch this.
- Polling every 3 seconds per open plan page is fine at hackathon scale and not beyond it.
- The database smoke script writes test rows to the production database; they are tagged `source = 'smoke-test'` and excluded from stats in M3.
