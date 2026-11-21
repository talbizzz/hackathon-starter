# Milestone 1: Foundation

Target: done by Saturday 21:45 Berlin time.

> **Plan updated:** no git remote exists, so T1.6 deployed with `pnpm deploy` instead of a push; the tracking migration turned out to be applied already (21 Nov 2026).

## Goal

The pending tracking work is live on production, the embed approach is proven on real phones inside the Instagram and TikTok in-app browsers, and test and language scaffolding exist.

## Context

- Repo: Next.js 16 starter with Supabase auth, PostHog, AI route, Cloudflare deploy on push to `main`.
- Current branch `traction-tracking` holds two commits not on `main`: Bedrock provider, and traction tracking (`events` table, attribution, `/stats`).
- `supabase/migrations/20261121010000_traction.sql` is NOT applied to the remote database and has never been executed. It replaces the `handle_new_user` signup trigger.
- `src/lib/database.types.ts` was edited by hand to match that migration.
- `Project-Raw.md`, `Project-Plan.md`, `TODO.md` and the milestone files are uncommitted at the repo root.
- Read `AGENTS.md`: consult `node_modules/next/dist/docs/` before writing Next code.
- There is no local database. `pnpm db:push` applies migrations to the real Supabase project.

## Scope

### In Scope

- Apply the pending migration, regenerate types, smoke-test signup and `/stats`.
- Merge `traction-tracking` into `main` and deploy.
- Vitest setup and a CI check step.
- Language dictionary and device id helpers.
- Embed spike page on production and a recorded decision.

### Out of Scope

- Any product table (`spots`, `plans`, `votes`) or product UI.
- Changes to the landing page.

## Contracts (build these first)

- `src/lib/device.ts`: `export function getDeviceId(): string` — returns a uuid; reads `localStorage["device_id"]`, creates with `crypto.randomUUID()` if missing; if storage throws, returns a module-level uuid; returns `""` when `window` is undefined.
- `src/lib/i18n.ts`:
  - `export type Lang = "en" | "de"`
  - `export const dict: Record<Lang, Record<string, string>>` — both languages must have identical keys.
  - `export function detectLang(saved: string | null, browser: string | undefined): Lang` — `saved` if it is `en` or `de`; else `de` if `browser` starts with `de` (case-insensitive); else `en`.
  - `export function useT(): { t: (key: string) => string; lang: Lang; setLang: (l: Lang) => void }` — starts as `en`, switches after mount, persists to `localStorage["lang"]`. `t` returns the key itself if missing.
- `package.json` scripts: `"test": "vitest run"`.

## Tasks

### T1.1 — Apply the pending tracking migration

- **Depends on:** —
- **Area:** database
- **What:** Run `pnpm db:push`, then `pnpm db:types`. Confirm with `git diff src/lib/database.types.ts` that generated types still contain `events`, `admins`, `profiles.source`, `waitlist.source` and `traction_stats`; keep the generated version. If the push fails, fix the SQL in the migration file (it has not been applied, so editing it is safe) and retry.
- **Tests (write first):** none automated; verification is T1.2.
- **Done when:** `pnpm db:push` reports the migration applied and `pnpm exec tsc --noEmit` passes.

### T1.2 — Smoke-test signup, tracking and stats locally

- **Depends on:** T1.1
- **Area:** web
- **What:** `pnpm dev`. Open `http://localhost:3000/?utm_source=smoke-test`, sign up with a new email, press the core action button, open `/stats`. Make the account an admin with the SQL shown on the page, reload. Requires a human with access to the Supabase SQL editor for the admin insert.
- **Tests (write first):** manual checklist: signup succeeds and lands on `/dashboard`; `/stats` shows a `smoke-test` row with 1 visit, 1 signup, 1 real user.
- **Done when:** all three checklist items hold.

### T1.3 — Test runner and CI check

