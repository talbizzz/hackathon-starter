-- Only verified server-side PayPal code may write payment state. Sandbox/live never share entitlements.
create table public.paid_plan_receipts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id text not null check (product_id = 'kreuzberg-sunday'),
  mode text not null check (mode in ('sandbox', 'live')),
  merchant_id text not null,
  amount_cents integer not null default 399 check (amount_cents = 399),
  currency text not null default 'EUR' check (currency = 'EUR'),
  order_id text,
  capture_id text,
  status text not null default 'CREATED' check (status in ('CREATED', 'COMPLETED', 'REVOKED', 'FAILED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reusable_until timestamptz not null default (now() + interval '2 hours'),
  unique (mode, order_id), unique (mode, capture_id)
);
create index paid_plan_buyer_idx on public.paid_plan_receipts(user_id, mode, product_id, created_at desc);
create table public.paid_plan_webhook_events (
  event_id text primary key,
  receipt_id uuid not null references public.paid_plan_receipts(id) on delete cascade,
  received_at timestamptz not null default now()
);
alter table public.paid_plan_receipts enable row level security;
alter table public.paid_plan_webhook_events enable row level security;
revoke all on public.paid_plan_receipts, public.paid_plan_webhook_events from public, anon, authenticated;
grant select on public.paid_plan_receipts to authenticated;
create policy "buyers read own receipts" on public.paid_plan_receipts for select to authenticated using ((select auth.uid()) = user_id);
grant select, insert, update, delete on public.paid_plan_receipts, public.paid_plan_webhook_events to service_role;

-- Invoker privileges, service_role only. Row lock serializes capture, duplicate and out-of-order webhook races.
-- Revocation is terminal per order; a new purchase creates a new receipt.
create function public.apply_paid_plan_payment(p_order_id text, p_mode text, p_capture_id text, p_status text, p_event_id text default null)
returns text language plpgsql security invoker set search_path = '' as $$
declare receipt public.paid_plan_receipts; existing_receipt uuid;
begin
  if p_status not in ('COMPLETED', 'REVOKED') or p_capture_id is null or length(p_capture_id) = 0 then
    raise exception 'Invalid payment transition';
  end if;
  select * into strict receipt from public.paid_plan_receipts where order_id = p_order_id and mode = p_mode for update;
  if receipt.capture_id is not null and receipt.capture_id <> p_capture_id then raise exception 'Capture mismatch'; end if;
  if p_event_id is not null then
    insert into public.paid_plan_webhook_events(event_id, receipt_id) values(p_event_id, receipt.id) on conflict do nothing;
    if not found then
      select receipt_id into existing_receipt from public.paid_plan_webhook_events where event_id = p_event_id;
      if existing_receipt <> receipt.id then raise exception 'Event mismatch'; end if;
      return receipt.status;
    end if;
  end if;
  if receipt.status in ('REVOKED', 'FAILED') then return receipt.status; end if;
  update public.paid_plan_receipts set status = p_status, capture_id = p_capture_id, updated_at = now() where id = receipt.id;
  return p_status;
end $$;
revoke all on function public.apply_paid_plan_payment(text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.apply_paid_plan_payment(text,text,text,text,text) to service_role;

-- Recovery pin prevents a second charge while the first provider result is uncertain.
create table public.paid_plan_capture_claims (
  user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null check (mode in ('sandbox', 'live')),
  receipt_id uuid not null references public.paid_plan_receipts(id) on delete cascade,
  primary key(user_id, mode)
);
alter table public.paid_plan_capture_claims enable row level security;
revoke all on public.paid_plan_capture_claims from public, anon, authenticated;
grant select, insert, update, delete on public.paid_plan_capture_claims to service_role;

create function public.reserve_paid_plan_order(p_user_id uuid, p_mode text, p_merchant_id text)
returns public.paid_plan_receipts language plpgsql security invoker set search_path = '' as $$
declare r public.paid_plan_receipts;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text || p_mode, 0));
  select rec.* into r from public.paid_plan_receipts rec
    join public.paid_plan_capture_claims c on c.receipt_id = rec.id
    where c.user_id = p_user_id and c.mode = p_mode and rec.status = 'CREATED';
  if found then return r; end if;
  select * into r from public.paid_plan_receipts
    where user_id = p_user_id and mode = p_mode and merchant_id = p_merchant_id
      and status = 'CREATED' and reusable_until > now()
    order by created_at desc limit 1;
  if found then return r; end if;
  insert into public.paid_plan_receipts(user_id, mode, merchant_id, product_id)
    values(p_user_id, p_mode, p_merchant_id, 'kreuzberg-sunday') returning * into r;
  return r;
end $$;
create function public.claim_paid_plan_capture(p_order_id text, p_mode text)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare r public.paid_plan_receipts; pinned uuid;
begin
  select * into strict r from public.paid_plan_receipts where order_id = p_order_id and mode = p_mode;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(r.user_id::text || p_mode, 0));
  -- A refunded/reversed receipt permits a later independent purchase, without reviving the revoked receipt.
  delete from public.paid_plan_capture_claims c using public.paid_plan_receipts old
    where c.receipt_id = old.id and c.user_id = r.user_id and c.mode = p_mode and old.status = 'REVOKED';
  if exists(select 1 from public.paid_plan_receipts where user_id = r.user_id and mode = p_mode and status = 'COMPLETED') then return false; end if;
  insert into public.paid_plan_capture_claims(user_id, mode, receipt_id) values(r.user_id, p_mode, r.id) on conflict do nothing;
  select receipt_id into pinned from public.paid_plan_capture_claims where user_id = r.user_id and mode = p_mode;
  return pinned = r.id;
end $$;
revoke all on function public.reserve_paid_plan_order(uuid,text,text), public.claim_paid_plan_capture(text,text) from public, anon, authenticated;
grant execute on function public.reserve_paid_plan_order(uuid,text,text), public.claim_paid_plan_capture(text,text) to service_role;

-- Called only after server verifies VOIDED order or a terminal failed capture from PayPal.
create function public.retire_paid_plan_order(p_receipt_id uuid)
returns void language plpgsql security invoker set search_path = '' as $$
declare r public.paid_plan_receipts;
begin
  select * into strict r from public.paid_plan_receipts where id = p_receipt_id;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(r.user_id::text || r.mode, 0));
  update public.paid_plan_receipts set status = 'FAILED', reusable_until = now(), updated_at = now() where id = r.id and status = 'CREATED';
  delete from public.paid_plan_capture_claims where receipt_id = r.id and exists(select 1 from public.paid_plan_receipts where id = r.id and status = 'FAILED');
end $$;
revoke all on function public.retire_paid_plan_order(uuid) from public, anon, authenticated;
grant execute on function public.retire_paid_plan_order(uuid) to service_role;

-- Prefer the pinned recovery order over any later checkout from another tab.
create function public.latest_paid_plan_order(p_user_id uuid, p_mode text)
returns public.paid_plan_receipts language sql stable security invoker set search_path = '' as $$
  select r.* from public.paid_plan_receipts r
  left join public.paid_plan_capture_claims c on c.receipt_id = r.id
  where r.user_id = p_user_id and r.mode = p_mode and r.order_id is not null
  order by (c.receipt_id is not null and r.status = 'CREATED') desc, r.created_at desc, r.id desc
  limit 1
$$;
revoke all on function public.latest_paid_plan_order(uuid,text) from public, anon, authenticated;
grant execute on function public.latest_paid_plan_order(uuid,text) to service_role;
