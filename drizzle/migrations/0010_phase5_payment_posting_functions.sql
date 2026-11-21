create or replace function public.record_order_payment(
  p_order_id uuid,
  p_payment_ref text,
  p_actor_id uuid,
  p_delivery_hours integer default 24
) returns public.orders
language plpgsql security definer set search_path = public as $$
declare
  v_order public.orders%rowtype;
  v_previous public.order_status;
  v_group uuid := gen_random_uuid();
  v_subtotal bigint;
begin
  select * into v_order from public.orders o where o.id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_order.status in ('paid','ticket_delivered','completed','disputed') then return v_order; end if;
  if v_order.status <> 'payment_pending' then raise exception 'ORDER_NOT_PAYABLE'; end if;
  if p_payment_ref is null or char_length(p_payment_ref) < 3 then raise exception 'PAYMENT_REFERENCE_REQUIRED'; end if;
  v_previous := v_order.status;
  v_subtotal := v_order.price_paise * v_order.quantity;

  update public.orders o set status = 'paid', payment_ref = p_payment_ref, paid_at = now(),
    delivery_due_at = now() + make_interval(hours => greatest(1, least(p_delivery_hours, 168))),
    invoice_number = 'PO-' || to_char(now(), 'YYYY') || '-' || upper(substr(replace(o.id::text,'-',''),1,10)),
    invoice_issued_at = now(), updated_at = now()
    where o.id = p_order_id returning * into v_order;
  insert into public.order_events(order_id, actor_id, from_status, to_status, note, metadata)
    values (p_order_id, p_actor_id, v_previous, 'paid', 'Provider payment verified', jsonb_build_object('payment_ref', p_payment_ref));
  update public.listings l set status = 'sold', held_until = null, updated_at = now()
    where l.id = v_order.listing_id and l.status = 'held';

  if exists (select 1 from public.listing_secrets s where s.listing_id = v_order.listing_id and s.file_path is not null) then
    update public.orders o set status = 'ticket_delivered', delivered_at = now(), updated_at = now()
      where o.id = p_order_id returning * into v_order;
    insert into public.order_events(order_id, actor_id, from_status, to_status, note)
      values (p_order_id, p_actor_id, 'paid', 'ticket_delivered', 'Private ticket delivery enabled');
  end if;

  insert into public.payouts(seller_id, order_id, amount_paise, status, scheduled_for, provider)
    select v_order.seller_id, v_order.id, v_order.seller_net_paise - v_order.tcs_paise - v_order.tds_paise,
      'on_hold', case when e.ends_at is null then null else e.ends_at + interval '24 hours' end, v_order.payment_provider
    from public.listings l join public.events e on e.id = l.event_id
    where l.id = v_order.listing_id
    on conflict (order_id) do nothing;

  insert into public.ledger_entries(order_id,user_id,account,direction,amount_paise,memo,transaction_group,entry_type,provider_ref,idempotency_key,tcs_paise,tds_paise) values
    (p_order_id,v_order.buyer_id,'provider_settlement','debit',v_order.total_paise,'Buyer payment held by payment provider',v_group,'payment_provider',p_payment_ref,'payment:'||p_order_id||':provider',0,0),
    (p_order_id,v_order.seller_id,'seller','credit',v_subtotal,'Gross ticket proceeds payable to seller',v_group,'ticket_price',p_payment_ref,'payment:'||p_order_id||':ticket',0,0),
    (p_order_id,null,'platform_fee','credit',v_order.buyer_fee_paise,'Buyer platform fee',v_group,'buyer_fee',p_payment_ref,'payment:'||p_order_id||':buyer_fee',0,0),
    (p_order_id,null,'gst_payable','credit',v_order.buyer_fee_gst_paise,'GST on buyer fee',v_group,'buyer_gst',p_payment_ref,'payment:'||p_order_id||':buyer_gst',0,0),
    (p_order_id,v_order.seller_id,'seller','debit',v_order.seller_fee_paise,'Seller platform fee deducted',v_group,'seller_fee',p_payment_ref,'payment:'||p_order_id||':seller_fee',0,0),
    (p_order_id,null,'platform_fee','credit',v_order.seller_fee_paise,'Seller platform fee',v_group,'seller_fee',p_payment_ref,'payment:'||p_order_id||':seller_fee_income',0,0),
    (p_order_id,v_order.seller_id,'seller','debit',v_order.seller_fee_gst_paise,'GST on seller fee deducted',v_group,'seller_gst',p_payment_ref,'payment:'||p_order_id||':seller_gst',0,0),
    (p_order_id,null,'gst_payable','credit',v_order.seller_fee_gst_paise,'GST on seller fee',v_group,'seller_gst',p_payment_ref,'payment:'||p_order_id||':seller_gst_payable',0,0);
  if v_order.tcs_paise > 0 then
    insert into public.ledger_entries(order_id,user_id,account,direction,amount_paise,memo,transaction_group,entry_type,provider_ref,idempotency_key,tcs_paise) values
      (p_order_id,v_order.seller_id,'seller','debit',v_order.tcs_paise,'TCS placeholder; CA confirmation required',v_group,'tcs',p_payment_ref,'payment:'||p_order_id||':tcs_deducted',v_order.tcs_paise),
      (p_order_id,null,'tcs_payable','credit',v_order.tcs_paise,'TCS placeholder payable; CA confirmation required',v_group,'tcs',p_payment_ref,'payment:'||p_order_id||':tcs_payable',v_order.tcs_paise);
  end if;
  if v_order.tds_paise > 0 then
    insert into public.ledger_entries(order_id,user_id,account,direction,amount_paise,memo,transaction_group,entry_type,provider_ref,idempotency_key,tds_paise) values
      (p_order_id,v_order.seller_id,'seller','debit',v_order.tds_paise,'TDS placeholder; CA confirmation required',v_group,'tds',p_payment_ref,'payment:'||p_order_id||':tds_deducted',v_order.tds_paise),
      (p_order_id,null,'tds_payable','credit',v_order.tds_paise,'TDS placeholder payable; CA confirmation required',v_group,'tds',p_payment_ref,'payment:'||p_order_id||':tds_payable',v_order.tds_paise);
  end if;
  return v_order;