- **Depends on:** —
- **Area:** infra
- **What:** `pnpm add -D vitest`. Add `vitest.config.ts` with the `@` alias to `./src` and `environment: "node"`. Add the `test` script. In `.github/workflows/deploy.yml`, add a step after install and before the build: `pnpm test`. (Plan updated 21 Nov: no separate `tsc` step in CI, because `next-env.d.ts` and `.next/types` only exist after the build, and the build already typechecks.)
- **Tests (write first):** `src/lib/i18n.test.ts` (see T1.5) is the first test file; `pnpm test` must fail before T1.5 is implemented and pass after.
- **Done when:** `pnpm test` runs and exits 0 with at least one passing test.

### T1.4 — Embed spike on production

- **Depends on:** T1.6 for the production check; the page itself can be built first
- **Area:** web
- **What:** Add `src/app/embed-test/page.tsx` (client component, not linked from anywhere, `robots: noindex` metadata). Two buttons. "TikTok" renders `<iframe src="https://www.tiktok.com/player/v1/{id}?autoplay=1&music_info=1&description=1" allow="autoplay; encrypted-media; fullscreen" ...>` at 9:16 aspect ratio, full card width. "Instagram" renders `<iframe src="https://www.instagram.com/p/{shortcode}/embed/" ...>`. Hard-code one public Berlin venue TikTok id and one public reel shortcode (ask the marketing teammate for two links). Nothing loads until a button is tapped.
- **Tests (write first):** manual matrix, needs humans with phones: iOS Safari, Android Chrome, Instagram in-app browser, TikTok in-app browser. For each: does the video play inline after one tap, with sound available, without leaving the page?
- **Done when:** the matrix is filled in under "Open Technical Risks" in `Project-Plan.md` with a `> **Plan updated:**` line stating the decision: Instagram inline, or Instagram as a "Watch on Instagram" link-out. TikTok failing in the Instagram in-app browser is a stop-and-escalate result.

### T1.5 — Language and device helpers

- **Depends on:** T1.3
- **Area:** shared
- **What:** Implement `src/lib/device.ts` and `src/lib/i18n.ts` per the contracts. Seed `dict` with the keys `lang.toggle`, `hood.neukoelln`, `hood.kreuzberg` in both languages. Add `src/components/lang-toggle.tsx`: a small button showing the other language's code that calls `setLang`.
- **Tests (write first):** `src/lib/i18n.test.ts`: `detectLang("de", "en-US") === "de"`; `detectLang(null, "de-DE") === "de"`; `detectLang(null, "fr") === "en"`; `detectLang("xx", undefined) === "en"`; every key in `dict.en` exists in `dict.de` and the reverse.
- **Done when:** tests pass and `pnpm exec eslint src` is clean.

### T1.6 — Merge and deploy

- **Depends on:** T1.2, T1.3
- **Area:** infra
- **What:** Commit the planning files and all Milestone 1 work on `traction-tracking`. Merge into `main` (fast-forward) and push. Watch the GitHub Actions run. Note for the Bedrock provider: the workflow does not upload `AWS_BEARER_TOKEN_BEDROCK`, `AWS_REGION` or `BEDROCK_MODEL`; leave that as is, the product does not use AI.
- **Tests (write first):** production checklist: `/` loads; `/embed-test` loads; `/stats` loads for the admin account and shows a new visit after opening the site in a private window with `?utm_source=prod-smoke`.
- **Done when:** the deploy workflow is green and the checklist holds on the production URL.

## Environment & Configuration

No new environment variables or secrets.

## Done Criteria

- [ ] Every task's "Done when" met
- [ ] `pnpm exec tsc --noEmit`, `pnpm lint` and `pnpm test` pass locally and in CI
- [ ] Deployed to production and smoke-tested
- [ ] The embed decision is written into `Project-Plan.md`
- [ ] A first-party `visit` event from production is visible on `/stats`

## Risks & Watch-Outs

- The migration replaces the signup trigger. If signup breaks after T1.1, the cause is `handle_new_user`; fix forward with a new migration, do not edit an applied one.
- Order matters: database first (T1.1), deploy second (T1.6). The new code fails waitlist inserts if `waitlist.source` does not exist.
- T1.2 and T1.4 need a human; start T1.3 and T1.5 while waiting.
- Do not spend more than 30 minutes on the spike page. It is deleted in Milestone 2.
