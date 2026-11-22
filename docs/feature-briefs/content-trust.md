# Guides, place pages and trusted content

Status: planning only; no product implementation or deployed preview in this branch.
Source baseline: main `98dd841`, inspected 22 November 2026. Rebase onto current main before implementation. Approval of this brief approves scope; implementation and production release need their own reviewed evidence.


## Outcome and launch order
Give someone a useful answer to a Berlin outing question, then let them inspect a real place and plan with friends. Start with one guide and five verified places, then expand to three guides after the first journey works. English is a provisional working default matching the current page; confirm audience before publishing articles. Do not publish mass translations or thin pages for every keyword variation.

Current source routes contain no /guides or stable /places detail pages. Live landing inspection on 22 November showed only home/map links and a brand-only footer. This is a route/content gap, not proof of demand or a complete live audit.

## First content experiment
| Proposed guide | Search intent hypothesis | Required evidence |
| --- | --- | --- |
| Things to do in Berlin on a rainy day | Indoor options with practical constraints | Current official opening times, indoor status, cost, booking and accessible-route information where verified |
| Free things to do in Berlin with friends | Avoid admission cost and plan together | Which parts are free, exceptions, seasonality and travel cost caveat |
| How to choose a Berlin outing with friends | Turn disagreement into a shared plan | Actual verified create/share/vote behavior, useful worked example, no invented customer story |

These are candidate topics, not measured keyword volume, difficulty or ranking claims. Check Search Console query evidence and a small search-results sample before expanding. No paid keyword service is required for the pilot.

## Compatible implementation
- Use existing Next App Router server-rendered /guides and /guides/[slug], with typed editorial content in the repository and Git PR review initially. A new CMS is unnecessary for three articles.
- Add /places/[slug] backed by reviewed published records, durable IDs and a unique slug; redirects preserve links after a rename. Never expose drafts through detail routes, sitemap, API or search.
- Guide links -> place details -> existing map/plan action. Confirm a real place-selection deep link before claiming a one-tap flow; current /map does not establish slug selection support.
- Put the answer, who it suits, costs/unknowns, practical constraints, alternatives and source links in readable HTML. Show author/reviewer and actual checked date. Include helpful natural-language questions only where answers can be verified.
- Add unique title/description/canonical, visible breadcrumbs, crawlable links and sitemap entries only for published useful pages. Use appropriate structured data matching visible facts; no invented ratings, opening hours, event dates or rich-result eligibility promises.
- Add a correction route and editorial review queue before venue submissions. For submissions collect only necessary fields and source/permission provenance; moderator approval is required before public visibility. Never automatically repost scraped video.
- Provide About, contact/correction and policy links; owner/operator information and privacy wording need real supplied facts. Confirm actual analytics and media behavior before writing policy statements.

## SEO and AI-search evidence
Google's current guide treats GEO/AEO as part of SEO and prioritizes original useful content; it discourages unnecessary AI text files and artificial mentions. Its technical guidance says crawlable, indexed pages with eligible snippets can appear, without guaranteeing inclusion. Check Search Console access/settings and available AI performance reports. [Google AI optimization guide](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide), [technical requirements](https://developers.google.com/search/docs/appearance/ai-features).

ChatGPT search uses OAI-SearchBot independently of the GPTBot training choice. Test crawler access through both robots and Cloudflare controls; do not silently alter training preferences. [OpenAI crawler documentation](https://developers.openai.com/api/docs/bots).

Search Console/Bing Webmaster Tools ownership is unverified. No account verification, bot firewall setting, paid service or ranking promise is included in this branch.

## Acceptance before content launch
1. Five place records have an official source, checked date and accurate essential details; unavailable facts say unknown. Media publication rights are recorded.
2. One guide answers a concrete question with original useful work and links only to available place pages; no first-hand visit claim without actual evidence.
3. Server HTML contains article/place text; canonical and sitemap URLs agree; drafts/private plans stay out; invalid slugs return 404 and rename redirects work.
4. At 390px and desktop, a reader reaches the correct place and existing plan flow; keyboard navigation works.
5. Measure guide -> place -> plan created -> plan opened/vote or directions. Do not equate visits, bot citations or button taps with completed outings.

## Publication boundary
This PR publishes an editorial/implementation brief only. Article writing, data migration, UI, Search Console setup and hosted previews remain pending. No production writes or media uploads.
