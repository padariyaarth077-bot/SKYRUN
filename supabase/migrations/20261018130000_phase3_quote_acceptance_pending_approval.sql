-- PROPOSAL ONLY. Requires separate local approval; never apply remotely implicitly.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
-- Fail without changing data if legacy duplicates need owner review.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.bookings WHERE quote_id IS NOT NULL GROUP BY quote_id HAVING count(*) > 1)
  THEN RAISE EXCEPTION 'Existing duplicate quote bookings require owner review'; END IF;
END $$;
CREATE UNIQUE INDEX uq_bookings_accepted_quote ON public.bookings(quote_id) WHERE quote_id IS NOT NULL;

CREATE TABLE public.quote_acceptance_links (
  id uuid PRIMARY KEY,
  quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE RESTRICT,
  business_unit_id uuid NOT NULL REFERENCES public.business_units(id) ON DELETE RESTRICT,
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  recipient_email text NOT NULL CHECK (length(recipient_email) <= 254),
  snapshot jsonb NOT NULL,
  expires_at timestamptz NOT NULL CHECK (isfinite(expires_at)),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  provider_email_id uuid UNIQUE,
  delivered_at timestamptz,
  revoked_at timestamptz,
  accepted_at timestamptz,
  booking_id uuid UNIQUE REFERENCES public.bookings(id) ON DELETE RESTRICT,
  CHECK ((accepted_at IS NULL) = (booking_id IS NULL)),
  CHECK (delivered_at IS NULL OR provider_email_id IS NOT NULL)
);
CREATE UNIQUE INDEX uq_quote_acceptance_active ON public.quote_acceptance_links(quote_id) WHERE revoked_at IS NULL;
ALTER TABLE public.quote_acceptance_links ENABLE ROW LEVEL SECURITY;
-- Even scoped staff cannot read hashes or modify proofs directly.
REVOKE ALL ON public.quote_acceptance_links FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.quote_acceptance_links FROM service_role;
GRANT SELECT ON public.quote_acceptance_links TO service_role;

CREATE FUNCTION public.prepare_quote_acceptance(_link_id uuid, _quote_id uuid, _token_hash text, _expected_updated_at timestamptz)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE q public.quotes%ROWTYPE; r public.ride_requests%ROWTYPE; c public.customers%ROWTYPE;
  actor uuid := auth.uid(); request_id uuid; saved public.quote_acceptance_links%ROWTYPE;
BEGIN
  IF actor IS NULL OR NOT public.is_staff(actor) THEN RAISE EXCEPTION 'staff access required'; END IF;
  IF _link_id IS NULL OR _token_hash IS NULL OR _token_hash !~ '^[a-f0-9]{64}$' OR _expected_updated_at IS NULL
    THEN RAISE EXCEPTION 'invalid acceptance preparation'; END IF;
  SELECT ride_request_id INTO request_id FROM public.quotes WHERE id = _quote_id;
  SELECT * INTO r FROM public.ride_requests WHERE id = request_id FOR UPDATE;
  SELECT * INTO q FROM public.quotes WHERE id = _quote_id FOR UPDATE;
  IF NOT FOUND OR (NOT public.is_super_admin(actor) AND (q.business_unit_id = ANY(public.current_user_business_unit_ids())) IS NOT TRUE)
    THEN RAISE EXCEPTION 'quote unavailable'; END IF;
  SELECT * INTO saved FROM public.quote_acceptance_links WHERE id = _link_id;
  IF FOUND THEN
    IF saved.quote_id = q.id AND saved.token_hash = _token_hash AND saved.created_by = actor
      AND saved.revoked_at IS NULL AND saved.expires_at > now() THEN RETURN jsonb_build_object('id',saved.id); END IF;
    RAISE EXCEPTION 'acceptance preparation unavailable';
  END IF;
  IF q.status <> 'DRAFT' OR q.valid_until <= now() OR NOT isfinite(q.valid_until)
    OR NOT (q.amount BETWEEN 0 AND 99999999.99) OR q.currency !~ '^[A-Z]{3}$'
    OR q.updated_at IS DISTINCT FROM _expected_updated_at OR q.customer_id <> r.customer_id
    OR r.passenger_count NOT BETWEEN 1 AND 99
    OR q.business_unit_id <> r.business_unit_id OR r.status NOT IN ('SUBMITTED','UNDER_REVIEW','QUOTE_PENDING','QUOTED')
    THEN RAISE EXCEPTION 'quote unavailable'; END IF;
  PERFORM 1 FROM public.leads WHERE id = r.lead_id AND status = 'GENUINE'
    AND business_unit_id = q.business_unit_id AND customer_id = q.customer_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'enquiry unavailable'; END IF;
  SELECT * INTO c FROM public.customers WHERE id = q.customer_id AND business_unit_id = q.business_unit_id FOR SHARE;
  IF NOT FOUND OR c.email IS NULL OR c.email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    OR length(c.email) > 254 THEN RAISE EXCEPTION 'customer email unavailable'; END IF;
  -- Freeze all actual request fields, including return/flight/hourly/notes, plus
  -- the exact quote price, currency, copied trip and expiry; never a live join on acceptance.
  INSERT INTO public.quote_acceptance_links(id,quote_id,business_unit_id,token_hash,recipient_email,snapshot,expires_at,created_by)
  VALUES(_link_id,q.id,q.business_unit_id,_token_hash,c.email,
    jsonb_build_object('quote',to_jsonb(q),'ride',to_jsonb(r)),q.valid_until,actor);
  PERFORM public.log_activity('quote',q.id,'UPDATED','Quote frozen for delivery; not sent',jsonb_build_object('link_id',_link_id));
  RETURN jsonb_build_object('id',_link_id);
