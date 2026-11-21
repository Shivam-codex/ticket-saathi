create or replace function public.record_late_refunded_payment(
  p_order_id uuid,
  p_payment_ref text,
  p_refund_ref text,
  p_actor_id uuid
) returns public.orders
language plpgsql security definer set search_path = public as $$
declare v_order public.orders%rowtype;
begin
  select * into v_order from public.orders o where o.id = p_order_id and o.status = 'cancelled' for update;
  if not found then raise exception 'ORDER_NOT_LATE_PAYABLE'; end if;
  update public.orders o set status = 'payment_pending', updated_at = now() where o.id = p_order_id;
  perform public.record_order_payment(p_order_id, p_payment_ref, p_actor_id, 24);
  return public.record_order_refund(p_order_id, p_refund_ref, p_actor_id, 'Late payment automatically refunded because the reservation expired');
end;
$$;
revoke all on function public.record_late_refunded_payment(uuid,text,text,uuid) from public, anon, authenticated;
grant execute on function public.record_late_refunded_payment(uuid,text,text,uuid) to service_role;

create or replace function public.confirm_buyer_entry(p_order_id uuid, p_buyer_id uuid) returns public.orders
language plpgsql security definer set search_path = public as $$
declare v_order public.orders%rowtype;
begin
  select o into v_order from public.orders o
    join public.listings l on l.id = o.listing_id
    join public.events e on e.id = l.event_id
    where o.id = p_order_id and o.buyer_id = p_buyer_id and o.status = 'ticket_delivered' and e.starts_at <= now()
    for update of o;
  if not found then raise exception 'ENTRY_CANNOT_BE_CONFIRMED'; end if;
  update public.orders o set status = 'completed', entry_confirmed_at = now(), updated_at = now()
    where o.id = p_order_id returning * into v_order;
  insert into public.order_events(order_id,actor_id,from_status,to_status,note)
    values (p_order_id,p_buyer_id,'ticket_delivered','completed','Buyer confirmed entry; seller payout is eligible');
  return v_order;
end;
$$;
revoke all on function public.confirm_buyer_entry(uuid,uuid) from public, anon, authenticated;
grant execute on function public.confirm_buyer_entry(uuid,uuid) to service_role;