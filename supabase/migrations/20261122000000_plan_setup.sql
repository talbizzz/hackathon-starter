-- Plans now have a size: how many people are deciding, and up to 10 spots (the creator picks 3, 5 or 10).
-- A plan is finalized once as many votes are in as there are participants.
alter table public.plans
  add column participants smallint not null default 2 check (participants between 2 and 50),
  drop constraint plans_spot_ids_check,
  add constraint plans_spot_ids_check check (cardinality(spot_ids) between 1 and 10);

-- get_plan: same shape as before, plus participants and finalized.
create or replace function public.get_plan(p_plan_id uuid, p_device_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_plan public.plans;
  v_votes integer;
begin
  select * into v_plan from public.plans where id = p_plan_id;
  if not found then
    return null;
  end if;
  select count(*) into v_votes from public.votes v where v.plan_id = p_plan_id;
  return jsonb_build_object(
    'id', v_plan.id,
    'created_at', v_plan.created_at,
    'participants', v_plan.participants,
    'total_votes', v_votes,
    'finalized', v_votes >= v_plan.participants,
    'my_vote', (select v.spot_id from public.votes v where v.plan_id = p_plan_id and v.device_id = p_device_id),
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
      join public.spots s on s.id = u.spot_id and s.published and s.video_file_url is not null
    ), '[]'::jsonb)
  );
end $$;
