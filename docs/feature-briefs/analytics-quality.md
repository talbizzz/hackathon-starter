# Acquisition, activation and launch feedback

Status: planning only; no product implementation or deployed preview in this branch.
Source baseline: main `98dd841`, inspected 22 November 2026. Rebase onto current main before implementation. Approval of this brief approves scope; implementation and production release need their own reviewed evidence.


## Outcome
Understand which discovery channels produce useful planning behavior, with honest event definitions and a short user-feedback loop.

## Evidence from current source
src/lib/analytics.ts tracks first-touch attribution, plan/share/vote/directions events and a first-browser visit. trackVisit() is not a session counter. The Supabase events insert drops props while PostHog receives them. These are code findings at the baseline, not a production data audit. No new tracking provider is needed.

## First implementation scope
Define and test an event dictionary: page/guide viewed, place opened, plan persisted, share attempted, plan opened, vote persisted and directions opened. Record server-confirmed outcomes where possible; avoid duplicate success events after retries. Do not label share_tapped as delivery, video player opening as watching, or browser IDs as people.

Add a minimal useful attribution journey from guide/landing source to plan created and recipient action, retaining only necessary non-sensitive fields. Decide consent/storage behavior against actual deployment before adding trackers. Keep test/admin traffic and bots out of product outcome counts with documented limits. Validate retention/return definitions rather than inferring visits from the existing one-time event.

## Launch experiment
Recruit a small consented pilot, observe one complete group plan and ask whether they actually visited. Source -> plan creation -> recipient vote/directions is the product funnel; confirmed outing remains separate feedback. Trial three guide topics with a fixed review window after indexing. Search/AI clicks and citations are discovery signals, not purchases or PMF.

If 'ans' meant ads, prepare channel-tagged landing links and test the full conversion path first. Ad launch, targeting, creatives, budget and spend require their own concrete campaign scope; this PR neither buys ads nor installs advertising pixels.

## Acceptance
An isolated fixture walkthrough generates exactly the documented events; failures and retries do not falsely count successes. Analytics outages do not block planning. Counts have denominators and observation dates; a reviewer can reproduce one test journey. Search Console/Bing ownership and event receipt in production are separately verified before a dashboard claim.

## Limits
Planning-only branch, no event schema migration, account configuration or live measurements. Pair with content-trust for guide routes and discovery-quality for persisted outcomes. Keep monetization separate until checkout, fulfillment, support and measured demand justify it.
