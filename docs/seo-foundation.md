# NebenMir SEO foundation

Review branch based on `origin/main` 98dd841. No deployment or Search Console submission is included.

## Scope and current behavior

- Root already had a homepage canonical and a real 1200×630 branded Open Graph image. These are preserved; the image gains descriptive alt text. Next also derives Twitter image metadata from the existing file.
- Canonical metadata now uses the confirmed public origin `https://nebenmir.app`, independently of preview configuration. `/map` has a distinct title, description, Open Graph URL and canonical, including when requested with `?plan=new`. English remains the document language; no unverified language alternates were added.
- Only `/` and `/map` are in the production-configured sitemap. Preview-configured builds return an empty sitemap and do not advertise one in robots.txt. No invented last-modified dates, events, reviews, ratings or structured data.
- `/login`, `/signup`, protected app pages and shared `/p/[id]` plans are noindex. HTTP headers additionally cover auth, dashboard, admin, stats, shared plans and API paths, including redirects and nested routes.
- Every host except `nebenmir.app` receives an HTTP `noindex, nofollow` directive, including preview aliases of a production-configured build. Root metadata also emits noindex when `NEXT_PUBLIC_SITE_URL` is a preview origin. The helper rejects missing/malformed origins; existing environment validation still fails startup for those values. Production must set that variable to `https://nebenmir.app`.
- HTML remains crawlable so crawlers can see noindex; robots.txt disallows API crawling. Authentication still protects protected routes. Noindex does not make shared plan URLs confidential.

The host header rules use Next's supported `headers`/`missing` mechanism. Confirm the actual Cloudflare/OpenNext deployment forwards the intended host and preserves these response headers before release. A production-configured build served on a preview host can retain an index meta tag; its more restrictive noindex HTTP header governs indexing. Preview-configured builds additionally emit noindex metadata.

## Verification

- Existing and new Vitest suites: 4 files, 30 tests pass. New checks cover exact production-origin eligibility, preview/invalid origins, public-only sitemap, crawlable noindex policy, and private/preview header configuration.
- TypeScript `tsc --noEmit` and targeted ESLint pass.
- Next 16.4.6 local webpack development server with disposable dummy public credentials: home on production Host returns 200 without noindex header; same build on preview Host returns 200 with noindex header. Login, signup and shared-plan pages return 200 with noindex header and metadata. Dashboard redirects to login. `/map?plan=new` returns 200 with canonical `https://nebenmir.app/map`; only metadata was checked against dummy data. Robots and sitemap respond 200 with only the two expected public URLs. Share metadata includes the existing OG image and Twitter image fallback.
- Turbopack cannot resolve dependencies through the temporary sibling `node_modules` symlink under its hermetic workspace root; webpack was used for runtime checks. This is a local dependency arrangement limitation, not deployment evidence. Development Next deliberately uses localhost for file-based social images; verify canonical image URLs on a production build/deployment.
- Runtime used no real database credentials; production map data, signed-in admin rendering, deployment headers, actual indexing and social crawler caches remain unverified. No UI layout or database changes.

## Compatible next content work (proposal, not implemented)

Audience hypothesis: English-speaking people deciding what to do in Berlin with friends. Language and actual search demand need validation before scaling content. The acquisition channel is organic search and AI search referrals; the message is specific, verified Berlin options that lead into a shared shortlist and vote.

1. Add server-rendered `/guides` and `/guides/[slug]` editorial pages with useful answers, linked place details and an explicit action into the map/planning flow. Start with a small reviewed set, not a generated keyword inventory. Topic examples such as rainy-day activities or affordable group outings are hypotheses, not measured keywords.
2. Add stable public `/places/[slug]` detail pages separate from private `/p/[id]` plans. Resolve immutable IDs behind stable slugs; redirect renamed slugs, return 404 for unknown/unpublished entries, and include only published pages in the sitemap. Use server-rendered place names, addresses and useful descriptions with crawlable links from guides and the map. Do not turn client filters/query combinations into unlimited indexed pages.
3. Current spot fields include address, neighbourhood, price, weekend hours, bilingual notes, video attribution and publication state. They lack an explicit canonical slug, verification timestamp and structured authoritative-source provenance. Before publishing factual guides, record venue source URLs, evidence and checked dates, clarify price units/conditions, and verify opening hours, accessibility and reservation claims. Do not infer missing details from videos or generated prose.
4. Each guide needs an accountable author/editor, selection rationale, sources near material claims, real published/updated dates, and an owner for rechecking changing venue facts. Link to original venue information and credit licensed media. Publish structured data only when it matches visible, verified content and the applicable supported type.

Google's current [generative AI optimization guide](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide) treats this as SEO: valuable original content, accessible text, discoverable pages and trustworthy information. It does not establish guaranteed inclusion or a special schema requirement. No `llms.txt` or similar file is introduced as a ranking shortcut. [Bing's guidelines](https://www.bing.com/webmasters/help/bing-webmaster-guidelines-30fba23a) similarly emphasize interpretable, verifiable content for search and grounding. These support the editorial/data requirements above; the proposed route architecture is our implementation recommendation.

After deployment, verify domain ownership and submit the sitemap in Google Search Console/Bing Webmaster Tools. Google documents a Generative AI performance report in its current guide; [Bing documents AI Performance](https://www.bing.com/webmasters/help/ai-performance-9f8e7d6c). Account access and report availability have not been checked. Measure indexed canonical pages, organic/AI referral visits and guide/place → shortlist → shared-plan conversion. Treat citations and impressions as diagnostics; qualified planning activity is the intended success metric. Set numerical targets after collecting a baseline.

## Implementation references

Read the installed Next 16.4.6 metadata, metadataBase, robots, sitemap and share-image documentation before implementation. Official references checked 2026-11-22:

- [Next metadata and OG images](https://nextjs.org/docs/app/getting-started/metadata-and-og-images)
- [Next sitemap convention](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap)
- [Next response headers](https://nextjs.org/docs/app/api-reference/config/next-config-js/headers)
- [Google robots meta/HTTP directives](https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag)
- [Google technical requirements](https://developers.google.com/search/docs/essentials/technical): blocked crawling can prevent discovery of noindex, and robots.txt alone does not reliably prevent indexing.
