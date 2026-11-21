# Kiez Plan (working title, name not decided)

## Summary

A mobile web app for people in Berlin who want to decide what to do right now with friends. A user opens a link, sees a small curated set of spots in their neighbourhood that are open now (each with one embedded TikTok or Instagram video as proof it is worth going), picks up to three, and shares the shortlist to a group chat. Friends vote with one tap and no signup; the winner comes with directions. It is built during a 26-hour hackathon and must be live with real users by Sunday 22 November 2026, 16:00 Berlin time.

Positioning: "TikTok is for scrolling, we are for deciding." The app is complementary to TikTok and Instagram: they provide inspiration and distribution, this app handles the decision and group coordination, Google Maps handles navigation.

## Problem Statement

Young people in Berlin discover places on TikTok and Instagram (one cited Google finding: nearly 40% of young users go to TikTok or Instagram when looking for a place to eat), but those feeds are ranked for engagement, not for "what can we actually do near here today". Videos may be weeks old and show places that are closed. The decision then moves to a group chat where friends paste links and argue. Sundays in Berlin make this worse because much is closed. Nothing connects "that looks cool" to "we are going there at 8".

## Target Users

- Primary: people aged roughly 18 to 35 who are in Neukölln or Kreuzberg this weekend and are planning something with 2 to 5 friends via a group chat.
- They arrive from Instagram or TikTok (story link, bio link, creator caption, paid ad), so the app opens inside those apps' in-app browsers on a phone.
- Expected scale for v1: hundreds of visitors, target of 100+ people who create a shortlist or vote before Sunday 16:00.

## Proposed Solution

Core journey (creator of a plan):

1. Lands on the site from a social link. No install, no signup.
2. Neighbourhood is preselected (Neukölln by default) and can be switched to Kreuzberg by hand. GPS is optional, never required.
3. Sees about a dozen spot cards that are open now: name, category, walking or transit time hint, price hint, video thumbnail.
4. Taps a card to load and play the venue's TikTok or Instagram video in place (tap-to-load embed), with creator and venue credited by handle and a link to the original post.
5. Filters by a few tags (for example indoor, food, free, under €15).
6. Adds up to three spots to a plan. A bottom bar shows the count.
7. Taps "send to friends": the native share sheet opens with a unique plan link.

Core journey (friend):

1. Opens the plan link from the group chat.
2. Sees only the shortlisted spots with their videos.
3. Enters a first name and taps one spot to vote. No signup.
4. Sees live results and the current winner.
5. Anyone taps "take us there": opens Google Maps directions to the winner.

Optional loop: the winner screen offers a story-sized image ("our Sunday plan") carrying the site link.

What makes it different from TikTok Nearby, Instagram's map and Google Maps: only spots open now, human-curated, filters that matter for going out, and a group vote. Different from the many "save a reel to a map" apps: zero setup, the user brings no content.

## Decisions Already Made

- Golden path / template: the existing repo at `/Users/aziztalbi/hackathon-starter` (this folder). Build inside it. Do not re-scaffold.
- Stack (fixed): Next.js 16 App Router with TypeScript and Tailwind, Supabase (Postgres, Auth, RLS), TanStack Query, PostHog, Cloudflare Workers via OpenNext, pnpm only.
- Next.js rule from `AGENTS.md`: this Next version has breaking changes; read the relevant guide in `node_modules/next/dist/docs/` before writing code. The middleware file is `src/proxy.ts`.
- Workers constraint: Web APIs and `fetch` only, no Node-only libraries.
- Environments: local dev and production only. Pushing to `main` deploys via `.github/workflows/deploy.yml`.
- AI route exists at `src/app/api/ai/route.ts` (anthropic, openai or bedrock) but v1 does not depend on AI.
- Tracking already built on branch `traction-tracking` (not yet merged to `main`): `track()` in `src/lib/analytics.ts` writes to PostHog and to a Supabase `events` table with first-touch channel attribution; `/stats` shows visits, waitlist, signups and activated users per channel for admins. Its migration `supabase/migrations/20261121010000_traction.sql` has NOT been applied to the remote database and has not been run anywhere. Apply it (`pnpm db:push`, then `pnpm db:types`) and smoke-test signup before merging.
- Supabase Auth: email confirmation is off. Voting and plan creation must not require an account.
- Web only, mobile-first. No native app.
- Content sourcing: official platform embeds only (TikTok Embed Player iframe; Instagram oEmbed/embed code). No scraping, no downloading or re-hosting video. Both embed endpoints were confirmed on 21 November 2026 to return embed code without a token. Fetch embed data once at curation time and store it; never call the embed APIs per page view (Instagram tokenless limit: 1,000 requests per hour).
- Launch area: Neukölln and Kreuzberg only. 40 to 60 hand-curated spots, one video each.
- UI language: German and English. Implement as one small copy dictionary with the language picked from the browser setting and a manual toggle. Spot names and handles are not translated; keep per-spot free text to a minimum so curators do not write everything twice.
- Team and ownership: 3 people. One engineer builds the whole product alone. One person owns Instagram, ads and outreach. One person owns branding, pitch and slides. Spot curation has no owner yet (see Open Questions) and must not fall on the engineer.
- Marketing budget: €150 in total, intended for Meta and TikTok ads.

