-- Core product: curated spots, shareable plans, votes. See Project-Plan.md ADR-1 to ADR-3.

-- spots: curated by hand (CSV import / table editor). Anyone may read published rows.
create table public.spots (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  neighbourhood text not null check (neighbourhood in ('neukoelln', 'kreuzberg')),
  category text not null check (category in ('food', 'drinks', 'market', 'culture', 'sport', 'outdoors', 'nightlife', 'other')),
  indoor boolean not null default true,
  price smallint not null default 1 check (price between 0 and 3), -- 0 free, 1 under 15, 2 15-30, 3 over 30 (EUR)
  address text not null,
  station text,
  -- Opening hours for this weekend. Null open = closed that day. Close <= open = closes after midnight.
  sat_open time,
  sat_close time,
  sun_open time,
  sun_close time,
  video_url text not null, -- full TikTok / Instagram post URL
  venue_handle text,
  creator_handle text,
  note_en text,
  note_de text,
  published boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.spots enable row level security;
grant select on public.spots to anon, authenticated;
create policy "spots: read published" on public.spots
  for select to anon, authenticated using (published);

-- plans: a shortlist of 1 to 3 spots. The client generates the id; that random id in the link
-- is the only way in, so there is no select policy (reads go through get_plan).
create table public.plans (
  id uuid primary key,
  spot_ids uuid[] not null check (cardinality(spot_ids) between 1 and 3),
  device_id uuid not null,
  neighbourhood text,
  source text check (length(source) <= 100),
  created_at timestamptz not null default now()
);
alter table public.plans enable row level security;
grant insert on public.plans to anon, authenticated;
create policy "plans: insert only" on public.plans
  for insert to anon, authenticated with check (true);

-- votes: one per device per plan. No policies: written by cast_vote, read by get_plan.
create table public.votes (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans (id) on delete cascade,
  spot_id uuid not null,
  device_id uuid not null,
  voter_name text not null check (length(voter_name) between 1 and 30),
  created_at timestamptz not null default now(),
  unique (plan_id, device_id)
);
alter table public.votes enable row level security;

-- Anonymous identity on events, so distinct real users can be counted without signup.
alter table public.events add column anon_id uuid;

-- A plan with its spots (in shortlist order), vote counts and voter names. Null if it does not exist.
create function public.get_plan(p_plan_id uuid, p_device_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_plan public.plans;
begin
  select * into v_plan from public.plans where id = p_plan_id;
  if not found then
    return null;
  end if;
  return jsonb_build_object(
    'id', v_plan.id,
    'created_at', v_plan.created_at,
    'my_vote', (select v.spot_id from public.votes v where v.plan_id = p_plan_id and v.device_id = p_device_id),
    'total_votes', (select count(*) from public.votes v where v.plan_id = p_plan_id),
    'spots', coalesce((
      select jsonb_agg(
        (to_jsonb(s) - 'published' - 'created_at') || jsonb_build_object(
          'votes', (select count(*) from public.votes v where v.plan_id = p_plan_id and v.spot_id = s.id),
          'voters', coalesce((
            select jsonb_agg(v.voter_name order by v.created_at)
            from public.votes v where v.plan_id = p_plan_id and v.spot_id = s.id
          ), '[]'::jsonb)
        ) order by u.ord
      )
      from unnest(v_plan.spot_ids) with ordinality as u (spot_id, ord)
      join public.spots s on s.id = u.spot_id and s.published
    ), '[]'::jsonb)
  );
end $$;

-- Cast or change this device's vote, then return the updated plan.
create function public.cast_vote(p_plan_id uuid, p_spot_id uuid, p_device_id uuid, p_name text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_spot_ids uuid[];
begin
  select spot_ids into v_spot_ids from public.plans where id = p_plan_id;
  if not found then
    raise exception 'plan not found' using errcode = 'P0002';
  end if;
  if not (p_spot_id = any (v_spot_ids)) then
    raise exception 'spot not in plan' using errcode = '22023';
  end if;
  insert into public.votes (plan_id, spot_id, device_id, voter_name)
  values (p_plan_id, p_spot_id, p_device_id, left(btrim(p_name), 30))
  on conflict (plan_id, device_id)
  do update set spot_id = excluded.spot_id, voter_name = excluded.voter_name;
  return public.get_plan(p_plan_id, p_device_id);
end $$;

grant execute on function public.get_plan(uuid, uuid) to anon, authenticated;
grant execute on function public.cast_vote(uuid, uuid, uuid, text) to anon, authenticated;
