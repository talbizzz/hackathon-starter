# Hackathon NebenMir.app

Next.js 16 (App Router, TS, Tailwind) · Supabase (Postgres, Auth, Storage) · TanStack Query · PostHog · Anthropic + OpenAI · Cloudflare Workers (OpenNext). pnpm only.

## Setup (local)
1. `pnpm install`
2. Create a Supabase project (EU Frankfurt). In **Authentication > Providers > Email**: turn **Confirm email OFF**.
3. Fill the ignored local `.env` if present, or copy `.env.example` to `.env.local`. Next.js loads either; `.env.local` takes precedence. Supply the Supabase URL/public anon key and PostHog configuration. For optional AI tests, choose `AI_PROVIDER` and fill only that provider’s key and model. Never use a Supabase service-role key in a `NEXT_PUBLIC_*` variable.
4. `pnpm exec supabase login` then `pnpm exec supabase link --project-ref <ref>`
5. `pnpm db:push` (applies `supabase/migrations/*`)
6. `pnpm db:types` (regenerates `src/lib/database.types.ts`)
7. `pnpm dev` and open http://localhost:3000
8. Supabase **Authentication > URL Configuration**: Site URL = your live URL; add redirect URLs `http://localhost:3000/**` and `https://<your-worker>.workers.dev/**`.

Missing or invalid env vars fail the app at startup with a clear list (`src/lib/env.ts`).

## Where things are
- Landing copy: `src/lib/site-config.ts` (the only file to edit to rewrite copy)
- Protected pages: `src/app/(app)/...` and add the path to `PROTECTED` in `src/proxy.ts`
- Analytics events: `src/lib/analytics.ts`. `track()` sends to PostHog and to the Supabase `events` table, tagged with the first-touch channel (`utm_source`, else referrer, else `direct`). Put `?utm_source=...&utm_campaign=...` on every link you share.
- Traction numbers: `/stats` (visits, waitlist, signups, real users, per channel). Admin only: sign up, then run `insert into public.admins select id from auth.users where email = 'you@example.com';` in the Supabase SQL editor. After applying the activated-browser migration, activation counts distinct device IDs with persisted plans/votes. These are browser proxies, not verified unique people; smoke-test labels are excluded. See `/stats` for attribution and exclusion limits.
- AI route: `src/app/api/ai/route.ts` (`AI_PROVIDER=anthropic|openai|bedrock`, POST `{ "prompt": "..." }`, signed-in users only)

## Add a table + migration
1. `pnpm exec supabase migration new add_trips` and edit the new SQL file in `supabase/migrations/`
2. Always `alter table ... enable row level security;` and add policies (see `20261121000000_init.sql`)
3. `pnpm db:push && pnpm db:types`
4. Use it: `const supabase = await createClient()` (`@/lib/supabase/server`) in server code, or `@/lib/supabase/client` in client components with TanStack Query.

## Deploy (Cloudflare Workers, prod only)
- Manual: `pnpm exec wrangler login` then `pnpm deploy`. Local Workers preview: `pnpm preview` (needs a `.dev.vars` with the same values as `.env.local`).
- Server secrets (AI keys) are NOT in the repo: set them with `pnpm exec wrangler secret put ANTHROPIC_API_KEY` (and the others), or let the GitHub Action upload them.
- `NEXT_PUBLIC_*` values are inlined at **build** time, so they must be present when you build.
- CI: push to `main` runs `.github/workflows/deploy.yml`. Add these GitHub repo secrets:
  `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`, `AI_PROVIDER`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`.

## Notes
- Next 16: the middleware file is `src/proxy.ts`. `cacheComponents` is off on purpose.
- Workers: use Web APIs / `fetch`; avoid Node-only libs (fs, native modules).

## Local launch-readiness branch

For the €3.99 outing plan checkout, follow [PAYPAL-SETUP.md](PAYPAL-SETUP.md). PayPal sales are disabled until the deployment owner configures credentials, applies the payment migration, registers the webhook and verifies the sandbox flow. The public PayPal.Me page is not an automatic-payment verification mechanism.

See `LAUNCH-READINESS.txt` for the campaign, current content mismatch and verification boundaries. The local `.env` contains empty credential fields for you to fill. The existing `db:types` and `scripts/test-bedrock.sh` commands explicitly read `.env.local`; they do not read `.env`. Do not run database smoke scripts against production to test this branch. No provider request is needed for the anonymous planning flow. `/api/ai` requires a signed-in Supabase session as well as a configured provider key/model.
