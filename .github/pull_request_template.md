## Result to approve

<!-- One feature/stage per PR. Explain the user-visible change and its acceptance criteria. -->

## Review evidence

- Preview URL or local review instructions:
- Preview commit SHA:
- Screenshots at phone and desktop sizes (for UI changes):
- Acceptance checks and results:
- CI run:

<!-- Hosted previews require isolated services; see docs/release-workflow.md.
     Mark unavailable evidence as pending. A passing build is not a tested preview. -->

## Risk and recovery

- Data/auth/media/payment changes, migrations, or new secrets:
- Known limitations:
- Rollback plan (including any data changes):

## Approval

- [ ] Scope and acceptance criteria met; unrelated work stays in its own PR.
- [ ] Evidence refers to the current PR revision and safe review environment.
- [ ] CI passes and an independent reviewer has checked the change.
- [ ] Product owner approves this stage for production before merge.

<!-- Merging to main triggers production deployment. Post-approval edits require another review. -->
