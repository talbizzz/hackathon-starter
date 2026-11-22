# Mobile performance and accessibility

Status: planning only; no product implementation or deployed preview in this branch.
Source baseline: main `98dd841`, inspected 22 November 2026. Rebase onto current main before implementation. Approval of this brief approves scope; implementation and production release need their own reviewed evidence.


## Outcome
A visitor arriving from Instagram, search or a shared link can use the map/list and plan without waiting for every video or needing precise pointer input.

## Bounded first work
Measure the landing, map and shared plan at mobile/desktop before choosing fixes. Capture network/CPU settings and device; report lab measurements as lab data. Source landing.tsx already has a reduced-motion handler; test its real behavior before replacing it.

Inspect hero/video transfer size and preload behavior, posters, lazy loading below the fold, layout shifts, map startup cost and JS errors. Check iPhone byte-range playback and a failed/unsupported video fallback. Keep text/directions usable without video playback. Avoid speculative library rewrites.

Test keyboard-only use, focus visibility and return focus for sheets/dialogs, controls with accessible names, non-colour status cues, contrast, motion preferences, text scaling and narrow-screen overflow. A clickable map is not a substitute for an accessible list.

## Acceptance
- Core flow verified at 390px and desktop plus keyboard; no overlay hides primary actions or traps focus.
- Before/after measurements use the same route, fixture and browser profile; report transfer sizes and timings without claiming unmeasured field Core Web Vitals.
- Playback failure still leaves venue text/actions available. Off-screen media loading stays bounded and active player is controlled.
- Lint/types/tests/build pass; screenshots and interaction evidence attached to the exact implementation commit.

## Dependencies and limits
Coordinate sheets/list ownership with discovery-quality, metadata with seo-foundation, and media routes with the current media owner. This is a planning-only PR; no performance benchmark or accessibility conformance claim has been established yet.
