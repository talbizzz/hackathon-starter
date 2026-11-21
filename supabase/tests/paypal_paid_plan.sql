-- Run with psql ON_ERROR_STOP=1 after migrations. All fixtures roll back.
begin;
insert into auth.users(id) values ('11111111-1111-1111-1111-111111111111'), ('22222222-2222-2222-2222-222222222222');
set local role service_role;
do $$
declare a public.paid_plan_receipts; b public.paid_plan_receipts; c public.paid_plan_receipts;
begin
  a := public.reserve_paid_plan_order('11111111-1111-1111-1111-111111111111','sandbox','MERCHANT');
  b := public.reserve_paid_plan_order('11111111-1111-1111-1111-111111111111','sandbox','MERCHANT');
  if a.id <> b.id then raise exception 'reserve must reuse pending receipt'; end if;
  update public.paid_plan_receipts set order_id = 'ORDER1' where id = a.id;
  if not public.claim_paid_plan_capture('ORDER1','sandbox') then raise exception 'first capture claim'; end if;
  update public.paid_plan_receipts set reusable_until = now() - interval '1 second' where id = a.id;
  b := public.reserve_paid_plan_order('11111111-1111-1111-1111-111111111111','sandbox','MERCHANT');
  if a.id <> b.id then raise exception 'uncertain capture must stay pinned'; end if;
  insert into public.paid_plan_receipts(user_id, mode, merchant_id, product_id, order_id) values(a.user_id,'sandbox','MERCHANT','kreuzberg-sunday','ORDER2') returning * into c;
  if public.claim_paid_plan_capture('ORDER2','sandbox') then raise exception 'must prevent a different capture while unresolved'; end if;
  if (public.latest_paid_plan_order(a.user_id,'sandbox')).id <> a.id then raise exception 'recovery must prefer pinned order'; end if;
  if public.apply_paid_plan_payment('ORDER1','sandbox','CAPTURE1','COMPLETED','WH-complete') <> 'COMPLETED' then raise exception 'complete'; end if;
  if public.apply_paid_plan_payment('ORDER1','sandbox','CAPTURE1','COMPLETED','WH-complete') <> 'COMPLETED' then raise exception 'duplicate'; end if;
  if public.claim_paid_plan_capture('ORDER2','sandbox') then raise exception 'must prevent charging already entitled buyer'; end if;
  if public.apply_paid_plan_payment('ORDER1','sandbox','CAPTURE1','REVOKED','WH-refund') <> 'REVOKED' then raise exception 'refund'; end if;
  if public.apply_paid_plan_payment('ORDER1','sandbox','CAPTURE1','COMPLETED','WH-old') <> 'REVOKED' then raise exception 'late completion must not revive'; end if;
  if public.apply_paid_plan_payment('ORDER1','sandbox','CAPTURE1','COMPLETED','WH-complete') <> 'REVOKED' then raise exception 'duplicate old completion must not revive'; end if;
  if not public.claim_paid_plan_capture('ORDER2','sandbox') then raise exception 'new purchase after refund allowed'; end if;
  perform public.apply_paid_plan_payment('ORDER2','sandbox','CAPTURE2','REVOKED','WH-early-refund');
  if public.apply_paid_plan_payment('ORDER2','sandbox','CAPTURE2','COMPLETED','WH-late-complete') <> 'REVOKED' then raise exception 'refund before capture reconciliation must be terminal'; end if;
  begin
    perform public.apply_paid_plan_payment('ORDER1','sandbox','OTHER-CAPTURE','COMPLETED','WH-bad');
    raise exception 'capture mismatch was accepted';
  exception when raise_exception then if sqlerrm = 'capture mismatch was accepted' then raise; end if; end;
  perform public.retire_paid_plan_order(c.id);
  c := public.reserve_paid_plan_order('11111111-1111-1111-1111-111111111111','live','MERCHANT');
  if c.id = a.id or c.mode <> 'live' then raise exception 'mode isolation'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',true);
set local role authenticated;
do $$ begin
  if exists(select 1 from public.paid_plan_receipts where user_id <> '11111111-1111-1111-1111-111111111111') then raise exception 'owner read violation'; end if;
  begin
    update public.paid_plan_receipts set status = 'COMPLETED';
    raise exception 'client write allowed';
  exception when insufficient_privilege then null; end;
  begin
    perform public.apply_paid_plan_payment('ORDER1','sandbox','CAPTURE1','COMPLETED');
    raise exception 'client RPC allowed';
  exception when insufficient_privilege then null; end;
  begin
    perform public.reserve_paid_plan_order('11111111-1111-1111-1111-111111111111','sandbox','MERCHANT');
    raise exception 'client reservation allowed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',true);
set local role authenticated;
do $$ begin if exists(select 1 from public.paid_plan_receipts) then raise exception 'other buyer read violation'; end if; end $$;
reset role;
set local role anon;
do $$ begin
  begin perform * from public.paid_plan_receipts; raise exception 'anon read allowed'; exception when insufficient_privilege then null; end;
  begin perform public.claim_paid_plan_capture('ORDER1','sandbox'); raise exception 'anon RPC allowed'; exception when insufficient_privilege then null; end;
end $$;
rollback;