## Competitive Landscape

From a quick web search on 21 November 2026 (app store and Product Hunt listings, self-reported features, no usage or funding data found):

- Platforms: TikTok Nearby Feed (live in Germany), Instagram's searchable map, Google tests of social video in local results. Biggest threat; the core "videos near me" feature is a tab inside apps users already have.
- "Save a reel to a map" apps: Pingo, TokSpot, Plotline, TripTok, ReelTravel, GeoTok, Punkt AI, Mapkeepr, Somedays, Doko, PinPoint. Saturated; all require the user to save content first. Do not build this.
- Nearby social discovery: Roam.
- Berlin guides: Going Local Berlin, ABOUT BERLIN, Raaago, Berlin Guide and Tours. Editorial, not video-led.
- Berlin events and activities: GetYourGuide, Rausgegangen, Fever (from memory, not searched).
- No Berlin-specific curated video shortlist with group voting was found; one search is not proof of absence, and group-plan voting tools were not researched.
- Honest weaknesses: differentiation rests on curation and the group vote, both easy to copy; the content is borrowed; the Layla.ai CEO on the jury built a product around social travel video and will probe content rights and differentiation.

## Pre-Mortem

Framed as: "It is Sunday 16:00 and we lost. Why?"

| #   | Failure cause | Likelihood | Impact | Mitigation |
| --- | ------------- | ---------- | ------ | ---------- |
| 1 | Too few real users: people visit but do not create a plan or vote, or nobody visits at all. | High | High | Ship a usable version on Saturday night and send it to the team's own group chats first. Start ads and venue/creator outreach as soon as the page is live, not after polish. Review `/stats` every few hours and move budget to the best channel. |
| 2 | Content never gets curated: fewer than 40 spots with working videos and correct Sunday opening hours. | High | High | Start curation in hour one, in parallel with the build, in a shared sheet with fixed columns. Launch with 15 to 20 spots if needed. Assign named owners. |
| 3 | Embeds behave badly on real phones: slow, Instagram reels do not play inline, broken inside Instagram's or TikTok's in-app browser. | Medium | High | First technical task is a spike: one TikTok and one Instagram embed on a deployed page, opened inside both in-app browsers on iOS and Android. Use tap-to-load. If Instagram does not play inline, use TikTok videos and link out to Instagram. |
| 4 | Scope creep: map view, accounts, AI recommendations, GPS, story image all started, core vote flow unfinished. | High | High | Build order is fixed: spot list, plan creation, share link, vote, results. Everything else is an explicit non-goal until that works in production. |
| 5 | Real users cannot be shown on stage: anonymous votes are not counted, or the numbers look like page views. | Medium | High | Extend tracking so a "real user" is a distinct person (anonymous device id) who created a plan or voted; show it on `/stats`. Do this before launch, not Sunday afternoon. |
| 6 | Production breaks at launch: unapplied or faulty migration, RLS blocks anonymous inserts, deploy fails. | Medium | High | Apply and smoke-test the pending tracking migration first. Test every write path as an anonymous user in production. Keep `main` deployable; no risky changes after Sunday 13:00. |
| 7 | Vote spam or abuse of open anonymous writes skews numbers or breaks a demo plan. | Low | Medium | One vote per device id per plan enforced by a unique constraint; length limits on names; plans are unguessable ids. |
| 8 | Jury challenges content rights, privacy or "why not TikTok". | Medium | Medium | Official embeds only with visible credit; tap-to-load so third-party trackers load only on interaction; rehearse the one-line answer: "they are for scrolling, we are for deciding". |

## Risks & Open Questions

