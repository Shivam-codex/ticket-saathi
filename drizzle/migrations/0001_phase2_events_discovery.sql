
alter table public.events
  add column face_value_tiers jsonb not null default '[]'::jsonb,
  add column resale_max_percent integer check (resale_max_percent is null or resale_max_percent between 0 and 500),
  add column min_face_value_paise bigint,
  add column description text,
  add column updated_at timestamptz not null default now();

create or replace function public.events_derive() returns trigger language plpgsql set search_path = public as $$
begin
  select min((t->>'price_paise')::bigint) into new.min_face_value_paise
  from jsonb_array_elements(coalesce(new.face_value_tiers,'[]'::jsonb)) t;
  new.updated_at = now();
  return new;
end $$;
create trigger events_derive before insert or update on public.events for each row execute function public.events_derive();
create index events_category_idx on public.events(category);

create view public.event_cards with (security_invoker = true) as
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
  from public.listings l where l.event_id = e.id and l.status = 'active'
) s on true;
grant select on public.event_cards to anon, authenticated;

create index venues_city_idx on public.venues(city);
alter publication supabase_realtime add table public.listings;

-- banner storage policies (bucket created separately)
create policy "banners public read" on storage.objects for select to anon, authenticated using (bucket_id = 'event-banners');
create policy "banners admin write" on storage.objects for insert to authenticated with check (bucket_id = 'event-banners' and public.has_role(auth.uid(),'admin'));
create policy "banners admin update" on storage.objects for update to authenticated using (bucket_id = 'event-banners' and public.has_role(auth.uid(),'admin'));
create policy "banners admin delete" on storage.objects for delete to authenticated using (bucket_id = 'event-banners' and public.has_role(auth.uid(),'admin'));

-- seed
insert into public.venues (id, name, city, state_code, address) values
 ('a0000000-0000-0000-0000-000000000001','MCA Stadium','Pune','MH','Gahunje, Pune'),
 ('a0000000-0000-0000-0000-000000000002','PVR Phoenix Marketcity','Pune','MH','Viman Nagar, Pune'),
 ('a0000000-0000-0000-0000-000000000003','Wankhede Stadium','Mumbai','MH','Churchgate, Mumbai'),
 ('a0000000-0000-0000-0000-000000000004','NSCI Dome','Mumbai','MH','Worli, Mumbai'),
 ('a0000000-0000-0000-0000-000000000005','Arun Jaitley Stadium','Delhi','DL','Delhi Gate, New Delhi'),
 ('a0000000-0000-0000-0000-000000000006','Jawaharlal Nehru Stadium','Delhi','DL','Lodhi Road, New Delhi'),
 ('a0000000-0000-0000-0000-000000000007','M. Chinnaswamy Stadium','Bengaluru','KA','MG Road, Bengaluru'),
 ('a0000000-0000-0000-0000-000000000008','Phoenix Marketcity INOX','Bengaluru','KA','Whitefield, Bengaluru');

