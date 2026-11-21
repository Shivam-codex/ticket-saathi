alter table public.events add column ends_at timestamptz;
comment on column public.events.ends_at is 'Actual scheduled event end. Automatic payout release occurs 24 hours later; null blocks time-based release.';

alter table public.profiles add column razorpay_route_account_id text;
comment on column public.profiles.razorpay_route_account_id is 'Provider-hosted Razorpay Route linked account. Never a custom PassOn funds-holding account.';

alter table public.orders
  add column provider_order_ref text,
  add column tcs_paise bigint not null default 0,
  add column tds_paise bigint not null default 0,
  add column delivery_due_at timestamptz,
  add column entry_confirmed_at timestamptz,
  add column refund_provider_ref text,
  add column refunded_at timestamptz,
  add column payout_released_at timestamptz;
alter table public.orders add constraint orders_phase5_tax_nonnegative check (tcs_paise >= 0 and tds_paise >= 0) not valid;
alter table public.orders validate constraint orders_phase5_tax_nonnegative;
create unique index orders_provider_order_ref_uniq on public.orders(provider_order_ref) where provider_order_ref is not null;
comment on column public.orders.tcs_paise is 'TCS placeholder in integer paise. Rates and applicability must be confirmed by a CA before enabling.';
comment on column public.orders.tds_paise is 'TDS placeholder in integer paise. Rates and applicability must be confirmed by a CA before enabling.';

alter table public.payouts
  add column provider text not null default 'mock',
  add column failure_reason text,
  add column updated_at timestamptz not null default now(),
  add column released_at timestamptz;
create unique index payouts_order_uniq on public.payouts(order_id);
create index payouts_release_idx on public.payouts(status, scheduled_for);

alter table public.ledger_entries drop constraint ledger_entries_account_check;
alter table public.ledger_entries add constraint ledger_entries_account_check check (account in ('buyer','seller','platform_fee','gst_payable','escrow','refund','provider_settlement','tcs_payable','tds_payable','payout'));
alter table public.ledger_entries
  add column transaction_group uuid not null default gen_random_uuid(),
  add column entry_type text not null default 'legacy',
  add column provider_ref text,
  add column idempotency_key text,
  add column tcs_paise bigint not null default 0,
  add column tds_paise bigint not null default 0,
  add column metadata jsonb not null default '{}'::jsonb;
create unique index ledger_entries_idempotency_uniq on public.ledger_entries(idempotency_key) where idempotency_key is not null;
create index ledger_entries_group_idx on public.ledger_entries(transaction_group);
comment on column public.ledger_entries.tcs_paise is 'TCS placeholder in integer paise. Rates and applicability must be confirmed by a CA before enabling.';
comment on column public.ledger_entries.tds_paise is 'TDS placeholder in integer paise. Rates and applicability must be confirmed by a CA before enabling.';

create table public.tax_config (
  id uuid primary key default gen_random_uuid(),
  enabled boolean not null default false,
  tcs_bps integer not null default 0 check (tcs_bps between 0 and 10000),
  tds_bps integer not null default 0 check (tds_bps between 0 and 10000),
  effective_from timestamptz not null default now(),
  created_at timestamptz not null default now()
);
grant select on public.tax_config to authenticated;
grant all on public.tax_config to service_role;
alter table public.tax_config enable row level security;
create policy "authenticated read tax config" on public.tax_config for select to authenticated using (true);
comment on table public.tax_config is 'Disabled by default. TCS/TDS rates and applicability must be confirmed by a CA before enabling.';

create table public.payment_webhook_events (
  provider text not null,
  event_id text not null,
  order_id uuid references public.orders(id) on delete restrict,
  payload_hash text not null,
  status text not null default 'received' check (status in ('received','processed','failed')),
  error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  primary key (provider, event_id)
);
grant all on public.payment_webhook_events to service_role;
alter table public.payment_webhook_events enable row level security;

create table public.payment_operations (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  operation text not null check (operation in ('refund','payout')),
  provider text not null,
  status text not null default 'processing' check (status in ('processing','succeeded','failed')),
  provider_ref text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_id, operation)
);
grant all on public.payment_operations to service_role;
alter table public.payment_operations enable row level security;
create index payment_operations_status_idx on public.payment_operations(status, updated_at);