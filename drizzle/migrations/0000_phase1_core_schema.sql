
create type public.app_role as enum ('buyer','seller','admin');
create type public.listing_status as enum ('draft','active','held','sold','cancelled','expired');
create type public.order_status as enum ('pending','paid','delivered','completed','refunded','cancelled','disputed');
create type public.event_category as enum ('movie','sports','concert','other');

-- profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  state_code text,
  preferred_lang text not null default 'en' check (preferred_lang in ('en','hi','mr')),
  payout_upi_id text,
  payout_bank_account text,
  payout_bank_ifsc text,
  payout_account_holder text,
  profile_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "own profile read" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "own profile update" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- roles
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;
create policy "own roles read" on public.user_roles for select to authenticated using (auth.uid() = user_id or public.has_role(auth.uid(),'admin'));
create policy "admin read profiles" on public.profiles for select to authenticated using (public.has_role(auth.uid(),'admin'));

-- seller readiness: verified phone + payout method
create or replace function public.is_seller_ready(_user_id uuid)
returns boolean language sql stable security definer set search_path = public, auth as $$
  select exists (
    select 1 from auth.users u join public.profiles p on p.id = u.id
    where u.id = _user_id
      and u.phone_confirmed_at is not null
      and (coalesce(p.payout_upi_id,'') <> '' or (coalesce(p.payout_bank_account,'') <> '' and coalesce(p.payout_bank_ifsc,'') <> ''))
  )
$$;

create or replace function public.become_seller()
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if not public.is_seller_ready(auth.uid()) then raise exception 'verify phone and add payout details first'; end if;
  insert into public.user_roles(user_id, role) values (auth.uid(),'seller') on conflict do nothing;
  return true;
end $$;
revoke execute on function public.become_seller() from anon;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, full_name, avatar_url)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'), new.raw_user_meta_data->>'avatar_url')
  on conflict do nothing;
  insert into public.user_roles(user_id, role) values (new.id,'buyer') on conflict do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.touch_updated_at() returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end $$;
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();

-- venues & events (public read, admin write)
create table public.venues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text not null,
  state_code text not null,
  address text,
  created_at timestamptz not null default now()
);
create index venues_state_idx on public.venues(state_code);
grant select on public.venues to anon, authenticated;
grant insert, update, delete on public.venues to authenticated;
grant all on public.venues to service_role;
alter table public.venues enable row level security;
create policy "venues public read" on public.venues for select to anon, authenticated using (true);
create policy "venues admin write" on public.venues for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category public.event_category not null,
  venue_id uuid not null references public.venues(id) on delete restrict,
  organizer text,
  starts_at timestamptz not null,
  image_url text,
  is_resellable boolean not null default true,
  created_at timestamptz not null default now()
);
create index events_starts_idx on public.events(starts_at);
create index events_venue_idx on public.events(venue_id);
create index events_title_idx on public.events using gin (to_tsvector('simple', title));
grant select on public.events to anon, authenticated;
grant insert, update, delete on public.events to authenticated;
grant all on public.events to service_role;
alter table public.events enable row level security;
create policy "events public read" on public.events for select to anon, authenticated using (true);
create policy "events admin write" on public.events for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- fee config (versioned)
create table public.fee_config (
  id uuid primary key default gen_random_uuid(),
  buyer_fee_bps integer not null check (buyer_fee_bps between 0 and 5000),
  seller_fee_bps integer not null check (seller_fee_bps between 0 and 5000),
  gst_bps integer not null check (gst_bps between 0 and 5000),
  effective_from timestamptz not null default now(),
  created_by uuid,
  created_at timestamptz not null default now()
);
create index fee_config_eff_idx on public.fee_config(effective_from desc);
grant select on public.fee_config to anon, authenticated;
grant insert on public.fee_config to authenticated;
grant all on public.fee_config to service_role;
alter table public.fee_config enable row level security;
create policy "fees public read" on public.fee_config for select to anon, authenticated using (true);
create policy "fees admin insert" on public.fee_config for insert to authenticated with check (public.has_role(auth.uid(),'admin'));
insert into public.fee_config(buyer_fee_bps, seller_fee_bps, gst_bps) values (500, 500, 1800);

