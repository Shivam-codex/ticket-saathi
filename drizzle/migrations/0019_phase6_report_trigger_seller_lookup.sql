create or replace function public.process_listing_report() returns trigger language plpgsql security definer set search_path = public as $$
declare v_count integer; v_seller uuid;
begin
  select count(*) into v_count from public.listing_reports where listing_id = new.listing_id;
  select seller_id into v_seller from public.listings where id = new.listing_id;
  update public.listings set report_count = v_count,
    status = case when v_count >= 3 and status = 'active' then 'draft' else status end,
    is_paused = case when v_count >= 3 then true else is_paused end,
    auto_hidden = case when v_count >= 3 then true else auto_hidden end where id = new.listing_id;
  if v_count = 3 then insert into public.notifications(user_id,kind,title,body,link) values(v_seller,'takedown','Listing hidden after multiple reports','Our trust team will review the reports.','/my-listings'); end if;
  return new;
end; $$;

revoke all on function public.process_listing_report() from public;
revoke all on function public.process_listing_report() from anon, authenticated;
grant execute on function public.process_listing_report() to service_role;
