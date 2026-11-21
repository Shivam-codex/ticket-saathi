alter table public.profiles
  add column preferred_payment_method text not null default 'upi' check (preferred_payment_method in ('upi')),
  add column saved_upi_id text;

alter table public.orders
  add column buyer_name text,
  add column buyer_phone text,
  add column buyer_state_code text,
  add column buyer_upi_id text,
  add column payment_method text not null default 'upi',
  add column payment_provider text not null default 'mock',
  add column payment_ref text,
  add column hold_expires_at timestamptz,
  add column paid_at timestamptz,
  add column delivered_at timestamptz,
  add column invoice_number text unique,
  add column invoice_issued_at timestamptz;

create unique index orders_live_listing_uniq on public.orders(listing_id)
  where status in ('pending','payment_pending','paid','ticket_delivered','completed','disputed');
create index orders_hold_expiry_idx on public.orders(hold_expires_at)
  where status = 'payment_pending';

create table public.order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  from_status public.order_status,
  to_status public.order_status not null,
  note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
grant select on public.order_events to authenticated;
grant all on public.order_events to service_role;
alter table public.order_events enable row level security;
create policy "parties read order events" on public.order_events for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and (auth.uid() in (o.buyer_id, o.seller_id) or public.has_role(auth.uid(),'admin'))));
create index order_events_order_idx on public.order_events(order_id, created_at);

create table public.seller_reviews (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete restrict,
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  seller_id uuid not null references public.profiles(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text check (comment is null or char_length(comment) <= 1000),
  created_at timestamptz not null default now()
);
grant select, insert on public.seller_reviews to authenticated;
grant all on public.seller_reviews to service_role;
alter table public.seller_reviews enable row level security;
create policy "parties read seller reviews" on public.seller_reviews for select to authenticated
  using (auth.uid() in (buyer_id, seller_id) or public.has_role(auth.uid(),'admin'));
create policy "buyer reviews completed order" on public.seller_reviews for insert to authenticated
  with check (auth.uid() = buyer_id and exists (
    select 1 from public.orders o where o.id = order_id and o.buyer_id = auth.uid() and o.seller_id = seller_id and o.status in ('ticket_delivered','completed')
  ));
create index seller_reviews_seller_idx on public.seller_reviews(seller_id);

create or replace function public.seller_public_stats(_seller_id uuid)
returns table(average_rating numeric, rating_count integer, completed_sales integer)
language sql stable security definer set search_path = public as $$
  select
    (select round(avg(r.rating), 1) from public.seller_reviews r where r.seller_id = _seller_id),
    (select count(*)::integer from public.seller_reviews r where r.seller_id = _seller_id),
    (select count(*)::integer from public.orders o where o.seller_id = _seller_id and o.status = 'completed');
$$;
revoke all on function public.seller_public_stats(uuid) from public;
grant execute on function public.seller_public_stats(uuid) to anon, authenticated, service_role;