-- resale rules
create table public.resale_rules (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('global','state','event')),
  state_code text,
  event_id uuid references public.events(id) on delete cascade,
  resale_allowed boolean not null default true,
  max_price_bps_of_face integer not null default 10000 check (max_price_bps_of_face >= 0),
  priority integer not null default 0,
  note text,
  created_at timestamptz not null default now(),
  check ((scope='global' and state_code is null and event_id is null)
      or (scope='state' and state_code is not null and event_id is null)
      or (scope='event' and event_id is not null))
);
create index resale_rules_state_idx on public.resale_rules(state_code);
create index resale_rules_event_idx on public.resale_rules(event_id);
grant select on public.resale_rules to anon, authenticated;
grant insert, update, delete on public.resale_rules to authenticated;
grant all on public.resale_rules to service_role;
alter table public.resale_rules enable row level security;
create policy "rules public read" on public.resale_rules for select to anon, authenticated using (true);
create policy "rules admin write" on public.resale_rules for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
insert into public.resale_rules(scope, resale_allowed, max_price_bps_of_face, note) values ('global', true, 10000, 'Default face-value cap');

-- listings
create table public.listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete restrict,
  section text,
  seat_info text,
  quantity integer not null default 1 check (quantity between 1 and 10),
  face_value_paise bigint not null check (face_value_paise > 0),
  price_paise bigint not null check (price_paise > 0),
  status public.listing_status not null default 'draft',
  held_until timestamptz,
  ticket_proof_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index listings_event_status_idx on public.listings(event_id, status);
create index listings_seller_idx on public.listings(seller_id);
grant select on public.listings to anon, authenticated;
grant insert, update on public.listings to authenticated;
grant all on public.listings to service_role;
alter table public.listings enable row level security;
create policy "active listings public" on public.listings for select to anon, authenticated using (status = 'active');
create policy "seller reads own" on public.listings for select to authenticated using (auth.uid() = seller_id or public.has_role(auth.uid(),'admin'));
create policy "ready seller inserts" on public.listings for insert to authenticated
  with check (auth.uid() = seller_id and status = 'draft' and public.has_role(auth.uid(),'seller') and public.is_seller_ready(auth.uid())
    and exists (select 1 from public.events e where e.id = event_id and e.is_resellable));
create policy "seller updates own draft" on public.listings for update to authenticated
  using (auth.uid() = seller_id and status in ('draft','active')) with check (auth.uid() = seller_id and status in ('draft','cancelled'));
create trigger listings_touch before update on public.listings for each row execute function public.touch_updated_at();

-- orders (written by server only)
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete restrict,
  buyer_id uuid references public.profiles(id) on delete set null,
  seller_id uuid references public.profiles(id) on delete set null,
  quantity integer not null check (quantity > 0),
  price_paise bigint not null,
  buyer_fee_paise bigint not null,
  buyer_fee_gst_paise bigint not null,
  seller_fee_paise bigint not null,
  seller_fee_gst_paise bigint not null,
  total_paise bigint not null,
  seller_net_paise bigint not null,
  fee_config_id uuid references public.fee_config(id),
  status public.order_status not null default 'pending',
  idempotency_key text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index orders_buyer_idx on public.orders(buyer_id);
create index orders_seller_idx on public.orders(seller_id);
create index orders_listing_idx on public.orders(listing_id);
grant select on public.orders to authenticated;
grant all on public.orders to service_role;
alter table public.orders enable row level security;
create policy "parties read orders" on public.orders for select to authenticated using (auth.uid() in (buyer_id, seller_id) or public.has_role(auth.uid(),'admin'));
create trigger orders_touch before update on public.orders for each row execute function public.touch_updated_at();

