-- profiles: one row per auth user
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create policy "profiles: read own" on public.profiles
  for select to authenticated using (auth.uid() = id);
create policy "profiles: update own" on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)));
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- waitlist: anon/authenticated may insert only, nobody can read via the API
create table public.waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null check (position('@' in email) > 1 and length(email) <= 254),
  created_at timestamptz not null default now()
);
create unique index waitlist_email_key on public.waitlist (lower(email));
alter table public.waitlist enable row level security;

create policy "waitlist: insert only" on public.waitlist
  for insert to anon, authenticated with check (true);