insert into public.events (title, category, venue_id, organizer, starts_at, image_url, is_resellable, face_value_tiers, description) values
 ('IPL: Pune Warriors vs Mumbai Indians','sports','a0000000-0000-0000-0000-000000000001','BCCI / IPL', date_trunc('day', now()) + interval '2 days 19 hours 30 minutes','https://images.unsplash.com/photo-1531415074968-036ba1b575da',true,'[{"name":"East Stand","price_paise":120000},{"name":"North Pavilion","price_paise":250000},{"name":"Hospitality","price_paise":800000}]','Floodlit T20 clash at Gahunje.'),
 ('Ranji Trophy: Maharashtra vs Karnataka','sports','a0000000-0000-0000-0000-000000000001','MCA', date_trunc('day', now()) + interval '9 days 9 hours 30 minutes','https://images.unsplash.com/photo-1540747913346-19e32dc3e97e',true,'[{"name":"General","price_paise":20000},{"name":"Pavilion","price_paise":50000}]','Day 1 of the four-day fixture.'),
 ('Arijit Singh Live in Pune','concert','a0000000-0000-0000-0000-000000000001','Percept Live', date_trunc('day', now()) + interval '6 days 18 hours','https://images.unsplash.com/photo-1540039155733-5bb30b53aa14',true,'[{"name":"Silver","price_paise":199900},{"name":"Gold","price_paise":499900},{"name":"Platinum","price_paise":999900}]','An evening of romantic hits.'),
 ('Pushpa 3 — First Day First Show','movie','a0000000-0000-0000-0000-000000000002','PVR INOX', date_trunc('day', now()) + interval '3 days 9 hours','https://images.unsplash.com/photo-1489599849927-2ee91cede3ba',false,'[{"name":"Classic","price_paise":35000},{"name":"Recliner","price_paise":75000}]','Organizer has disabled ticket transfer for this show.'),
 ('Interstellar IMAX Re-release','movie','a0000000-0000-0000-0000-000000000002','PVR INOX', date_trunc('day', now()) + interval '1 day 21 hours','https://images.unsplash.com/photo-1536440136628-849c177e76a1',true,'[{"name":"IMAX","price_paise":60000}]','Special 70mm IMAX screening.'),
 ('IPL: Mumbai Indians vs Chennai Super Kings','sports','a0000000-0000-0000-0000-000000000003','BCCI / IPL', date_trunc('day', now()) + interval '5 days 19 hours 30 minutes','https://images.unsplash.com/photo-1531415074968-036ba1b575da',true,'[{"name":"Sunil Gavaskar Stand","price_paise":250000},{"name":"Vijay Merchant","price_paise":400000},{"name":"Grand Stand","price_paise":1200000}]','El Clásico of the IPL.'),
 ('India vs Australia — 2nd ODI','sports','a0000000-0000-0000-0000-000000000003','BCCI', date_trunc('day', now()) + interval '12 days 13 hours 30 minutes','https://images.unsplash.com/photo-1540747913346-19e32dc3e97e',true,'[{"name":"Upper Tier","price_paise":150000},{"name":"Lower Tier","price_paise":350000}]','Day-night ODI at Wankhede.'),
 ('Coldplay: Music of the Spheres','concert','a0000000-0000-0000-0000-000000000004','BookMyShow Live', date_trunc('day', now()) + interval '15 days 18 hours 30 minutes','https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3',true,'[{"name":"Stand","price_paise":450000},{"name":"Lounge","price_paise":1250000}]','World tour, India leg.'),
 ('Zakir Khan — Stand-up Special','concert','a0000000-0000-0000-0000-000000000004','OML', date_trunc('day', now()) + interval '4 days 20 hours','https://images.unsplash.com/photo-1501386761578-eac5c94b800a',true,'[{"name":"Regular","price_paise":99900},{"name":"Premium","price_paise":199900}]','New hour of comedy.'),
 ('Pro Kabaddi: U Mumba vs Puneri Paltan','sports','a0000000-0000-0000-0000-000000000004','PKL', date_trunc('day', now()) + interval '7 days 20 hours','https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c',true,'[{"name":"General","price_paise":40000},{"name":"Courtside","price_paise":150000}]','Maharashtra derby.'),
 ('IPL: Delhi Capitals vs Royal Challengers','sports','a0000000-0000-0000-0000-000000000005','BCCI / IPL', date_trunc('day', now()) + interval '8 days 19 hours 30 minutes','https://images.unsplash.com/photo-1531415074968-036ba1b575da',true,'[{"name":"Gautam Gambhir Stand","price_paise":150000},{"name":"Club House","price_paise":600000}]','Evening T20 at Kotla.'),
 ('ISL: Delhi FC vs Mumbai City','sports','a0000000-0000-0000-0000-000000000006','ISL', date_trunc('day', now()) + interval '3 days 19 hours','https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c',true,'[{"name":"North Stand","price_paise":30000},{"name":"West Stand","price_paise":80000}]','Indian Super League fixture.'),
 ('Diljit Dosanjh: Dil-Luminati','concert','a0000000-0000-0000-0000-000000000006','Saregama', date_trunc('day', now()) + interval '10 days 19 hours','https://images.unsplash.com/photo-1459749411175-04bf5292ceea',true,'[{"name":"Silver","price_paise":299900},{"name":"Gold","price_paise":699900},{"name":"Fan Pit","price_paise":1499900}]','Punjabi superstar live.'),
 ('Sunburn Arena ft. Martin Garrix','concert','a0000000-0000-0000-0000-000000000006','Sunburn', date_trunc('day', now()) + interval '20 days 17 hours','https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3',true,'[{"name":"GA","price_paise":250000},{"name":"VIP","price_paise":750000}]','EDM night under the stars.'),
 ('Dune: Part Three — Premiere','movie','a0000000-0000-0000-0000-000000000006','PVR INOX', date_trunc('day', now()) + interval '6 days 21 hours','https://images.unsplash.com/photo-1574267432553-4b4628081c31',true,'[{"name":"Gold Class","price_paise":110000}]','Premiere night screening.'),
 ('IPL: RCB vs Kolkata Knight Riders','sports','a0000000-0000-0000-0000-000000000007','BCCI / IPL', date_trunc('day', now()) + interval '4 days 19 hours 30 minutes','https://images.unsplash.com/photo-1531415074968-036ba1b575da',true,'[{"name":"P Terrace","price_paise":180000},{"name":"Fan Terrace","price_paise":300000},{"name":"Corporate Box","price_paise":1500000}]','Chinnaswamy under lights.'),
 ('Women''s T20: India vs England','sports','a0000000-0000-0000-0000-000000000007','BCCI', date_trunc('day', now()) + interval '11 days 14 hours','https://images.unsplash.com/photo-1540747913346-19e32dc3e97e',true,'[{"name":"General","price_paise":25000},{"name":"Pavilion","price_paise":75000}]','Series decider.'),
 ('Prateek Kuhad — Silhouettes Tour','concert','a0000000-0000-0000-0000-000000000007','Only Much Louder', date_trunc('day', now()) + interval '5 days 19 hours','https://images.unsplash.com/photo-1501386761578-eac5c94b800a',true,'[{"name":"Early Bird","price_paise":149900},{"name":"Regular","price_paise":249900}]','Intimate acoustic set.'),
 ('Kantara: Chapter 2','movie','a0000000-0000-0000-0000-000000000008','PVR INOX', date_trunc('day', now()) + interval '2 days 18 hours','https://images.unsplash.com/photo-1489599849927-2ee91cede3ba',true,'[{"name":"Classic","price_paise":30000},{"name":"Prime","price_paise":55000}]','Evening show.'),
 ('Oppenheimer IMAX Marathon','movie','a0000000-0000-0000-0000-000000000008','PVR INOX', date_trunc('day', now()) + interval '13 days 15 hours','https://images.unsplash.com/photo-1536440136628-849c177e76a1',true,'[{"name":"IMAX","price_paise":70000}]','Back-to-back Nolan.');