end;
$$;
revoke all on function public.record_order_payment(uuid,text,uuid,integer) from public, anon, authenticated;
grant execute on function public.record_order_payment(uuid,text,uuid,integer) to service_role;

create or replace function public.record_order_refund(
  p_order_id uuid,
  p_refund_ref text,
  p_actor_id uuid,
  p_note text
) returns public.orders
language plpgsql security definer set search_path = public as $$
declare
  v_order public.orders%rowtype;
  v_previous public.order_status;
  v_group uuid := gen_random_uuid();
  v_seller_refund bigint;
begin
  select * into v_order from public.orders o where o.id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_order.status = 'refunded' then return v_order; end if;
  if v_order.status not in ('paid','ticket_delivered','disputed') then raise exception 'ORDER_NOT_REFUNDABLE'; end if;
  if not exists (select 1 from public.ledger_entries le where le.order_id = p_order_id and le.entry_type = 'payment_provider') then
    raise exception 'PAYMENT_LEDGER_MISSING';
  end if;
  v_previous := v_order.status;
  v_seller_refund := v_order.seller_net_paise - v_order.tcs_paise - v_order.tds_paise;
  update public.orders o set status = 'refunded', refund_provider_ref = p_refund_ref, refunded_at = now(), updated_at = now()
    where o.id = p_order_id returning * into v_order;
  insert into public.order_events(order_id,actor_id,from_status,to_status,note,metadata)
    values (p_order_id,p_actor_id,v_previous,'refunded',left(coalesce(p_note,'Buyer refunded'),300),jsonb_build_object('refund_ref',p_refund_ref));
  update public.payouts p set status = 'failed', failure_reason = 'Order refunded before payout', updated_at = now()
    where p.order_id = p_order_id and p.status in ('scheduled','on_hold','processing');
  update public.disputes d set status = 'resolved_refund', resolution_note = left(coalesce(p_note,'Buyer refunded'),1000), updated_at = now()
    where d.order_id = p_order_id and d.status in ('open','reviewing');

  insert into public.ledger_entries(order_id,user_id,account,direction,amount_paise,memo,transaction_group,entry_type,provider_ref,idempotency_key,tcs_paise,tds_paise) values
    (p_order_id,v_order.seller_id,'seller','debit',v_seller_refund,'Seller proceeds reversed for refund',v_group,'refund_seller',p_refund_ref,'refund:'||p_order_id||':seller',0,0),
    (p_order_id,null,'platform_fee','debit',v_order.buyer_fee_paise,'Buyer fee refunded',v_group,'refund_buyer_fee',p_refund_ref,'refund:'||p_order_id||':buyer_fee',0,0),
    (p_order_id,null,'platform_fee','debit',v_order.seller_fee_paise,'Seller fee reversed',v_group,'refund_seller_fee',p_refund_ref,'refund:'||p_order_id||':seller_fee',0,0),
    (p_order_id,null,'gst_payable','debit',v_order.buyer_fee_gst_paise,'Buyer GST reversed',v_group,'refund_buyer_gst',p_refund_ref,'refund:'||p_order_id||':buyer_gst',0,0),
    (p_order_id,null,'gst_payable','debit',v_order.seller_fee_gst_paise,'Seller GST reversed',v_group,'refund_seller_gst',p_refund_ref,'refund:'||p_order_id||':seller_gst',0,0),
    (p_order_id,v_order.buyer_id,'provider_settlement','credit',v_order.total_paise,'Provider refund to buyer',v_group,'refund_provider',p_refund_ref,'refund:'||p_order_id||':provider',0,0);
  if v_order.tcs_paise > 0 then
    insert into public.ledger_entries(order_id,user_id,account,direction,amount_paise,memo,transaction_group,entry_type,provider_ref,idempotency_key,tcs_paise) values
      (p_order_id,null,'tcs_payable','debit',v_order.tcs_paise,'TCS placeholder reversed',v_group,'refund_tcs',p_refund_ref,'refund:'||p_order_id||':tcs',v_order.tcs_paise);
  end if;
  if v_order.tds_paise > 0 then
    insert into public.ledger_entries(order_id,user_id,account,direction,amount_paise,memo,transaction_group,entry_type,provider_ref,idempotency_key,tds_paise) values
      (p_order_id,null,'tds_payable','debit',v_order.tds_paise,'TDS placeholder reversed',v_group,'refund_tds',p_refund_ref,'refund:'||p_order_id||':tds',v_order.tds_paise);
  end if;
  insert into public.payment_operations(order_id,operation,provider,status,provider_ref,updated_at)
    values (p_order_id,'refund',v_order.payment_provider,'succeeded',p_refund_ref,now())
    on conflict (order_id,operation) do update set status = 'succeeded', provider_ref = excluded.provider_ref, error = null, updated_at = now();
  return v_order;