-- ledger (append-only, server only)
create table public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete restrict,
  user_id uuid references public.profiles(id) on delete set null,
  account text not null check (account in ('buyer','seller','platform_fee','gst_payable','escrow','refund')),
  direction text not null check (direction in ('debit','credit')),
  amount_paise bigint not null check (amount_paise >= 0),
  memo text,
  created_at timestamptz not null default now()
);
create index ledger_order_idx on public.ledger_entries(order_id);
create index ledger_user_idx on public.ledger_entries(user_id);
grant select on public.ledger_entries to authenticated;
grant all on public.ledger_entries to service_role;
alter table public.ledger_entries enable row level security;
create policy "own ledger read" on public.ledger_entries for select to authenticated using (auth.uid() = user_id or public.has_role(auth.uid(),'admin'));

-- payouts
create table public.payouts (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid references public.profiles(id) on delete set null,
  order_id uuid references public.orders(id) on delete restrict,
  amount_paise bigint not null check (amount_paise >= 0),
  status text not null default 'scheduled' check (status in ('scheduled','processing','paid','failed','on_hold')),
  scheduled_for timestamptz,
  provider_ref text,
  created_at timestamptz not null default now()
);
create index payouts_seller_idx on public.payouts(seller_id);
grant select on public.payouts to authenticated;
grant all on public.payouts to service_role;
alter table public.payouts enable row level security;
create policy "own payouts read" on public.payouts for select to authenticated using (auth.uid() = seller_id or public.has_role(auth.uid(),'admin'));

-- disputes
create table public.disputes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  raised_by uuid references public.profiles(id) on delete set null,
  reason text not null check (char_length(reason) between 5 and 2000),
  evidence_paths text[] not null default '{}',
  status text not null default 'open' check (status in ('open','reviewing','resolved_refund','resolved_rejected')),
  resolution_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index disputes_order_idx on public.disputes(order_id);
grant select, insert on public.disputes to authenticated;
grant all on public.disputes to service_role;
alter table public.disputes enable row level security;
create policy "parties read disputes" on public.disputes for select to authenticated
  using (auth.uid() = raised_by or public.has_role(auth.uid(),'admin')
    or exists (select 1 from public.orders o where o.id = order_id and auth.uid() = o.seller_id));
create policy "buyer raises dispute" on public.disputes for insert to authenticated
  with check (auth.uid() = raised_by and status = 'open'
    and exists (select 1 from public.orders o where o.id = order_id and o.buyer_id = auth.uid()));

-- notifications
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null,
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications(user_id, created_at desc);
grant select, update on public.notifications to authenticated;
grant all on public.notifications to service_role;
alter table public.notifications enable row level security;
create policy "own notifications read" on public.notifications for select to authenticated using (auth.uid() = user_id);
create policy "own notifications mark read" on public.notifications for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- audit log (append-only)
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  action text not null,
  entity text not null,
  entity_id text,
  before jsonb,
  after jsonb,
  ip text,
  created_at timestamptz not null default now()
);
create index audit_logs_entity_idx on public.audit_logs(entity, entity_id);
create index audit_logs_created_idx on public.audit_logs(created_at desc);
grant select on public.audit_logs to authenticated;
grant all on public.audit_logs to service_role;
alter table public.audit_logs enable row level security;
create policy "admins read audit" on public.audit_logs for select to authenticated using (public.has_role(auth.uid(),'admin'));

-- consents (append-only records per purpose)
create table public.consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  purpose text not null check (purpose in ('terms','transactions','marketing','analytics','personalisation')),
  granted boolean not null,
  policy_version text not null,
  user_agent text,
  created_at timestamptz not null default now()
);
create index consents_user_idx on public.consents(user_id, purpose, created_at desc);
grant select, insert on public.consents to authenticated;
grant all on public.consents to service_role;
alter table public.consents enable row level security;
create policy "own consents read" on public.consents for select to authenticated using (auth.uid() = user_id);
create policy "own consents insert" on public.consents for insert to authenticated with check (auth.uid() = user_id);
