-- Self-hosted video replaces TikTok / Instagram embeds. Only videos the team has the right to use are uploaded.
-- A spot is public only once it has a hosted video.

alter table public.spots
  drop column image_url,
  add column video_file_url text, -- public URL of the uploaded video in the spot-media bucket
  add column poster_url text,     -- still frame, used as the video poster and the map pin picture
  alter column video_url drop not null; -- now optional: link to the original post, shown as credit

create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

drop policy "spots: read published" on public.spots;
create policy "spots: read published with video" on public.spots
  for select to anon, authenticated using (published and video_file_url is not null);
-- Admins (see public.admins) manage spots from /admin, including ones still waiting for a video.
create policy "spots: admins manage" on public.spots
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant insert, update, delete on public.spots to authenticated;

-- Public bucket for videos and posters. Anyone can read by URL; only admins can write.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('spot-media', 'spot-media', true, 52428800, array['video/mp4', 'video/quicktime', 'video/webm', 'image/jpeg'])
on conflict (id) do nothing;

create policy "spot-media: admins read" on storage.objects
  for select to authenticated using (bucket_id = 'spot-media' and public.is_admin());
create policy "spot-media: admins upload" on storage.objects
  for insert to authenticated with check (bucket_id = 'spot-media' and public.is_admin());
create policy "spot-media: admins delete" on storage.objects
  for delete to authenticated using (bucket_id = 'spot-media' and public.is_admin());

-- get_plan: same as before, but a spot without a hosted video is left out.
create or replace function public.get_plan(p_plan_id uuid, p_device_id uuid default null) returns jsonb
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
      join public.spots s on s.id = u.spot_id and s.published and s.video_file_url is not null
    ), '[]'::jsonb)
  );
end $$;
