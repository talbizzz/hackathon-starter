-- Run against a disposable database with all migrations applied. Rolls back fixtures.
begin;
insert into auth.users (id, email, raw_user_meta_data)
values (md5('stats-admin')::uuid, 'stats-admin@example.test', '{}'::jsonb);
insert into public.admins values (md5('stats-admin')::uuid);

-- A creates twice and votes; C has no analytics, so its plan source is the fallback.
insert into public.plans (id, spot_ids, device_id, source, created_at) values
(md5('plan-a1')::uuid, array[md5('spot')::uuid], md5('a')::uuid, 'later-source', '2026-01-02'),
(md5('plan-a2')::uuid, array[md5('spot')::uuid], md5('a')::uuid, 'other-source', '2026-01-03'),
(md5('plan-c')::uuid, array[md5('spot')::uuid], md5('c')::uuid, 'fallback', '2026-01-02'),
(md5('plan-test')::uuid, array[md5('spot')::uuid], md5('test')::uuid, 'normal', '2026-01-02'),
(md5('plan-smoke')::uuid, array[md5('spot')::uuid], md5('smoke')::uuid, ' SMOKE-TEST ', '2026-01-02');
select public.cast_vote(md5('plan-a1')::uuid, md5('spot')::uuid, md5('a')::uuid, 'A');
select public.cast_vote(md5('plan-a1')::uuid, md5('spot')::uuid, md5('b')::uuid, 'B');
select public.cast_vote(md5('plan-a1')::uuid, md5('spot')::uuid, md5('b')::uuid, 'B changed vote');
select public.cast_vote(md5('plan-a1')::uuid, md5('spot')::uuid, md5('d')::uuid, 'D');
select public.cast_vote(md5('plan-a1')::uuid, md5('spot')::uuid, md5('test')::uuid, 'Test');
select public.cast_vote(md5('plan-smoke')::uuid, md5('spot')::uuid, md5('test-voter')::uuid, 'Test voter');
insert into public.events (id, anon_id, name, source, campaign, created_at) values
('00000000-0000-0000-0000-000000000001', md5('a')::uuid, 'visit', 'first-touch', null, '2026-01-01'),
('00000000-0000-0000-0000-000000000002', md5('a')::uuid, 'visit', 'tie-loses', null, '2026-01-01'),
(gen_random_uuid(), md5('a')::uuid, 'plan_created', 'later-source', null, '2026-01-03'),
(gen_random_uuid(), md5('d')::uuid, 'vote_cast', 'instagram', null, '2026-01-03'),
(gen_random_uuid(), md5('test')::uuid, 'visit', 'normal', 'smoke-test', '2026-01-01'),
(gen_random_uuid(), md5('smoke')::uuid, 'visit', 'normal', null, '2026-01-01'),
(gen_random_uuid(), md5('event-only')::uuid, 'plan_created', 'unpersisted', null, '2026-01-01'),
(gen_random_uuid(), null, 'core_action', 'legacy', null, '2026-01-01');
insert into public.waitlist (email, source) values
('real@example.test', 'first-touch'), ('test@example.test', 'smoke-test');

-- Permissions remain enforced before any stats are returned.
do $$ begin
  if has_function_privilege('anon', 'public.traction_stats()', 'execute') then
    raise exception 'anon can execute traction_stats';
  end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub', md5('not-admin')::uuid::text, true);
do $$ begin
  perform public.traction_stats();
  raise exception 'non-admin received stats';
exception when insufficient_privilege then null;
end $$;
select set_config('request.jwt.claim.sub', md5('stats-admin')::uuid::text, true);
do $$
declare result jsonb; total integer;
begin
  result := public.traction_stats();
  select sum((r->>'activated')::integer) into total from jsonb_array_elements(result) r;
  if total <> 4 then raise exception 'expected 4 distinct activated browsers, got %: %', total, result; end if;
  if exists (select 1 from jsonb_array_elements(result) r
    where (r->>'activated')::integer > 0 and r->>'source' not in ('first-touch', 'direct', 'fallback', 'instagram')) then
    raise exception 'unexpected activation attribution: %', result;
  end if;
  if (select count(*) from jsonb_array_elements(result) r where (r->>'activated')::integer = 1) <> 4 then
    raise exception 'each browser must belong to exactly one expected channel: %', result;
  end if;
  if exists (select 1 from jsonb_array_elements(result) r where lower(btrim(r->>'source')) = 'smoke-test') then
    raise exception 'smoke-test leaked into stats: %', result;
  end if;
  if exists (select 1 from jsonb_array_elements(result) r where r->>'source' = 'normal') then
    raise exception 'tagged test-device visits leaked into stats: %', result;
  end if;
  if (select sum((r->>'waitlist')::integer) from jsonb_array_elements(result) r) <> 1 then
    raise exception 'tagged waitlist entry counted: %', result;
  end if;
  raise notice 'traction_stats assertions passed: %', result;
end $$;
rollback;
