create or replace function public.create_checkout_order_v2(
  p_listing_id uuid,
  p_buyer_id uuid,
  p_quantity integer,
  p_idempotency_key text,
  p_unit_price_paise bigint,
  p_buyer_fee_paise bigint,
  p_buyer_fee_gst_paise bigint,
  p_seller_fee_paise bigint,
  p_seller_fee_gst_paise bigint,
  p_total_paise bigint,
  p_seller_net_paise bigint,
  p_tcs_paise bigint,
  p_tds_paise bigint,
  p_fee_config_id uuid,
  p_buyer_name text,
  p_buyer_phone text,
  p_buyer_state_code text,
  p_buyer_upi_id text,
  p_payment_method text,
  p_payment_provider text
) returns public.orders
language plpgsql security definer set search_path = public as $$
declare
  v_listing public.listings%rowtype;
  v_order public.orders%rowtype;
  v_stale public.orders%rowtype;
begin
  if p_buyer_id is null or p_quantity <= 0 or char_length(p_idempotency_key) < 12 then
    raise exception 'INVALID_CHECKOUT';
  end if;
  if p_unit_price_paise < 0 or p_buyer_fee_paise < 0 or p_buyer_fee_gst_paise < 0
    or p_seller_fee_paise < 0 or p_seller_fee_gst_paise < 0 or p_total_paise < 0 or p_seller_net_paise < 0
    or p_tcs_paise < 0 or p_tds_paise < 0 then
    raise exception 'INVALID_AMOUNTS';
  end if;
  if p_payment_provider not in ('mock','razorpay') then raise exception 'INVALID_PAYMENT_PROVIDER'; end if;

  select * into v_order from public.orders o where o.idempotency_key = p_idempotency_key;
  if found then
    if v_order.buyer_id is distinct from p_buyer_id then raise exception 'IDEMPOTENCY_KEY_REUSED'; end if;
    return v_order;
  end if;

  select * into v_stale from public.orders o
    where o.listing_id = p_listing_id and o.status = 'payment_pending' and o.hold_expires_at <= now()
    order by o.created_at limit 1 for update;
  if found then
    perform public.release_checkout_order(v_stale.id, null, 'Reservation expired');
  end if;

  update public.listings l
    set status = 'held', held_until = now() + interval '10 minutes', updated_at = now()
    where l.id = p_listing_id
      and l.status = 'active'
      and not l.is_paused
      and l.price_paise = p_unit_price_paise
      and l.quantity = p_quantity
      and l.seller_id is distinct from p_buyer_id
      and exists (select 1 from public.events e where e.id = l.event_id and e.starts_at > now() and e.is_resellable)
    returning * into v_listing;

  if not found then return null; end if;

  insert into public.orders(
    listing_id, buyer_id, seller_id, quantity, price_paise,
    buyer_fee_paise, buyer_fee_gst_paise, seller_fee_paise, seller_fee_gst_paise,
    total_paise, seller_net_paise, tcs_paise, tds_paise, fee_config_id, status, idempotency_key,
    buyer_name, buyer_phone, buyer_state_code, buyer_upi_id, payment_method,
    payment_provider, hold_expires_at
  ) values (
    p_listing_id, p_buyer_id, v_listing.seller_id, p_quantity, p_unit_price_paise,
    p_buyer_fee_paise, p_buyer_fee_gst_paise, p_seller_fee_paise, p_seller_fee_gst_paise,
    p_total_paise, p_seller_net_paise, p_tcs_paise, p_tds_paise, p_fee_config_id, 'pending', p_idempotency_key,
    p_buyer_name, p_buyer_phone, p_buyer_state_code, p_buyer_upi_id, p_payment_method,
    p_payment_provider, v_listing.held_until
  ) returning * into v_order;

  insert into public.order_events(order_id, actor_id, from_status, to_status, note)
    values (v_order.id, p_buyer_id, null, 'pending', 'Order created');
  update public.orders o set status = 'payment_pending', updated_at = now()
    where o.id = v_order.id returning * into v_order;
  insert into public.order_events(order_id, actor_id, from_status, to_status, note)
    values (v_order.id, p_buyer_id, 'pending', 'payment_pending', 'Tickets reserved for 10 minutes');
  return v_order;
end;
$$;
revoke all on function public.create_checkout_order_v2(uuid,uuid,integer,text,bigint,bigint,bigint,bigint,bigint,bigint,bigint,bigint,bigint,uuid,text,text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.create_checkout_order_v2(uuid,uuid,integer,text,bigint,bigint,bigint,bigint,bigint,bigint,bigint,bigint,bigint,uuid,text,text,text,text,text,text) to service_role;