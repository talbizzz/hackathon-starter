# TODO

## Milestone 1: Foundation (target Sat 21:45)

- [x] T1.1 — Apply the pending tracking migration
- [ ] T1.2 — Smoke-test signup, tracking and stats locally (scripted checks passed 21 Nov: signup, profile source, event inserts, RLS, stats denied for non-admin; still open: a human makes their account an admin and confirms `/stats` renders)
- [x] T1.3 — Test runner and CI check
- [x] T1.4 — Embed spike on production (both platforms play inline with sound in the Instagram in-app browser on iPhone; TikTok in-app browser and Android not tested; decision recorded in Project-Plan.md)
- [x] T1.5 — Language and device helpers
- [x] T1.6 — Merge and deploy (merged to `main`; deployed with `pnpm deploy` because the repo has no git remote)

## Milestone 2: Core Flow (target Sun 02:30)

- [x] T2.1 — Core migration and database smoke script
- [x] T2.2 — Opening-hours, video and maps logic (Spot and Plan types still to add once the migration is applied)
- [x] T2.3 — Tracking with device id
- [ ] T2.4 — Load real spots (three TEST spots are in the live database for development; delete them when the curators' CSV is imported)
- [x] T2.5 — Home page: spot list (added beyond the plan: a "Tomorrow (Sunday)" section on Saturdays)
- [x] T2.6 — Tap-to-load video
- [x] T2.7 — Create and share a plan (share sheet opens in the same tap while the plan saves; native share sheet only verifiable on a phone)
- [x] T2.8 — Plan page: vote, results, directions
- [ ] T2.9 — Deploy and production phone check

## Milestone 3: Measure and Polish (target Sun 12:00)

- [ ] (stub — to be detailed)

## Milestone 4: Launch Freeze (target Sun 15:00, code freeze 13:00)

- [ ] (stub — to be detailed)
