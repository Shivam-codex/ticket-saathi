create or replace function public.claim_payout(p_payout_id uuid) returns public.payouts
language plpgsql security definer set search_path = public as $$
declare v_payout public.payouts%rowtype; v_order public.orders%rowtype;
begin
  select p.* into v_payout from public.payouts p
    join public.orders o on o.id = p.order_id
    join public.listings l on l.id = o.listing_id
    join public.events e on e.id = l.event_id
    where p.id = p_payout_id and p.status in ('scheduled','on_hold')
      and o.status in ('ticket_delivered','completed')
      and not exists (select 1 from public.disputes d where d.order_id = o.id and d.status in ('open','reviewing'))
      and (o.entry_confirmed_at is not null or (e.ends_at is not null and e.ends_at + interval '24 hours' <= now()))
    for update of p skip locked;
  if not found then return null; end if;
  update public.payouts p set status = 'processing', failure_reason = null, updated_at = now()
    where p.id = p_payout_id returning * into v_payout;
  insert into public.payment_operations(order_id,operation,provider,status,updated_at)
    values (v_payout.order_id,'payout',v_payout.provider,'processing',now())
    on conflict (order_id,operation) do update set status = 'processing', error = null, updated_at = now()
    where payment_operations.status <> 'succeeded';
  select * into v_order from public.orders o where o.id = v_payout.order_id;
  if v_order.status = 'ticket_delivered' and v_order.entry_confirmed_at is null then
    update public.orders o set status = 'completed', updated_at = now() where o.id = v_order.id;
    insert into public.order_events(order_id,actor_id,from_status,to_status,note)
      values (v_order.id,null,'ticket_delivered','completed','Automatically completed 24 hours after event ended');
  end if;
  return v_payout;
end;
$$;
revoke all on function public.claim_payout(uuid) from public, anon, authenticated;
grant execute on function public.claim_payout(uuid) to service_role;