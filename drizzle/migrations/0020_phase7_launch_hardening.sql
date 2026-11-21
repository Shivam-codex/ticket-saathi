ALTER TABLE public.events ADD COLUMN soft_launch_allowed boolean NOT NULL DEFAULT false;
ALTER TABLE public.events ADD COLUMN listings_killed boolean NOT NULL DEFAULT false;
UPDATE public.events SET soft_launch_allowed = is_resellable;

CREATE TABLE public.launch_settings (
  id text PRIMARY KEY DEFAULT 'default' CHECK (id = 'default'),
  soft_launch_enabled boolean NOT NULL DEFAULT true,
  invite_required boolean NOT NULL DEFAULT true,
  updated_by uuid REFERENCES public.profiles(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.launch_settings TO authenticated;
GRANT ALL ON public.launch_settings TO service_role;
ALTER TABLE public.launch_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read launch settings" ON public.launch_settings FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins update launch settings" ON public.launch_settings FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
INSERT INTO public.launch_settings (soft_launch_enabled, invite_required) VALUES (true, true);

CREATE TABLE public.launch_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  max_uses integer NOT NULL DEFAULT 100 CHECK (max_uses > 0),
  use_count integer NOT NULL DEFAULT 0 CHECK (use_count >= 0),
  active boolean NOT NULL DEFAULT true,
  expires_at timestamptz,
  note text,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.launch_invites TO authenticated;
GRANT ALL ON public.launch_invites TO service_role;
ALTER TABLE public.launch_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read invites" ON public.launch_invites FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins create invites" ON public.launch_invites FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins update invites" ON public.launch_invites FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
INSERT INTO public.launch_invites (code, max_uses, note) VALUES ('PASSON-BETA-2026', 100, 'Initial soft-launch invite');

CREATE TABLE public.launch_invite_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_id uuid NOT NULL REFERENCES public.launch_invites(id),
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (invite_id, user_id)
);
GRANT SELECT ON public.launch_invite_redemptions TO authenticated;
GRANT ALL ON public.launch_invite_redemptions TO service_role;
ALTER TABLE public.launch_invite_redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own or admin invite redemptions" ON public.launch_invite_redemptions FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.launch_state_controls (
  state_code text PRIMARY KEY CHECK (state_code ~ '^[A-Z]{2}$'),
  listings_enabled boolean NOT NULL DEFAULT true,
  updated_by uuid REFERENCES public.profiles(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.launch_state_controls TO authenticated;
GRANT ALL ON public.launch_state_controls TO service_role;
ALTER TABLE public.launch_state_controls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read state launch controls" ON public.launch_state_controls FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins create state launch controls" ON public.launch_state_controls FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins update state launch controls" ON public.launch_state_controls FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.launch_user_allowed(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN NOT EXISTS (SELECT 1 FROM public.launch_settings WHERE id = 'default' AND soft_launch_enabled AND invite_required) THEN true
    WHEN _user_id IS NULL THEN false
    ELSE EXISTS (SELECT 1 FROM public.launch_invite_redemptions r WHERE r.user_id = _user_id)
  END;
$$;
REVOKE ALL ON FUNCTION public.launch_user_allowed(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.launch_user_allowed(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.redeem_launch_invite(p_code text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare
  v_user uuid := auth.uid();
  v_invite uuid;
begin
  IF v_user IS NULL THEN RETURN false; END IF;
  IF public.launch_user_allowed(v_user) THEN RETURN true; END IF;
  IF p_code IS NULL OR char_length(trim(p_code)) < 6 THEN RETURN false; END IF;
  UPDATE public.launch_invites i
    SET use_count = i.use_count + 1
    WHERE i.code = upper(trim(p_code)) AND i.active
      AND (i.expires_at IS NULL OR i.expires_at > now())
      AND i.use_count < i.max_uses
    RETURNING i.id INTO v_invite;
  IF v_invite IS NULL THEN RETURN false; END IF;
  INSERT INTO public.launch_invite_redemptions (invite_id, user_id) VALUES (v_invite, v_user);
  RETURN true;
end;
$$;
REVOKE ALL ON FUNCTION public.redeem_launch_invite(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_launch_invite(text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.event_listing_open(_event_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.events e
    JOIN public.venues v ON v.id = e.venue_id
    WHERE e.id = _event_id AND e.is_resellable AND NOT e.listings_killed
      AND (NOT EXISTS (SELECT 1 FROM public.launch_settings WHERE id = 'default' AND soft_launch_enabled) OR e.soft_launch_allowed)
      AND NOT EXISTS (SELECT 1 FROM public.launch_state_controls s WHERE s.state_code = v.state_code AND NOT s.listings_enabled)
  );
$$;
REVOKE ALL ON FUNCTION public.event_listing_open(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.event_listing_open(uuid) TO anon, authenticated, service_role;

DROP POLICY "ready seller inserts" ON public.listings;
CREATE POLICY "ready seller inserts" ON public.listings FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = seller_id AND status = 'draft' AND public.has_role(auth.uid(), 'seller')
  AND public.is_seller_ready(auth.uid()) AND public.launch_user_allowed(auth.uid())
  AND public.event_listing_open(event_id)
);

DROP POLICY "banners public read" ON storage.objects;
CREATE POLICY "banners admin read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'event-banners' AND public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.current_fee_config()
RETURNS TABLE(id uuid, buyer_fee_bps integer, seller_fee_bps integer, gst_bps integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT f.id, f.buyer_fee_bps, f.seller_fee_bps, f.gst_bps FROM public.fee_config f
  WHERE f.effective_from <= now() ORDER BY f.effective_from DESC LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.current_fee_config() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_fee_config() TO anon, authenticated, service_role;
DROP POLICY "fees public read" ON public.fee_config;
CREATE POLICY "fees admin read" ON public.fee_config FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.current_resale_rules()
RETURNS TABLE(scope text, state_code text, event_id uuid, resale_allowed boolean, max_price_bps_of_face integer, priority integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.scope, r.state_code, r.event_id, r.resale_allowed, r.max_price_bps_of_face, r.priority FROM public.resale_rules r;
$$;
REVOKE ALL ON FUNCTION public.current_resale_rules() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_resale_rules() TO authenticated, service_role;
DROP POLICY "rules public read" ON public.resale_rules;
CREATE POLICY "rules admin read" ON public.resale_rules FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
DROP POLICY "authenticated read tax config" ON public.tax_config;
CREATE POLICY "admins read tax config" ON public.tax_config FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.create_checkout_order_v2(p_listing_id uuid, p_buyer_id uuid, p_quantity integer, p_idempotency_key text, p_unit_price_paise bigint, p_buyer_fee_paise bigint, p_buyer_fee_gst_paise bigint, p_seller_fee_paise bigint, p_seller_fee_gst_paise bigint, p_total_paise bigint, p_seller_net_paise bigint, p_tcs_paise bigint, p_tds_paise bigint, p_fee_config_id uuid, p_buyer_name text, p_buyer_phone text, p_buyer_state_code text, p_buyer_upi_id text, p_payment_method text, p_payment_provider text)
RETURNS orders LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
declare
  v_listing public.listings%rowtype;
  v_order public.orders%rowtype;
  v_stale public.orders%rowtype;
begin
  if p_buyer_id is null or p_quantity <= 0 or char_length(p_idempotency_key) < 12 then raise exception 'INVALID_CHECKOUT'; end if;
  if p_unit_price_paise < 0 or p_buyer_fee_paise < 0 or p_buyer_fee_gst_paise < 0 or p_seller_fee_paise < 0 or p_seller_fee_gst_paise < 0 or p_total_paise < 0 or p_seller_net_paise < 0 or p_tcs_paise < 0 or p_tds_paise < 0 then raise exception 'INVALID_AMOUNTS'; end if;
  if p_payment_provider not in ('mock','razorpay') then raise exception 'INVALID_PAYMENT_PROVIDER'; end if;
  select * into v_order from public.orders o where o.idempotency_key = p_idempotency_key;
  if found then
    if v_order.buyer_id is distinct from p_buyer_id then raise exception 'IDEMPOTENCY_KEY_REUSED'; end if;
    return v_order;
  end if;
  select * into v_stale from public.orders o where o.listing_id = p_listing_id and o.status = 'payment_pending' and o.hold_expires_at <= now() order by o.created_at limit 1 for update;
  if found then perform public.release_checkout_order(v_stale.id, null, 'Reservation expired'); end if;
  update public.listings l set status = 'held', held_until = now() + interval '10 minutes', updated_at = now()
    where l.id = p_listing_id and l.status = 'active' and not l.is_paused and l.price_paise = p_unit_price_paise
      and l.quantity = p_quantity and l.seller_id is distinct from p_buyer_id and public.event_listing_open(l.event_id)
      and exists (select 1 from public.events e where e.id = l.event_id and e.starts_at > now())
    returning * into v_listing;
  if not found then return null; end if;
  insert into public.orders(listing_id,buyer_id,seller_id,quantity,price_paise,buyer_fee_paise,buyer_fee_gst_paise,seller_fee_paise,seller_fee_gst_paise,total_paise,seller_net_paise,tcs_paise,tds_paise,fee_config_id,status,idempotency_key,buyer_name,buyer_phone,buyer_state_code,buyer_upi_id,payment_method,payment_provider,hold_expires_at)
  values (p_listing_id,p_buyer_id,v_listing.seller_id,p_quantity,p_unit_price_paise,p_buyer_fee_paise,p_buyer_fee_gst_paise,p_seller_fee_paise,p_seller_fee_gst_paise,p_total_paise,p_seller_net_paise,p_tcs_paise,p_tds_paise,p_fee_config_id,'pending',p_idempotency_key,p_buyer_name,p_buyer_phone,p_buyer_state_code,p_buyer_upi_id,p_payment_method,p_payment_provider,v_listing.held_until) returning * into v_order;
  insert into public.order_events(order_id,actor_id,from_status,to_status,note) values (v_order.id,p_buyer_id,null,'pending','Order created');
  update public.orders o set status = 'payment_pending', updated_at = now() where o.id = v_order.id returning * into v_order;
  insert into public.order_events(order_id,actor_id,from_status,to_status,note) values (v_order.id,p_buyer_id,'pending','payment_pending','Tickets reserved for 10 minutes');
  return v_order;
end;
$function$;

CREATE OR REPLACE FUNCTION public.rls_coverage()
RETURNS TABLE(table_name text, rls_enabled boolean, policy_count integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.relname::text, c.relrowsecurity, COUNT(p.policyname)::integer
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  LEFT JOIN pg_policies p ON p.schemaname = 'public' AND p.tablename = c.relname
  WHERE n.nspname = 'public' AND c.relkind = 'r'
  GROUP BY c.relname, c.relrowsecurity ORDER BY c.relname;
$$;
REVOKE ALL ON FUNCTION public.rls_coverage() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rls_coverage() TO service_role;

CREATE INDEX listings_event_launch_idx ON public.listings(event_id, status) WHERE status = 'active';
CREATE INDEX launch_redemptions_user_idx ON public.launch_invite_redemptions(user_id);