end;
$$;
revoke all on function public.record_order_refund(uuid,text,uuid,text) from public, anon, authenticated;
grant execute on function public.record_order_refund(uuid,text,uuid,text) to service_role;

create or replace function public.claim_payment_operation(p_order_id uuid, p_operation text, p_provider text) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  insert into public.payment_operations(order_id,operation,provider) values (p_order_id,p_operation,p_provider)
    on conflict (order_id,operation) do nothing returning id into v_id;
  if v_id is not null then return true; end if;
  update public.payment_operations po set status = 'processing', error = null, updated_at = now()
    where po.order_id = p_order_id and po.operation = p_operation and po.status = 'failed' returning id into v_id;
  return v_id is not null;
end;
$$;
revoke all on function public.claim_payment_operation(uuid,text,text) from public, anon, authenticated;
grant execute on function public.claim_payment_operation(uuid,text,text) to service_role;

create or replace function public.fail_payment_operation(p_order_id uuid, p_operation text, p_error text) returns void
language sql security definer set search_path = public as $$
  update public.payment_operations po set status = 'failed', error = left(p_error,1000), updated_at = now()
    where po.order_id = p_order_id and po.operation = p_operation and po.status = 'processing';
$$;
revoke all on function public.fail_payment_operation(uuid,text,text) from public, anon, authenticated;
grant execute on function public.fail_payment_operation(uuid,text,text) to service_role;

create or replace function public.claim_payout(p_payout_id uuid) returns public.payouts
language plpgsql security definer set search_path = public as $$
declare v_payout public.payouts%rowtype; v_order public.orders%rowtype;
begin
  select p into v_payout from public.payouts p
    join public.orders o on o.id = p.order_id
    join public.listings l on l.id = o.listing_id
    join public.events e on e.id = l.event_id
    where p.id = p_payout_id and p.status in ('scheduled','on_hold')
      and o.status in ('paid','ticket_delivered','completed')
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

