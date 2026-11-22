# Discovery and group-plan reliability

Status: planning only; no product implementation or deployed preview in this branch.
Source baseline: main `98dd841`, inspected 22 November 2026. Rebase onto current main before implementation. Approval of this brief approves scope; implementation and production release need their own reviewed evidence.


## Outcome
A visitor can find an appropriate place, save choices, share a durable plan, receive a friend's vote and reach directions without losing work.

## Launch gates
- Verify the existing happy path on two independent browser sessions: browse -> choose -> create -> share -> open -> vote -> winner/directions. Capture exact tested revision and data fixtures; historical tests do not prove this release.
- Test database failure/retry, zero results, no GPS/denied permission, unknown hours, no video, changing filters after selection and duplicate taps. Preserve useful selection state; distinguish no matches from failed loading.
- Keep map and list alternatives usable; no visitor should need precise geolocation or a map gesture to find a place.
- Stable place details and shareable filter/selection state are the next scope after the flow is reliable. Coordinate route IDs with content-trust; avoid claiming arbitrary query parameters already work.
- Verify anonymous user flow before adding account requirements. Existing auth/payment work belongs to metaphysicist1/launch-readiness and must be reviewed separately.

## Acceptance evidence
Given two clean sessions and isolated fixtures, when the organiser shares a persisted plan, the recipient sees the exact saved choices and a vote survives refresh. Retry cannot duplicate the plan or inflate votes. A storage failure never displays successful sharing. Direction links refer to the selected venue. Test actual mobile share/copy fallbacks and keyboard use. Record unsupported cases explicitly.

## Scope boundaries
No product code changed by this planning PR. No AI recommender, social network, booking marketplace or mandatory login needed for the launch pilot. A full production end-to-end test was not performed during the initial review. Inspect src/app/map/page.tsx, src/components/spot-list.tsx, plan-setup.tsx, plan-view.tsx and src/app/p/[id]/page.tsx when implementing.
