alter table public.listings
  add column verification_status text not null default 'pending' check (verification_status in ('pending','approved','review','rejected')),
  add column trust_score integer check (trust_score between 0 and 100),
  add column is_paused boolean not null default false,
  add column block_reason text;
comment on column public.listings.ticket_proof_path is 'DEPRECATED: replaced by listing_secrets.file_path';

create table public.listing_secrets (
  listing_id uuid primary key references public.listings(id) on delete cascade,
  seller_id uuid not null references public.profiles(id) on delete cascade,
  file_path text not null,
  file_mime text not null,
  file_sha256 text,
  qr_hash text,
  qr_source text,
  extracted jsonb not null default '{}'::jsonb,
  checks jsonb not null default '{}'::jsonb,
  listing_status_mirror public.listing_status not null default 'draft',
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.listing_secrets to authenticated;
grant all on public.listing_secrets to service_role;
alter table public.listing_secrets enable row level security;
create policy "secrets seller or admin read" on public.listing_secrets for select to authenticated
  using (auth.uid() = seller_id or public.has_role(auth.uid(),'admin'));

create unique index listing_secrets_qr_live_uniq on public.listing_secrets(qr_hash)
  where qr_hash is not null and listing_status_mirror in ('draft','active','held','sold');
create index listing_secrets_file_sha_idx on public.listing_secrets(file_sha256);

create or replace function public.mirror_listing_status() returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.listing_secrets set listing_status_mirror = new.status, updated_at = now() where listing_id = new.id;
  return new;
end $$;
create trigger listings_mirror_status after update of status on public.listings
  for each row when (old.status is distinct from new.status) execute function public.mirror_listing_status();

create index listings_verification_idx on public.listings(verification_status) where verification_status = 'review';
create index if not exists listings_event_created_idx on public.listings(event_id, created_at desc);

drop policy if exists "seller updates own draft" on public.listings;

drop policy if exists "active listings public" on public.listings;
create policy "active listings public" on public.listings for select to anon, authenticated
  using (status = 'active' and exists (select 1 from public.events e where e.id = listings.event_id and e.starts_at > now()));

create or replace view public.event_cards with (security_invoker = true) as
select e.id, e.title, e.category, e.starts_at, e.image_url, e.organizer, e.is_resellable,
       e.min_face_value_paise, e.resale_max_percent,
       v.id as venue_id, v.name as venue_name, v.city, v.state_code,
       coalesce(s.active_count, 0)::int as active_listings,
       s.min_price_paise,
       coalesce(s.min_price_paise, e.min_face_value_paise) as from_price_paise
from public.events e
join public.venues v on v.id = e.venue_id
left join lateral (
  select count(*) as active_count, min(l.price_paise) as min_price_paise
  from public.listings l where l.event_id = e.id and l.status = 'active' and e.starts_at > now()
) s on true;

create or replace function public.expire_started_listings() returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  update public.listings l set status = 'expired', updated_at = now()
  from public.events e
  where e.id = l.event_id and e.starts_at <= now() and l.status in ('draft','active');
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.expire_started_listings() from public, anon, authenticated;

create extension if not exists pg_cron;
select cron.schedule('expire-started-listings', '0 * * * *', $$select public.expire_started_listings()$$);

create policy "proofs seller upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'ticket-proofs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "proofs seller or admin read" on storage.objects for select to authenticated
  using (bucket_id = 'ticket-proofs' and ((storage.foldername(name))[1] = auth.uid()::text or public.has_role(auth.uid(),'admin')));