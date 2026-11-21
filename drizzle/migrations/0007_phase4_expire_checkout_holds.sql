-- lovable-cron-fallback-reviewed: exact ten-minute release is required; event-driven release remains in place, and this once-per-minute reconciliation covers abandoned sessions with at most one minute of additional delay.
create or replace function public.release_expired_checkouts() returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  n integer := 0;
begin
  for v_id in
    select o.id from public.orders o
    where o.status = 'payment_pending' and o.hold_expires_at is not null and o.hold_expires_at <= now()
    order by o.hold_expires_at
    limit 100
  loop
    perform public.release_checkout_order(v_id, null, 'Reservation expired');
    n := n + 1;
  end loop;
  return n;
end;
$$;
revoke all on function public.release_expired_checkouts() from public, anon, authenticated;
grant execute on function public.release_expired_checkouts() to service_role;
select cron.schedule('release-expired-checkouts', '* * * * *', $$select public.release_expired_checkouts()$$);