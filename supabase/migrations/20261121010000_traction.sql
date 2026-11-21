-- Traction tracking: first-party events, channel attribution, and an admin-only stats function.

-- Where each signup / waitlist entry came from (utm_source, referring site, or 'direct').
alter table public.profiles add column source text check (length(source) <= 100);
alter table public.waitlist add column source text check (length(source) <= 100);

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name, source)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    left(new.raw_user_meta_data ->> 'source', 100)
  );
  return new;
end $$;

-- events: written by track() in src/lib/analytics.ts. Insert only, nobody can read via the API.
-- user_id is filled in by the database, so a signed-in user can only log events as themselves.
create table public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(name) between 1 and 64),
  source text check (length(source) <= 100),
  campaign text check (length(campaign) <= 100),
  created_at timestamptz not null default now()
);
create index events_name_idx on public.events (name);
alter table public.events enable row level security;
grant insert on public.events to anon, authenticated;

create policy "events: insert as self" on public.events
  for insert to anon, authenticated with check (user_id is not distinct from auth.uid());

-- admins: who may see /stats. No policies, so it is only editable from the SQL editor:
--   insert into public.admins select id from auth.users where email = 'you@example.com';
create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);
alter table public.admins enable row level security;

-- One row per channel: visits, waitlist entries, signups, and activated users
-- (signed-in users who did the core action at least once).
create function public.traction_stats() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.admins where user_id = auth.uid()) then
    raise exception 'not an admin' using errcode = '42501';
  end if;
  return (
    with v as (
      select coalesce(source, 'direct') as s, count(*) as n
      from public.events where name = 'visit' group by 1
    ), w as (
      select coalesce(source, 'direct') as s, count(*) as n from public.waitlist group by 1
    ), p as (
      select coalesce(source, 'direct') as s, count(*) as n from public.profiles group by 1
    ), a as (
      select coalesce(pr.source, 'direct') as s, count(distinct e.user_id) as n
      from public.events e join public.profiles pr on pr.id = e.user_id
      where e.name = 'core_action' group by 1
    ), k as (
      select s from v union select s from w union select s from p union select s from a
    )
    select coalesce(jsonb_agg(jsonb_build_object(
      'source', k.s,
      'visits', coalesce(v.n, 0),
      'waitlist', coalesce(w.n, 0),
      'signups', coalesce(p.n, 0),
      'activated', coalesce(a.n, 0)
    ) order by coalesce(a.n, 0) desc, coalesce(p.n, 0) desc, coalesce(v.n, 0) desc), '[]'::jsonb)
    from k
    left join v on v.s = k.s
    left join w on w.s = k.s
    left join p on p.s = k.s
    left join a on a.s = k.s
  );
end $$;
revoke execute on function public.traction_stats() from public, anon;
grant execute on function public.traction_stats() to authenticated;
