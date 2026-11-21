alter table public.profiles add column if not exists is_banned boolean not null default false;
alter table public.profiles add column if not exists is_verified boolean not null default false;
alter table public.listings add column if not exists auto_hidden boolean not null default false;
alter table public.listings add column if not exists report_count integer not null default 0;
alter table public.disputes add column if not exists category text not null default 'invalid_ticket';
alter table public.disputes add column if not exists seller_response text;
alter table public.disputes add column if not exists seller_responded_at timestamptz;
alter table public.disputes add column if not exists evidence_deadline_at timestamptz;
alter table public.disputes add column if not exists response_due_at timestamptz;
alter table public.disputes add column if not exists decided_by uuid references public.profiles(id) on delete set null;
alter table public.disputes add column if not exists decided_at timestamptz;
alter table public.disputes add column if not exists prior_order_status text;
alter table public.disputes drop constraint if exists disputes_status_check;
alter table public.disputes add constraint disputes_status_check check (status in ('open','reviewing','resolved_refund','resolved_payout','resolved_rejected'));
create unique index if not exists disputes_one_live_per_order on public.disputes(order_id) where status in ('open','reviewing');

create table public.listing_reports (
  id uuid primary key default gen_random_uuid(), listing_id uuid not null references public.listings(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade, reason text not null,
  details text check (details is null or char_length(details) <= 2000), status text not null default 'pending' check (status in ('pending','accepted','rejected')),
  reviewed_by uuid references public.profiles(id) on delete set null, reviewed_at timestamptz, created_at timestamptz not null default now(),
  unique(listing_id, reporter_id)
);
grant select, insert on public.listing_reports to authenticated; grant all on public.listing_reports to service_role;
alter table public.listing_reports enable row level security;
create policy "report listing" on public.listing_reports for insert to authenticated with check (auth.uid() = reporter_id and exists (select 1 from public.listings l where l.id = listing_id and l.status = 'active' and l.seller_id <> auth.uid()));
create policy "read own or admin reports" on public.listing_reports for select to authenticated using (auth.uid() = reporter_id or public.has_role(auth.uid(),'admin'));

create table public.event_follows (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade, max_price_paise bigint check (max_price_paise is null or max_price_paise >= 0),
  created_at timestamptz not null default now(), unique(user_id,event_id)
);
grant select, insert, delete on public.event_follows to authenticated; grant all on public.event_follows to service_role;
alter table public.event_follows enable row level security;
create policy "own event follows" on public.event_follows for select to authenticated using (auth.uid() = user_id);
create policy "follow event" on public.event_follows for insert to authenticated with check (auth.uid() = user_id);
create policy "unfollow event" on public.event_follows for delete to authenticated using (auth.uid() = user_id);

create table public.waitlist_entries (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade, max_price_paise bigint not null check (max_price_paise >= 0),
  quantity integer not null default 1 check (quantity between 1 and 6), status text not null default 'waiting' check (status in ('waiting','offered','fulfilled','cancelled')),
  created_at timestamptz not null default now(), unique(user_id,event_id)
);
grant select, insert, update on public.waitlist_entries to authenticated; grant all on public.waitlist_entries to service_role;
alter table public.waitlist_entries enable row level security;
create policy "own waitlist read" on public.waitlist_entries for select to authenticated using (auth.uid() = user_id);
create policy "join waitlist" on public.waitlist_entries for insert to authenticated with check (auth.uid() = user_id and status = 'waiting');
create policy "cancel own waitlist" on public.waitlist_entries for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.waitlist_offers (
  id uuid primary key default gen_random_uuid(), listing_id uuid not null unique references public.listings(id) on delete cascade,
  waitlist_id uuid not null references public.waitlist_entries(id) on delete cascade, status text not null default 'offered' check (status in ('offered','accepted','expired','cancelled')),
  expires_at timestamptz not null, created_at timestamptz not null default now()
);
grant select on public.waitlist_offers to authenticated; grant all on public.waitlist_offers to service_role;
alter table public.waitlist_offers enable row level security;
create policy "own offers read" on public.waitlist_offers for select to authenticated using (exists (select 1 from public.waitlist_entries w where w.id = waitlist_id and w.user_id = auth.uid()));

create table public.listing_risk_signals (
  id uuid primary key default gen_random_uuid(), listing_id uuid references public.listings(id) on delete cascade,
  seller_id uuid references public.profiles(id) on delete cascade, kind text not null, details jsonb not null default '{}', created_at timestamptz not null default now()
);
grant select on public.listing_risk_signals to authenticated; grant all on public.listing_risk_signals to service_role;
alter table public.listing_risk_signals enable row level security;
create policy "admins read risk signals" on public.listing_risk_signals for select to authenticated using (public.has_role(auth.uid(),'admin'));

create table public.seller_device_signals (
  id uuid primary key default gen_random_uuid(), seller_id uuid not null references public.profiles(id) on delete cascade,
  device_hash text not null, created_at timestamptz not null default now()
);
grant select on public.seller_device_signals to authenticated; grant all on public.seller_device_signals to service_role;
alter table public.seller_device_signals enable row level security;
create policy "admins read device signals" on public.seller_device_signals for select to authenticated using (public.has_role(auth.uid(),'admin'));

create table public.grievance_tickets (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null, subject text not null check (char_length(subject) between 3 and 160),
  details text not null check (char_length(details) between 10 and 4000), status text not null default 'open' check (status in ('open','in_review','resolved')),
  resolution_note text, due_at timestamptz not null default (now() + interval '72 hours'), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
grant select, insert on public.grievance_tickets to authenticated; grant all on public.grievance_tickets to service_role;
alter table public.grievance_tickets enable row level security;
create policy "own grievances read" on public.grievance_tickets for select to authenticated using (auth.uid() = user_id or public.has_role(auth.uid(),'admin'));
create policy "create own grievance" on public.grievance_tickets for insert to authenticated with check (auth.uid() = user_id and status = 'open');
create trigger grievances_touch before update on public.grievance_tickets for each row execute function public.touch_updated_at();

create table public.feature_flags (
  key text primary key, enabled boolean not null default false, description text not null default '', updated_at timestamptz not null default now()
);
grant select on public.feature_flags to authenticated; grant all on public.feature_flags to service_role;
alter table public.feature_flags enable row level security;
create policy "admins read flags" on public.feature_flags for select to authenticated using (public.has_role(auth.uid(),'admin'));

create or replace function public.enforce_new_seller_listing_limit() returns trigger language plpgsql security definer set search_path = public as $$
declare v_created timestamptz; v_banned boolean;
begin
  select created_at, is_banned into v_created, v_banned from public.profiles where id = new.seller_id;
  if coalesce(v_banned,false) then raise exception 'SELLER_BANNED'; end if;
  if v_created > now() - interval '30 days' and (select count(*) from public.listings l where l.seller_id = new.seller_id and l.created_at >= date_trunc('day',now())) >= 5 then
    raise exception 'NEW_SELLER_DAILY_LIMIT';
  end if;
  return new;
end; $$;
create trigger listings_new_seller_limit before insert on public.listings for each row execute function public.enforce_new_seller_listing_limit();

create or replace function public.flag_listing_risk() returns trigger language plpgsql security definer set search_path = public as $$
declare v_count integer; v_avg numeric;
begin
  select count(*) into v_count from public.listings where seller_id = new.seller_id and event_id = new.event_id and status <> 'cancelled';
  if v_count >= 5 then insert into public.listing_risk_signals(listing_id,seller_id,kind,details) values(new.id,new.seller_id,'event_concentration',jsonb_build_object('count',v_count)); end if;
  select avg(price_paise) into v_avg from public.listings where event_id = new.event_id and id <> new.id and status in ('active','held','sold');
  if v_avg is not null and (new.price_paise < v_avg * 0.5 or new.price_paise > v_avg * 1.5) then
    insert into public.listing_risk_signals(listing_id,seller_id,kind,details) values(new.id,new.seller_id,'price_anomaly',jsonb_build_object('average_paise',round(v_avg),'price_paise',new.price_paise));
  end if;
  return new;
end; $$;
create trigger listings_risk_scan after insert on public.listings for each row execute function public.flag_listing_risk();

create or replace function public.process_listing_report() returns trigger language plpgsql security definer set search_path = public as $$
declare v_count integer; v_seller uuid;
begin
  select count(*), max(l.seller_id) into v_count, v_seller from public.listing_reports r join public.listings l on l.id = r.listing_id where r.listing_id = new.listing_id;
  update public.listings set report_count = v_count,
    status = case when v_count >= 3 and status = 'active' then 'draft' else status end,
    is_paused = case when v_count >= 3 then true else is_paused end,
    auto_hidden = case when v_count >= 3 then true else auto_hidden end where id = new.listing_id;
  if v_count = 3 then insert into public.notifications(user_id,kind,title,body,link) values(v_seller,'takedown','Listing hidden after multiple reports','Our trust team will review the reports.','/my-listings'); end if;
  return new;
end; $$;
create trigger listing_reports_hide after insert on public.listing_reports for each row execute function public.process_listing_report();

create or replace function public.validate_dispute_window() returns trigger language plpgsql security definer set search_path = public as $$
declare v_start timestamptz; v_buyer uuid;
begin
  select e.starts_at, o.buyer_id into v_start, v_buyer from public.orders o join public.listings l on l.id = o.listing_id join public.events e on e.id = l.event_id where o.id = new.order_id;
  if v_buyer <> new.raised_by or v_start is null or now() > v_start + interval '48 hours' then raise exception 'DISPUTE_WINDOW_CLOSED'; end if;
  new.evidence_deadline_at := coalesce(new.evidence_deadline_at, new.created_at + interval '48 hours');
  new.response_due_at := coalesce(new.response_due_at, new.created_at + interval '48 hours');
  return new;
end; $$;
create trigger disputes_window before insert on public.disputes for each row execute function public.validate_dispute_window();

create or replace function public.seller_reputation(_seller_id uuid) returns table(average_rating numeric,rating_count integer,completed_sales integer,dispute_count integer,dispute_rate numeric,is_verified boolean)
language sql stable security definer set search_path = public as $$
  select (select round(avg(r.rating)::numeric,2) from public.seller_reviews r where r.seller_id = _seller_id),
    (select count(*)::integer from public.seller_reviews r where r.seller_id = _seller_id),
    (select count(*)::integer from public.orders o where o.seller_id = _seller_id and o.status = 'completed'),
    (select count(*)::integer from public.disputes d join public.orders o on o.id = d.order_id where o.seller_id = _seller_id),
    case when (select count(*) from public.orders o where o.seller_id = _seller_id and o.status in ('completed','disputed','refunded')) = 0 then 0
      else round((select count(*)::numeric from public.disputes d join public.orders o on o.id = d.order_id where o.seller_id = _seller_id) * 100 / (select count(*) from public.orders o where o.seller_id = _seller_id and o.status in ('completed','disputed','refunded')),2) end,
    coalesce((select p.is_verified from public.profiles p where p.id = _seller_id),false);
$$;
grant execute on function public.seller_reputation(uuid) to anon, authenticated, service_role;

create or replace function public.notify_listing_available(p_listing_id uuid) returns void language plpgsql security definer set search_path = public as $$
declare v_listing public.listings%rowtype; v_wait public.waitlist_entries%rowtype;
begin
  select * into v_listing from public.listings where id = p_listing_id and status = 'active';
  if not found then return; end if;
  insert into public.notifications(user_id,kind,title,body,link)
    select f.user_id,'price_alert','A matching ticket is available','A new listing matches your event alert.','/listings/' || v_listing.id
    from public.event_follows f where f.event_id = v_listing.event_id and (f.max_price_paise is null or f.max_price_paise >= v_listing.price_paise);
  select * into v_wait from public.waitlist_entries w where w.event_id = v_listing.event_id and w.status = 'waiting' and w.max_price_paise >= v_listing.price_paise and w.quantity <= v_listing.quantity order by w.created_at for update skip locked limit 1;
  if found then
    insert into public.waitlist_offers(listing_id,waitlist_id,expires_at) values(v_listing.id,v_wait.id,now() + interval '15 minutes');
    update public.waitlist_entries set status = 'offered' where id = v_wait.id;
    insert into public.notifications(user_id,kind,title,body,link) values(v_wait.user_id,'waitlist_offer','Your waitlist offer is ready','You have 15 minutes to view this matching listing.','/listings/' || v_listing.id);
  end if;
end; $$;
revoke all on function public.notify_listing_available(uuid) from public,anon,authenticated; grant execute on function public.notify_listing_available(uuid) to service_role;

create or replace function public.notify_order_sale() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status in ('paid','ticket_delivered') and old.status not in ('paid','ticket_delivered','completed') and new.seller_id is not null then
    insert into public.notifications(user_id,kind,title,body,link) values(new.seller_id,'ticket_sold','Your ticket sold','The buyer payment is confirmed.','/orders/' || new.id);
  end if; return new;
end; $$;
create trigger orders_sale_notification after update of status on public.orders for each row execute function public.notify_order_sale();
create or replace function public.notify_payout_released() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'paid' and old.status <> 'paid' and new.seller_id is not null then
    insert into public.notifications(user_id,kind,title,body,link) values(new.seller_id,'payout_released','Your payout was released','Your seller proceeds are now released by the payment provider.','/seller/earnings');
  end if; return new;
end; $$;
create trigger payouts_release_notification after update of status on public.payouts for each row execute function public.notify_payout_released();

create or replace function public.notify_dispute_changes() returns trigger language plpgsql security definer set search_path = public as $$
declare v_order public.orders%rowtype;
begin
  select * into v_order from public.orders where id = new.order_id;
  if tg_op = 'INSERT' and v_order.seller_id is not null then
    insert into public.notifications(user_id,kind,title,body,link) values(v_order.seller_id,'dispute_update','A buyer opened a dispute','Please respond with your side within 48 hours.','/orders/' || new.order_id);
  elsif tg_op = 'UPDATE' and new.seller_response is distinct from old.seller_response and v_order.buyer_id is not null then
    insert into public.notifications(user_id,kind,title,body,link) values(v_order.buyer_id,'dispute_update','The seller responded','Open your order to review the dispute update.','/orders/' || new.order_id);
  end if;
  if tg_op = 'UPDATE' and new.status <> old.status and new.status like 'resolved_%' then
    insert into public.notifications(user_id,kind,title,body,link)
      select u,'dispute_update','Your dispute was decided',coalesce(new.resolution_note,'Open the order for the decision.'),'/orders/' || new.order_id from unnest(array[v_order.buyer_id,v_order.seller_id]) u where u is not null;
  end if;
  return coalesce(new,old);
end; $$;
create trigger disputes_notifications after insert or update on public.disputes for each row execute function public.notify_dispute_changes();