create or replace function public.transition_order(
  p_order_id uuid,
  p_expected public.order_status,
  p_next public.order_status,
  p_actor_id uuid,
  p_note text,
  p_payment_ref text default null
) returns public.orders
language plpgsql security definer set search_path = public as $$
declare
  v_order public.orders%rowtype;
  v_allowed boolean;
begin
  select * into v_order from public.orders o where o.id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_order.status = p_next then return v_order; end if;
  if v_order.status is distinct from p_expected then raise exception 'ORDER_STATE_CHANGED'; end if;

  v_allowed := case v_order.status
    when 'pending' then p_next = 'payment_pending'
    when 'payment_pending' then p_next = 'paid'
    when 'paid' then p_next in ('ticket_delivered','disputed','refunded')
    when 'ticket_delivered' then p_next in ('completed','disputed','refunded')
    when 'disputed' then p_next in ('refunded','completed')
    else false end;
  if not v_allowed then raise exception 'INVALID_ORDER_TRANSITION'; end if;

  update public.orders o set
    status = p_next,
    paid_at = case when p_next = 'paid' then now() else o.paid_at end,
    delivered_at = case when p_next = 'ticket_delivered' then now() else o.delivered_at end,
    invoice_number = case when p_next = 'paid' then 'PO-' || to_char(now(), 'YYYY') || '-' || upper(substr(replace(o.id::text,'-',''),1,10)) else o.invoice_number end,
    invoice_issued_at = case when p_next = 'paid' then now() else o.invoice_issued_at end,
    payment_ref = coalesce(p_payment_ref, o.payment_ref),
    updated_at = now()
    where o.id = p_order_id returning * into v_order;

  if p_next = 'paid' then
    update public.listings l set status = 'sold', held_until = null, updated_at = now()
      where l.id = v_order.listing_id and l.status = 'held';
  end if;
  insert into public.order_events(order_id, actor_id, from_status, to_status, note, metadata)
    values (p_order_id, p_actor_id, p_expected, p_next, left(coalesce(p_note,''),300),
      case when p_payment_ref is null then '{}'::jsonb else jsonb_build_object('payment_ref', p_payment_ref) end);
  return v_order;
end;
$$;
revoke all on function public.transition_order(uuid,public.order_status,public.order_status,uuid,text,text) from public, anon, authenticated;
grant execute on function public.transition_order(uuid,public.order_status,public.order_status,uuid,text,text) to service_role;

comment on column public.orders.status is 'State machine: pending=created; delivered is a legacy value, replaced by ticket_delivered for new orders.';