END $$;

-- Freeze fields while an active link exists; status updates never change agreed data.
CREATE FUNCTION public.guard_frozen_quote() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.quote_acceptance_links WHERE quote_id = OLD.id AND revoked_at IS NULL) THEN
    IF (to_jsonb(NEW) - 'status' - 'updated_at') IS DISTINCT FROM (to_jsonb(OLD) - 'status' - 'updated_at')
      OR (NEW.status IS DISTINCT FROM OLD.status AND NOT (
        (OLD.status = 'DRAFT' AND NEW.status IN ('SENT','CANCELLED','EXPIRED')) OR
        (OLD.status = 'SENT' AND NEW.status IN ('ACCEPTED','DECLINED','CANCELLED','EXPIRED'))))
    THEN RAISE EXCEPTION 'quote has a frozen acceptance version'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_frozen_quote BEFORE UPDATE ON public.quotes FOR EACH ROW EXECUTE FUNCTION public.guard_frozen_quote();

CREATE FUNCTION public.revoke_quote_acceptance(_link_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE link public.quote_acceptance_links%ROWTYPE; q public.quotes%ROWTYPE; request_id uuid; quote uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'staff access required'; END IF;
  SELECT quote_id INTO quote FROM public.quote_acceptance_links WHERE id = _link_id;
  SELECT ride_request_id INTO request_id FROM public.quotes WHERE id = quote;
  PERFORM 1 FROM public.ride_requests WHERE id = request_id FOR UPDATE;
  SELECT * INTO q FROM public.quotes WHERE id = quote FOR UPDATE;
  IF NOT FOUND OR (NOT public.is_super_admin(auth.uid()) AND (q.business_unit_id = ANY(public.current_user_business_unit_ids())) IS NOT TRUE)
    THEN RAISE EXCEPTION 'quote unavailable'; END IF;
  SELECT * INTO link FROM public.quote_acceptance_links WHERE id = _link_id FOR UPDATE;
  IF link.accepted_at IS NOT NULL THEN RAISE EXCEPTION 'accepted link cannot be revoked'; END IF;
  IF link.revoked_at IS NULL THEN
    UPDATE public.quote_acceptance_links SET revoked_at = now() WHERE id = _link_id;
    PERFORM public.log_activity('quote',q.id,'UPDATED','Quote acceptance link revoked',jsonb_build_object('link_id',_link_id));
  END IF;
END $$;

-- Internal boundary for a future signature-verified delivery event handler.
-- No public event handler or staff UI is permitted to assert delivery.
CREATE FUNCTION public.record_quote_delivery(_link_id uuid, _provider_email_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE link public.quote_acceptance_links%ROWTYPE; q public.quotes%ROWTYPE; quote uuid; request_id uuid;
BEGIN
  IF _provider_email_id IS NULL THEN RAISE EXCEPTION 'delivery evidence required'; END IF;
  SELECT quote_id INTO quote FROM public.quote_acceptance_links WHERE id = _link_id;
  SELECT ride_request_id INTO request_id FROM public.quotes WHERE id = quote;
  PERFORM 1 FROM public.ride_requests WHERE id = request_id FOR UPDATE;
  SELECT * INTO q FROM public.quotes WHERE id = quote FOR UPDATE;
  SELECT * INTO link FROM public.quote_acceptance_links WHERE id = _link_id FOR UPDATE;
  IF FOUND AND link.delivered_at IS NOT NULL AND link.provider_email_id = _provider_email_id THEN RETURN; END IF;
  IF NOT FOUND OR link.revoked_at IS NOT NULL OR link.expires_at <= now()
    OR q.status NOT IN ('DRAFT','SENT') OR (link.provider_email_id IS NOT NULL AND link.provider_email_id <> _provider_email_id)
    THEN RAISE EXCEPTION 'delivery unavailable'; END IF;
  IF link.delivered_at IS NULL THEN
    UPDATE public.quote_acceptance_links SET provider_email_id = _provider_email_id, delivered_at = now() WHERE id = link.id;
    UPDATE public.quotes SET status = 'SENT' WHERE id = q.id;
    INSERT INTO public.activities(business_unit_id,entity_type,entity_id,activity_type,description,metadata)
      VALUES(q.business_unit_id,'quote',q.id,'STATUS_CHANGE','Quote delivery verified',jsonb_build_object('link_id',link.id,'provider_email_id',_provider_email_id));
  END IF;
END $$;

CREATE FUNCTION public.customer_quote_acceptance(_token_hash text, _accept boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE link public.quote_acceptance_links%ROWTYPE; q public.quotes%ROWTYPE;
  ride_id uuid; quote uuid; snap jsonb; trip jsonb; booking uuid; number text; booking_state text;
BEGIN
  IF _token_hash IS NULL OR _token_hash !~ '^[a-f0-9]{64}$' OR _accept IS NULL THEN RAISE EXCEPTION 'link unavailable'; END IF;
  SELECT quote_id INTO quote FROM public.quote_acceptance_links WHERE token_hash = _token_hash;
  SELECT ride_request_id INTO ride_id FROM public.quotes WHERE id = quote;
  PERFORM 1 FROM public.ride_requests WHERE id = ride_id FOR UPDATE;
  SELECT * INTO q FROM public.quotes WHERE id = quote FOR UPDATE;
  SELECT * INTO link FROM public.quote_acceptance_links WHERE token_hash = _token_hash FOR UPDATE;
  IF NOT FOUND OR link.revoked_at IS NOT NULL OR link.expires_at <= now() OR q.valid_until <= now()
    OR link.delivered_at IS NULL OR q.status NOT IN ('SENT','ACCEPTED') THEN RAISE EXCEPTION 'link unavailable'; END IF;
  -- The current lead must remain eligible; a staff spam/cancellation review wins.
  PERFORM 1 FROM public.leads l JOIN public.ride_requests r ON r.lead_id = l.id
    WHERE r.id = q.ride_request_id AND l.status = 'GENUINE' AND l.business_unit_id = q.business_unit_id
      AND l.customer_id = q.customer_id AND r.status IN ('SUBMITTED','UNDER_REVIEW','QUOTE_PENDING','QUOTED')
    FOR SHARE OF l;
  IF NOT FOUND THEN RAISE EXCEPTION 'link unavailable'; END IF;
  snap := link.snapshot->'quote'; trip := link.snapshot->'ride';
  IF q.status = 'ACCEPTED' AND link.booking_id IS NULL THEN RAISE EXCEPTION 'acceptance unavailable'; END IF;
  IF _accept AND link.accepted_at IS NULL THEN
    booking := gen_random_uuid(); number := 'BK-' || replace(booking::text,'-','');
    INSERT INTO public.bookings(id,business_unit_id,customer_id,ride_request_id,quote_id,vehicle_category_id,
      booking_number,pickup_location,dropoff_location,travel_date,pickup_time,passenger_count,final_amount,currency,notes,status)
    VALUES(booking,q.business_unit_id,q.customer_id,q.ride_request_id,q.id,(snap->>'vehicle_category_id')::uuid,
      number,snap->>'pickup_location',snap->>'dropoff_location',(snap->>'travel_date')::date,(snap->>'pickup_time')::time,
      (trip->>'passenger_count')::int,(snap->>'amount')::numeric,snap->>'currency',snap->>'notes','PENDING');
    UPDATE public.quote_acceptance_links SET accepted_at = now(), booking_id = booking WHERE id = link.id;
    UPDATE public.quotes SET status = 'ACCEPTED' WHERE id = q.id;
    INSERT INTO public.activities(business_unit_id,entity_type,entity_id,activity_type,description,metadata)
      VALUES(q.business_unit_id,'quote',q.id,'STATUS_CHANGE','Customer accepted exact quote version',jsonb_build_object('link_id',link.id,'booking_id',booking,'authority','email_link_possession')),
      (q.business_unit_id,'booking',booking,'CREATED','Pending booking created from customer acceptance',jsonb_build_object('quote_id',q.id,'link_id',link.id));
    link.booking_id := booking; link.accepted_at := now();
  END IF;
  IF link.booking_id IS NOT NULL THEN
    SELECT booking_number,status::text INTO number,booking_state FROM public.bookings WHERE id = link.booking_id;
  END IF;
  -- Public response omits recipient/contact/tenant/internal notes/token hash.
  RETURN jsonb_build_object('quoteId',q.id,'amount',snap->>'amount','currency',snap->>'currency',
    'pickup',snap->>'pickup_location','dropoff',snap->>'dropoff_location',
    'travelDate',snap->>'travel_date','pickupTime',snap->>'pickup_time',
    'passengers',(trip->>'passenger_count')::int,'tripType',trip->>'trip_type',
    'returnDate',trip->>'return_date','returnTime',trip->>'return_time',
    'hourlyDuration',(trip->>'hourly_duration')::int,'flightNumber',trip->>'flight_number',
    'expiresAt',link.expires_at,'accepted',link.accepted_at IS NOT NULL,'bookingReference',number,'bookingStatus',booking_state);
END $$;

REVOKE ALL ON FUNCTION public.prepare_quote_acceptance(uuid,uuid,text,timestamptz), public.revoke_quote_acceptance(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prepare_quote_acceptance(uuid,uuid,text,timestamptz), public.revoke_quote_acceptance(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.guard_frozen_quote() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_quote_delivery(uuid,uuid), public.customer_quote_acceptance(text,boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_quote_delivery(uuid,uuid), public.customer_quote_acceptance(text,boolean) TO service_role;
COMMIT;
