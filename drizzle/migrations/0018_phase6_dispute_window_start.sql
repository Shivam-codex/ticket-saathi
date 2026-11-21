create or replace function public.validate_dispute_window() returns trigger language plpgsql security definer set search_path = public as $$
declare v_start timestamptz; v_buyer uuid;
begin
  select e.starts_at, o.buyer_id into v_start, v_buyer from public.orders o join public.listings l on l.id = o.listing_id join public.events e on e.id = l.event_id where o.id = new.order_id;
  if v_buyer <> new.raised_by or v_start is null or now() < v_start or now() > v_start + interval '48 hours' then raise exception 'DISPUTE_WINDOW_CLOSED'; end if;
  new.evidence_deadline_at := coalesce(new.evidence_deadline_at, new.created_at + interval '48 hours');
  new.response_due_at := coalesce(new.response_due_at, new.created_at + interval '48 hours');
  return new;
end; $$;

revoke all on function public.validate_dispute_window() from public;
revoke all on function public.validate_dispute_window() from anon, authenticated;
grant execute on function public.validate_dispute_window() to service_role;
