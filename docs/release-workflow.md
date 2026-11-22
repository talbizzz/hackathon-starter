# Review and release

Keep each important feature or stage on a separate branch and PR. `main` is the production release branch: merging into it triggers deployment to `nebenmir.app`. Branch creation and CI do not publish a site. The existing `deploy:dev` target is **not an isolated review environment**: `wrangler.dev.jsonc` binds the production `nebenmir-media` R2 bucket.

## Stage approval

1. Start a focused branch from current `main`. Record its user-visible outcome and acceptance criteria in the PR. Draft PRs hold unfinished work without releasing it.
2. Run CI and collect review evidence for the current commit: safe preview instructions/URL, phone and desktop screenshots for UI changes, relevant behavior checks, and remaining risks. No preview URL is available from CI; its dummy services only validate the build.
3. An independent reviewer checks correctness and regressions. The product owner approves the concrete result in the PR. Any later edits require fresh affected checks and approval.
4. Merge only the approved PR to `main`. The production workflow repeats CI before deploying. Its main-ref guard rejects a manual run selected on another branch. With a protected `production` environment, its configured reviewers approve deployment as an additional gate.
5. Verify the deployment run's commit and production URL. Check the affected user journey and errors before calling the stage shipped. Keep the previous successful deployment/commit recorded in the PR. Revert the merge through a reviewed PR if needed; database migrations and uploaded/deleted media need their own recovery plan because reverting code does not restore data.

Suggested approval comment: **“Approve <commit SHA> for production: <accepted outcome>.”** Screenshots and checks must identify that same revision. Approval is a human decision, not a checkbox automation.

## Checks and repository setup

`.github/workflows/ci.yml` runs lint, Next route type generation plus TypeScript, unit tests, and an OpenNext Cloudflare build. It uses `.invalid` service URLs and placeholders, with read-only repository permissions and no service secrets. It deploys nothing and does not run database/import/upload scripts. It runs for PRs to `main`, pushes to the initial `metaphysicist1/review-workflow` setup branch, manual dispatch, and calls from production deployment. Manual dispatch becomes available after the workflow reaches the default branch; the setup-branch push supports initial validation.

The repository owner/admin still needs to configure and verify these GitHub settings; files in this PR cannot enforce them:

- Protect `main`: require PRs, at least one independent approval, dismiss stale approvals, and require the CI **Checks** status after observing its exact name on a real PR. Prevent direct pushes/force pushes and review who can bypass the rules.
- Configure the `production` GitHub environment with required reviewers, prevent self-review where supported, and restrict deployment branches to `main`. The workflow references this environment, but an environment name alone does not enforce approval. Confirm plan/repository support for these protection rules.
- Keep deployment credentials out of PR checks. Scope Cloudflare credentials to the production deployment resources. Audit existing repository-level secrets and environment access before relying on environment approval as a credential boundary.
- Verify a PR run, an approved main deployment, and a rejected non-main manual production run. Do not claim enforcement until the actual settings and run outcomes are checked.

Until those settings are confirmed, the PR process is a team convention; a user with push access may bypass it. CI passing alone does not establish product approval or a successful deployment.

## Safe previews: prerequisites

No automatic hosted preview is configured. Cloudflare CLI authentication is currently unavailable in the working session, and no isolated preview resources have been verified. The existing dev worker and production configuration must not be used to publish branch review code.

Before enabling hosted previews, prepare and review:

- A dedicated preview Supabase project with migrations and synthetic fixtures, its own public URL/anon key, tested RLS, test accounts, and auth redirect URLs for the preview origin. Never copy production user data or privileged keys. Analytics writes also go to Supabase, so a read-only-looking page can still write.
- A dedicated preview R2 bucket/public media origin and a separate Wrangler configuration with a unique preview worker name, no production route, and no production bucket bindings. Pass that configuration explicitly to build and deploy. Review all bindings and secrets, not just the worker name.
- Preview-only AI credentials with a bounded test policy or disabled AI, isolated/disabled PostHog, and payment sandbox configuration if payment code is introduced. Public environment values are compiled into the frontend, so build with preview values as well as deploying with preview runtime secrets.
- A Cloudflare-authenticated operator or scoped preview token, and a protected preview deployment environment. Only trusted, reviewed branch code may receive preview credentials; never use `pull_request_target` to execute PR code with secrets. Define preview naming, access, expiry, and cleanup before automation.
- A smoke check proving login, analytics, media uploads and any mutations land only in preview resources, with the preview URL and commit recorded in the PR.

For local review, use a clean checkout with explicitly isolated local/test services and synthetic data. Do not reuse `.env.local`, `.dev.vars`, or inherited credentials from a production-connected checkout. Dummy CI URLs can validate compilation but cannot demonstrate live discovery, login, sharing or uploads. A developer can share screenshots and recorded checks while isolated hosting remains pending.

## Feature lanes

Each row is a separate approval unit. Planning branches may contain only a brief; their existence does not mean the feature is implemented or published. Preserve existing owners for launch-readiness/auth/payments and media work.

| Lane | Review outcome and acceptance criteria |
| --- | --- |
| SEO (`website-seo`) | Canonicals, metadata, robots and sitemap agree with the intended production origin; public pages are indexable as intended; private/auth routes are excluded where appropriate; validate rendered output. |
| `discovery-quality` | Agree the area/filter/map/feed behavior first; test location denial, empty/error results and opening-hour boundaries with known fixtures; compare mobile and desktop journeys. |
| `performance-accessibility` | Capture a baseline and target before changing code; verify keyboard navigation, visible focus, labels and responsive layout; compare measurements on the same route/device conditions. |
| `analytics-quality` | Define event names and success metrics; verify event payloads, consent requirements, deduplication and environment separation; demonstrate events in the isolated test destination without personal data. |
| `content-trust` | Establish source, freshness and correction rules for listings; verify representative content and stale/incorrect/closed-place handling; assign an owner for ongoing review. |
| Auth and sharing (existing launch-readiness owner) | Test signup/login/logout, expired sessions, redirects and access control with test accounts; shared public links work without leaking private content. |
| Media (existing media owner) | Validate file type/size limits, authorization, failed uploads and deletion; demonstrate all writes against isolated storage before approving production changes. |
| Payments (existing launch-readiness owner; separate approval) | Approve pricing and entitlement behavior first; test sandbox checkout, duplicate webhook delivery, cancellation/refunds and access changes; require a recovery plan before live billing. |

Discovery, accessibility, analytics and content lane briefs live under `docs/feature-briefs/` on their respective planning branches. Sequence dependent work after the required data/auth changes are approved, rather than merging an entire batch at once.