create or replace function public.complete_payout(p_payout_id uuid, p_provider_ref text) returns public.payouts
language plpgsql security definer set search_path = public as $$
declare v_payout public.payouts%rowtype; v_order public.orders%rowtype; v_group uuid := gen_random_uuid();
begin
  select * into v_payout from public.payouts p where p.id = p_payout_id for update;
  if not found then raise exception 'PAYOUT_NOT_FOUND'; end if;
  if v_payout.status = 'paid' then return v_payout; end if;
  if v_payout.status <> 'processing' then raise exception 'PAYOUT_NOT_PROCESSING'; end if;
  update public.payouts p set status = 'paid', provider_ref = p_provider_ref, released_at = now(), updated_at = now()
    where p.id = p_payout_id returning * into v_payout;
  update public.orders o set payout_released_at = now(), updated_at = now() where o.id = v_payout.order_id returning * into v_order;
  insert into public.order_events(order_id,actor_id,from_status,to_status,note,metadata)
    values (v_order.id,null,v_order.status,v_order.status,'Seller payout released by payment provider',jsonb_build_object('payout_ref',p_provider_ref));
  insert into public.ledger_entries(order_id,user_id,account,direction,amount_paise,memo,transaction_group,entry_type,provider_ref,idempotency_key) values
    (v_order.id,v_order.seller_id,'seller','debit',v_payout.amount_paise,'Seller payable released',v_group,'payout_seller',p_provider_ref,'payout:'||v_payout.id||':seller'),
    (v_order.id,v_order.seller_id,'provider_settlement','credit',v_payout.amount_paise,'Provider transfer released to seller',v_group,'payout_provider',p_provider_ref,'payout:'||v_payout.id||':provider');
  update public.payment_operations po set status = 'succeeded', provider_ref = p_provider_ref, error = null, updated_at = now()
    where po.order_id = v_order.id and po.operation = 'payout';
  return v_payout;
end;
$$;
revoke all on function public.complete_payout(uuid,text) from public, anon, authenticated;
grant execute on function public.complete_payout(uuid,text) to service_role;

create or replace function public.fail_payout(p_payout_id uuid, p_error text) returns void
language plpgsql security definer set search_path = public as $$
declare v_order_id uuid;
begin
  update public.payouts p set status = 'on_hold', failure_reason = left(p_error,1000), updated_at = now()
    where p.id = p_payout_id and p.status = 'processing' returning order_id into v_order_id;
  if v_order_id is not null then
    update public.payment_operations po set status = 'failed', error = left(p_error,1000), updated_at = now()
      where po.order_id = v_order_id and po.operation = 'payout' and po.status = 'processing';
  end if;
end;
$$;
revoke all on function public.fail_payout(uuid,text) from public, anon, authenticated;
grant execute on function public.fail_payout(uuid,text) to service_role;

create or replace function public.begin_webhook(p_provider text, p_event_id text, p_order_id uuid, p_payload_hash text) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_id text;
begin
  insert into public.payment_webhook_events(provider,event_id,order_id,payload_hash) values (p_provider,p_event_id,p_order_id,p_payload_hash)
    on conflict (provider,event_id) do nothing returning event_id into v_id;
  if v_id is not null then return true; end if;
  update public.payment_webhook_events w set status = 'received', error = null, received_at = now()
    where w.provider = p_provider and w.event_id = p_event_id and w.status = 'failed' returning event_id into v_id;
  return v_id is not null;
end;
$$;
revoke all on function public.begin_webhook(text,text,uuid,text) from public, anon, authenticated;
grant execute on function public.begin_webhook(text,text,uuid,text) to service_role;

create or replace function public.finish_webhook(p_provider text, p_event_id text, p_error text default null) returns void
language sql security definer set search_path = public as $$
  update public.payment_webhook_events w set status = case when p_error is null then 'processed' else 'failed' end,
    error = left(p_error,1000), processed_at = case when p_error is null then now() else null end
    where w.provider = p_provider and w.event_id = p_event_id;
$$;
revoke all on function public.finish_webhook(text,text,text) from public, anon, authenticated;
grant execute on function public.finish_webhook(text,text,text) to service_role;