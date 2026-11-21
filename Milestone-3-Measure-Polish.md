# Milestone 3: Measure and Polish

> Stub — detail with project-plan before starting.

Target: Sunday 08:30 to 12:00 Berlin time.

## Goal

`/stats` proves real users per channel, plan links preview well in group chats, and the rough edges found by the first real users are fixed.

## Scope

### In Scope

- New migration replacing `traction_stats()`: per `source` and in total, visits, plans created, votes cast, and real users = distinct `anon_id` with a `plan_created` or `vote_cast` event. Rows with `source = 'smoke-test'` excluded. Update `/stats` columns to match (requirement 11).
- Open Graph title, description and image for `/p/[id]` so links look good in WhatsApp and Instagram DMs.
- Import of the curators' remaining spots (target 40 or more).
- Fixes from overnight usage, prioritized by what blocks plan creation or voting.
- Optional, only if everything above is done: story-sized "our plan" share image.

### Out of Scope

- New features not listed above. Map, GPS, accounts, AI.

## Depends on

Milestone 2 live on production with `events.anon_id` populated.

## Done Criteria

- [ ] `/stats` shows distinct real users per channel and in total, matching a manual count from the `events` table
- [ ] A plan link pasted into WhatsApp shows a title and image
- [ ] 40 or more published spots, all with parseable videos
- [ ] Deployed to production and smoke-tested on a phone
