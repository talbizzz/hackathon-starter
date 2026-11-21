-- Successful persisted product actions, not client analytics claims, establish activation.
-- device_id is a browser/device proxy supplied by the client, not a verified person.
create or replace function public.traction_stats() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.admins where user_id = auth.uid()) then
    raise exception 'not an admin' using errcode = '42501';
  end if;
  return (
    with test_devices as (
      -- Explicit labels only: unlabelled tests cannot be identified reliably.
      select device_id from public.plans where lower(btrim(source)) = 'smoke-test'
      union
      select anon_id from public.events
      where anon_id is not null
        and (lower(btrim(source)) = 'smoke-test' or lower(btrim(campaign)) = 'smoke-test')
    ), actions as (
      select device_id, created_at, id, 0 as kind,
        coalesce(nullif(btrim(source), ''), 'direct') as source
      from public.plans
      union all
      -- Votes have no own channel; do not attribute a voter to the plan creator's channel.
      select v.device_id, v.created_at, v.id, 1 as kind, 'direct' as source
      from public.votes v join public.plans p on p.id = v.plan_id
      where lower(btrim(coalesce(p.source, ''))) <> 'smoke-test'
    ), first_action as (
      select distinct on (device_id) device_id, source
      from actions
      where not exists (select 1 from test_devices t where t.device_id = actions.device_id)
      order by device_id, created_at, kind, id
    ), activated as (
      select f.device_id, coalesce(e.source, f.source) as s
      from first_action f
      left join lateral (
        select nullif(btrim(source), '') as source
        from public.events where anon_id = f.device_id and nullif(btrim(source), '') is not null
        order by created_at, id limit 1
      ) e on true
    ), v as (
      select coalesce(nullif(btrim(source), ''), 'direct') as s, count(*) as n
      from public.events e
      where name = 'visit'
        and lower(btrim(coalesce(source, ''))) <> 'smoke-test'
        and lower(btrim(coalesce(campaign, ''))) <> 'smoke-test'
        and not exists (select 1 from test_devices t where t.device_id = e.anon_id)
      group by 1
    ), w as (
      select coalesce(nullif(btrim(source), ''), 'direct') as s, count(*) as n
      from public.waitlist where lower(btrim(coalesce(source, ''))) <> 'smoke-test' group by 1
    ), p as (
      select coalesce(nullif(btrim(source), ''), 'direct') as s, count(*) as n
      from public.profiles where lower(btrim(coalesce(source, ''))) <> 'smoke-test' group by 1
    ), a as (
      select s, count(*) as n from activated group by s
    ), k as (
      select s from v union select s from w union select s from p union select s from a
    )
    select coalesce(jsonb_agg(jsonb_build_object(
      'source', k.s,
      'visits', coalesce(v.n, 0),
      'waitlist', coalesce(w.n, 0),
      'signups', coalesce(p.n, 0),
      'activated', coalesce(a.n, 0)
    ) order by coalesce(a.n, 0) desc, coalesce(p.n, 0) desc, coalesce(v.n, 0) desc, k.s), '[]'::jsonb)
    from k
    left join v on v.s = k.s
    left join w on w.s = k.s
    left join p on p.s = k.s
    left join a on a.s = k.s
  );
end $$;
revoke execute on function public.traction_stats() from public, anon;
grant execute on function public.traction_stats() to authenticated;
