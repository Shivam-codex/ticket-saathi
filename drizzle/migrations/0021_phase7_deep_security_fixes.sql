CREATE OR REPLACE FUNCTION public.protect_profile_privileged_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
begin
  IF auth.role() = 'authenticated' AND auth.uid() = OLD.id AND NOT public.has_role(auth.uid(), 'admin') THEN
    IF NEW.is_verified IS DISTINCT FROM OLD.is_verified OR NEW.is_banned IS DISTINCT FROM OLD.is_banned OR NEW.razorpay_route_account_id IS DISTINCT FROM OLD.razorpay_route_account_id THEN
      RAISE EXCEPTION 'PRIVILEGED_PROFILE_FIELDS';
    END IF;
  END IF;
  RETURN NEW;
end;
$$;
DROP TRIGGER IF EXISTS profiles_protect_privileged_fields ON public.profiles;
CREATE TRIGGER profiles_protect_privileged_fields BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.protect_profile_privileged_fields();

CREATE OR REPLACE FUNCTION public.is_seller_ready(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
  SELECT CASE
    WHEN auth.role() = 'service_role' OR auth.uid() = _user_id OR public.has_role(auth.uid(), 'admin') THEN
      EXISTS (SELECT 1 FROM auth.users u JOIN public.profiles p ON p.id = u.id WHERE u.id = _user_id AND u.phone_confirmed_at IS NOT NULL AND (coalesce(p.payout_upi_id,'') <> '' OR (coalesce(p.payout_bank_account,'') <> '' AND coalesce(p.payout_bank_ifsc,'') <> '')))
    ELSE false
  END;
$$;
REVOKE ALL ON FUNCTION public.is_seller_ready(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_seller_ready(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.seller_public_rating(_seller_id uuid)
RETURNS TABLE(average_rating numeric, rating_count integer, is_verified boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (SELECT round(avg(r.rating)::numeric, 1) FROM public.seller_reviews r WHERE r.seller_id = _seller_id),
    (SELECT count(*)::integer FROM public.seller_reviews r WHERE r.seller_id = _seller_id),
    coalesce((SELECT p.is_verified FROM public.profiles p WHERE p.id = _seller_id), false);
$$;
REVOKE ALL ON FUNCTION public.seller_public_rating(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.seller_public_rating(uuid) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.seller_public_stats(_seller_id uuid)
RETURNS TABLE(average_rating numeric, rating_count integer, completed_sales integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
begin
  IF auth.role() <> 'service_role' AND auth.uid() IS DISTINCT FROM _seller_id AND NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'NOT_AUTHORISED'; END IF;
  RETURN QUERY SELECT
    (SELECT round(avg(r.rating), 1) FROM public.seller_reviews r WHERE r.seller_id = _seller_id),
    (SELECT count(*)::integer FROM public.seller_reviews r WHERE r.seller_id = _seller_id),
    (SELECT count(*)::integer FROM public.orders o WHERE o.seller_id = _seller_id AND o.status = 'completed');
end;
$$;
REVOKE ALL ON FUNCTION public.seller_public_stats(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.seller_public_stats(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.seller_reputation(_seller_id uuid)
RETURNS TABLE(average_rating numeric, rating_count integer, completed_sales integer, dispute_count integer, dispute_rate numeric, is_verified boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
begin
  IF auth.role() <> 'service_role' AND auth.uid() IS DISTINCT FROM _seller_id AND NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'NOT_AUTHORISED'; END IF;
  RETURN QUERY SELECT (SELECT round(avg(r.rating)::numeric,2) FROM public.seller_reviews r WHERE r.seller_id = _seller_id),
    (SELECT count(*)::integer FROM public.seller_reviews r WHERE r.seller_id = _seller_id),
    (SELECT count(*)::integer FROM public.orders o WHERE o.seller_id = _seller_id AND o.status = 'completed'),
    (SELECT count(*)::integer FROM public.disputes d JOIN public.orders o ON o.id = d.order_id WHERE o.seller_id = _seller_id),
    CASE WHEN (SELECT count(*) FROM public.orders o WHERE o.seller_id = _seller_id AND o.status IN ('completed','disputed','refunded')) = 0 THEN 0
      ELSE round((SELECT count(*)::numeric FROM public.disputes d JOIN public.orders o ON o.id = d.order_id WHERE o.seller_id = _seller_id) * 100 / (SELECT count(*) FROM public.orders o WHERE o.seller_id = _seller_id AND o.status IN ('completed','disputed','refunded')),2) END,
    coalesce((SELECT p.is_verified FROM public.profiles p WHERE p.id = _seller_id),false);
end;
$$;
REVOKE ALL ON FUNCTION public.seller_reputation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.seller_reputation(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.process_listing_report()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare v_count integer; v_trusted integer; v_seller uuid;
begin
  SELECT count(*) INTO v_count FROM public.listing_reports WHERE listing_id = NEW.listing_id;
  SELECT count(DISTINCT r.reporter_id) INTO v_trusted FROM public.listing_reports r
    WHERE r.listing_id = NEW.listing_id AND (
      EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = r.reporter_id AND p.is_verified)
      OR EXISTS (SELECT 1 FROM public.orders o WHERE o.buyer_id = r.reporter_id AND o.status IN ('ticket_delivered','completed'))
    );
  SELECT seller_id INTO v_seller FROM public.listings WHERE id = NEW.listing_id;
  UPDATE public.listings SET report_count = v_count,
    status = CASE WHEN v_trusted >= 3 AND status = 'active' THEN 'draft' ELSE status END,
    is_paused = CASE WHEN v_trusted >= 3 THEN true ELSE is_paused END,
    auto_hidden = CASE WHEN v_trusted >= 3 THEN true ELSE auto_hidden END
    WHERE id = NEW.listing_id;
  IF v_trusted = 3 THEN INSERT INTO public.notifications(user_id,kind,title,body,link) VALUES(v_seller,'takedown','Listing hidden after multiple trusted reports','Our trust team will review the reports.','/my-listings'); END IF;
  RETURN NEW;
end;
$$;

REVOKE ALL ON FUNCTION public.begin_webhook(text,text,uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finish_webhook(text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.begin_webhook(text,text,uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_webhook(text,text,text) TO service_role;