- Curation owner is not assigned. Recommendation: the two non-engineers split it tonight (target 20 spots each), using a shared sheet with fixed columns that the engineer imports into Supabase.
- €150 is thin for two ad platforms. Recommendation: put it all on Meta (Instagram) and create the ad account and first ad immediately, because new accounts and ads go through a review that can take hours (from memory, not verified). Most real users are expected from unpaid channels: the team's own group chats and reposts by featured venues and creators.
- Whether existing Meta or TikTok ad accounts are available is unknown.
- Whether Instagram reels play inline in an embed on mobile is unverified. Whether geolocation prompts work inside in-app browsers is unverified (hence GPS is optional).
- Creators can disable embedding per post; each curated video must be checked.
- The group vote as the differentiator is a hypothesis, not validated with users.
- "Open now" needs opening hours per spot for Saturday night and Sunday; source is manual entry by curators.
- Product name and domain are not decided.
- German consent expectations for third-party embeds and analytics: tap-to-load covers embeds; a full consent banner is out of scope unless the team decides otherwise.

## Scope & Constraints

v1 includes:

- Curated spots for Neukölln and Kreuzberg stored in Supabase, each with name, neighbourhood, category/tags, price hint, address or coordinates, opening hours for this weekend, one video (platform, URL, stored embed data), creator and venue handles.
- Landing page that is the product: neighbourhood switch, "open now" list, tag filters.
- Tap-to-load video embed per spot with credit and link to the original post.
- Create a plan with up to three spots; shareable unique link; native share sheet.
- Plan page: vote with first name, no signup, one vote per device; live results; Google Maps directions link.
- Tracking of plan created, plan opened, vote cast, directions tapped, with channel attribution; `/stats` counts distinct real users including anonymous ones.
- Link preview (Open Graph) for plan links so they look good in group chats.

v1 does NOT include:

- Scraping, video download or re-hosting.
- A scrolling autoplay feed.
- User accounts for visitors (existing auth stays for admins only).
- User-submitted spots or "paste a reel to save it".
- Map view, GPS-based sorting, AI recommendations, booking or ticketing.
- Native apps, push notifications.
- Neighbourhoods beyond Neukölln and Kreuzberg.
- Story-image generator (only if the core flow is live and stable).

Constraints: team of 3 with a single engineer; hard deadline Sunday 22 November 2026 16:00 Berlin time, with 19 h 45 min remaining when this was written (about Saturday 20:15), and that includes any sleep; product must be live and used by real people before then; €150 marketing budget. Because there is one engineer, the plan must reach a shareable production version of the core flow late Saturday night, so that sharing can start then and Sunday morning.

## Requirements

Functional:

1. A visitor can view spots for a chosen neighbourhood without signing in.
2. The default list shows only spots open at the current Berlin time.
3. A visitor can filter spots by tag.
4. A visitor can play a spot's video via an official embed after one tap; the creator and venue are credited and the original post is linked.
5. A visitor can add up to three spots to a plan and create it without signing in.
6. Creating a plan yields a unique, unguessable URL and opens the native share sheet (with copy-link fallback).
7. Anyone with the plan URL can see its spots and vote once per device with a first name, without signing in.
8. The plan page shows current vote counts and the leading spot, updating without a manual reload.
9. The plan page offers a link that opens Google Maps directions to a spot.
10. Events `plan_created`, `plan_opened`, `vote_cast` and `directions_tapped` are recorded first-party with channel attribution.
11. `/stats` shows, per channel and in total, the number of distinct people who created a plan or voted, alongside visits.
12. Curators can add and edit spots without a code deploy (Supabase table editor is acceptable).

Non-functional:

- Mobile-first; works in Safari and Chrome on iOS and Android and inside the Instagram and TikTok in-app browsers.
- First view loads without any third-party embed scripts; embeds load on tap.
- Row level security on every table; anonymous users may read spots and plans, insert plans and votes, and nothing else.
- No secrets in the repo or in client code.
- Runs on Cloudflare Workers (no Node-only APIs).

## Success Criteria

Mapped to the hackathon's judging (real users count double):

- Real users: at least 100 distinct people have created a plan or cast a vote by Sunday 16:00, shown live on `/stats` with a per-channel split.
- Works live: the full flow (browse, shortlist, share, vote, directions) works on a phone on stage against production.
- Launch and marketing: at least three channels tried (own networks, venue and creator outreach, paid social), each with tracked links, and a clear statement of which worked and at what cost per real user.
- Pitch: problem, demo and numbers fit the time slot, with a one-line answer to "why not TikTok".
- Idea and problem: at least 40 curated spots live across the two neighbourhoods.

## Expected Final Result

Anyone in Berlin can open the site on their phone, pick Neukölln or Kreuzberg, see what is open right now with a video for each spot, shortlist up to three, and send one link to their friends. Friends tap the link, vote with a first name, and the group sees the winner with directions in Google Maps. No install and no account at any point. The team can open `/stats` and see how many people used it and which channel brought them.
