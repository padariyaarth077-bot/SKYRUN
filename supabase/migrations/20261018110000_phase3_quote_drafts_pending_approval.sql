-- PENDING APPROVAL: do not execute locally or remotely without separate approval.
-- Adds one authenticated staff RPC, no tables/columns. Direct quote writes are
-- restricted because they could bypass eligibility, audit and draft immutability.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
CREATE OR REPLACE FUNCTION public.save_quote_draft(
  _quote_id uuid, _ride_request_id uuid, _amount numeric, _currency text,
  _valid_until timestamptz, _notes text, _expected_updated_at timestamptz DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_ride public.ride_requests%ROWTYPE;
  v_lead public.leads%ROWTYPE;
  v_quote public.quotes%ROWTYPE;
BEGIN
  IF v_actor IS NULL OR NOT public.is_staff(v_actor) THEN RAISE EXCEPTION 'staff access required'; END IF;
  IF _quote_id IS NULL OR _ride_request_id IS NULL OR _amount IS NULL
    OR NOT (_amount BETWEEN 0 AND 99999999.99) OR _amount <> pg_catalog.round(_amount, 2)
    OR _currency IS NULL OR _currency !~ '^[A-Z]{3}$'
    OR _valid_until IS NULL OR NOT pg_catalog.isfinite(_valid_until) OR _valid_until <= pg_catalog.now()
    OR _notes IS NULL OR length(_notes) > 4000 THEN RAISE EXCEPTION 'invalid draft'; END IF;

  SELECT * INTO v_ride FROM public.ride_requests WHERE id = _ride_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'request unavailable'; END IF;
  IF NOT public.is_super_admin(v_actor) AND (v_ride.business_unit_id = ANY(public.current_user_business_unit_ids())) IS NOT TRUE
    THEN RAISE EXCEPTION 'request unavailable'; END IF;
  SELECT * INTO v_lead FROM public.leads WHERE id = v_ride.lead_id FOR SHARE;
  IF NOT FOUND OR v_lead.status <> 'GENUINE' OR v_lead.business_unit_id <> v_ride.business_unit_id
    OR v_lead.customer_id IS DISTINCT FROM v_ride.customer_id
    OR v_ride.status NOT IN ('SUBMITTED','UNDER_REVIEW','QUOTE_PENDING','QUOTED')
    THEN RAISE EXCEPTION 'request is not eligible for quoting'; END IF;
  PERFORM 1 FROM public.customers WHERE id = v_ride.customer_id AND business_unit_id = v_ride.business_unit_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'customer unavailable'; END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('quote:' || _quote_id::text, 0));
  SELECT * INTO v_quote FROM public.quotes WHERE id = _quote_id FOR UPDATE;
  IF FOUND THEN
    IF v_quote.business_unit_id <> v_ride.business_unit_id OR v_quote.ride_request_id <> v_ride.id
      OR v_quote.customer_id <> v_ride.customer_id OR v_quote.status <> 'DRAFT' OR v_quote.valid_until <= pg_catalog.now()
      THEN RAISE EXCEPTION 'draft unavailable for editing'; END IF;
    -- Identical retries do not create another activity or change the version.
    IF v_quote.amount = _amount AND v_quote.currency = _currency AND v_quote.valid_until = _valid_until
      AND COALESCE(v_quote.notes, '') = pg_catalog.btrim(_notes) THEN RETURN v_quote.id; END IF;
    IF _expected_updated_at IS NULL OR v_quote.updated_at IS DISTINCT FROM _expected_updated_at
      THEN RAISE EXCEPTION 'draft changed; refresh before editing'; END IF;
    UPDATE public.quotes SET amount = _amount, currency = _currency, valid_until = _valid_until,
      notes = pg_catalog.btrim(_notes) WHERE id = v_quote.id;
    PERFORM public.log_activity('quote', v_quote.id, 'UPDATED', 'Quote draft updated', '{}'::jsonb);
  ELSE
    IF _expected_updated_at IS NOT NULL THEN RAISE EXCEPTION 'draft unavailable'; END IF;
    INSERT INTO public.quotes (id,business_unit_id,ride_request_id,customer_id,vehicle_category_id,
      pickup_location,dropoff_location,travel_date,pickup_time,amount,currency,valid_until,notes,created_by,status)
    VALUES (_quote_id,v_ride.business_unit_id,v_ride.id,v_ride.customer_id,v_ride.vehicle_category_id,
      v_ride.pickup_location,v_ride.dropoff_location,v_ride.travel_date,v_ride.pickup_time,
      _amount,_currency,_valid_until,pg_catalog.btrim(_notes),v_actor,'DRAFT');
    PERFORM public.log_activity('quote', _quote_id, 'CREATED', 'Quote draft created; not sent', '{}'::jsonb);
  END IF;
  RETURN _quote_id;
END;
$$;
REVOKE ALL ON FUNCTION public.save_quote_draft(uuid,uuid,numeric,text,timestamptz,text,timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_quote_draft(uuid,uuid,numeric,text,timestamptz,text,timestamptz) TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.quotes FROM authenticated;
COMMIT;
