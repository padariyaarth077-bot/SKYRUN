-- HOSTED APPLICATION PENDING APPROVAL — Phase 1 structured ride-enquiry workflow.
-- Verified in the approved isolated local Supabase test environment only.
-- Do not apply remotely until the owner verifies the intended Supabase project,
-- deployed base schema, RLS policies, and service-role setup.

ALTER TABLE public.ride_requests
  ADD COLUMN IF NOT EXISTS submission_key uuid;

CREATE UNIQUE INDEX IF NOT EXISTS uq_ride_requests_submission_key
  ON public.ride_requests (business_unit_id, submission_key)
  WHERE submission_key IS NOT NULL;

CREATE OR REPLACE FUNCTION public.create_ride_enquiry(
  _business_unit_id uuid,
  _submission_key uuid,
  _name text,
  _email text,
  _phone text,
  _subject text,
  _service text,
  _pickup_location text,
  _dropoff_location text,
  _travel_date date,
  _pickup_time time,
  _passenger_count integer,
  _vehicle_preference text,
  _notes text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_customer_id uuid;
  v_lead_id uuid;
  v_request_id uuid;
  v_lead_number text;
  v_request_number text;
BEGIN
  IF _business_unit_id IS DISTINCT FROM '00000000-0000-0000-0000-000000000002'::uuid
     OR _submission_key IS NULL
     OR length(COALESCE(pg_catalog.btrim(_name), '')) NOT BETWEEN 1 AND 120
     OR length(COALESCE(pg_catalog.btrim(_email), '')) NOT BETWEEN 3 AND 200
     OR length(COALESCE(pg_catalog.btrim(_phone), '')) NOT BETWEEN 5 AND 40
     OR length(COALESCE(pg_catalog.btrim(_pickup_location), '')) NOT BETWEEN 1 AND 300
     OR length(COALESCE(pg_catalog.btrim(_dropoff_location), '')) NOT BETWEEN 1 AND 300
     OR _service IS NULL
     OR _travel_date IS NULL
     OR _pickup_time IS NULL
     OR _passenger_count IS NULL OR _passenger_count NOT BETWEEN 1 AND 99
     OR _service NOT IN ('Airport transfer', 'Corporate transportation', 'Hourly chauffeur', 'Point-to-point', 'Special occasion', 'Event transportation', 'Other')
     OR length(COALESCE(pg_catalog.btrim(_subject), '')) > 200
     OR length(COALESCE(_vehicle_preference, '')) > 120
     OR length(COALESCE(_notes, '')) > 2000 THEN
    RAISE EXCEPTION 'invalid ride enquiry';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(_submission_key::text)::bigint);

  SELECT rr.id, rr.lead_id, rr.request_number
    INTO v_request_id, v_lead_id, v_request_number
    FROM public.ride_requests rr
   WHERE rr.business_unit_id = _business_unit_id
     AND rr.submission_key = _submission_key;

  IF v_request_id IS NOT NULL THEN
    SELECT lead_number INTO v_lead_number FROM public.leads WHERE id = v_lead_id;
    RETURN jsonb_build_object(
      'reference', COALESCE(v_lead_number, v_request_number),
      'lead_id', v_lead_id,
      'ride_request_id', v_request_id,
      'duplicate', true
    );
  END IF;

  INSERT INTO public.customers (business_unit_id, full_name, email, phone)
  VALUES (_business_unit_id, pg_catalog.btrim(_name), lower(pg_catalog.btrim(_email)), pg_catalog.btrim(_phone))
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_customer_id;

  IF v_customer_id IS NULL THEN
    SELECT id INTO v_customer_id
      FROM public.customers
     WHERE business_unit_id = _business_unit_id
       AND (lower(email) = lower(pg_catalog.btrim(_email)) OR phone = pg_catalog.btrim(_phone))
     ORDER BY (lower(email) = lower(pg_catalog.btrim(_email))) DESC NULLS LAST, id
     LIMIT 1;
    IF v_customer_id IS NULL THEN
      RAISE EXCEPTION 'could not match customer';
    END IF;
  END IF;

  v_lead_number := 'SR-' || pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', '');
  v_request_number := 'RQ-' || pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', '');

  INSERT INTO public.leads (
    business_unit_id, customer_id, lead_number, source, status, priority, subject, message
  ) VALUES (
    _business_unit_id, v_customer_id, v_lead_number, 'RIDE_ENQUIRY', 'NEW', 'NORMAL',
    pg_catalog.btrim(_subject),
    concat_ws(E'\n',
      'Service: ' || pg_catalog.btrim(_service),
      'Vehicle preference: ' || COALESCE(NULLIF(pg_catalog.btrim(_vehicle_preference), ''), 'No preference'),
      NULLIF(pg_catalog.btrim(_notes), '')
    )
  ) RETURNING id INTO v_lead_id;

  INSERT INTO public.ride_requests (
    business_unit_id, lead_id, customer_id, pickup_location, dropoff_location,
    travel_date, pickup_time, trip_type, passenger_count, notes, status,
    request_number, submission_key
  ) VALUES (
    _business_unit_id, v_lead_id, v_customer_id, pg_catalog.btrim(_pickup_location),
    pg_catalog.btrim(_dropoff_location), _travel_date, _pickup_time,
    CASE WHEN _service = 'Hourly chauffeur' THEN 'HOURLY'::public.trip_type ELSE 'ONE_WAY'::public.trip_type END,
    _passenger_count,
    concat_ws(E'\n',
      'Service: ' || pg_catalog.btrim(_service),
      'Vehicle preference: ' || COALESCE(NULLIF(pg_catalog.btrim(_vehicle_preference), ''), 'No preference'),
      NULLIF(pg_catalog.btrim(_notes), '')
    ),
    'SUBMITTED', v_request_number, _submission_key
  ) RETURNING id INTO v_request_id;

  INSERT INTO public.activities (business_unit_id, entity_type, entity_id, activity_type, description)
  VALUES
    (_business_unit_id, 'lead', v_lead_id, 'CREATED', 'Lead created from RIDE_ENQUIRY'),
    (_business_unit_id, 'ride_request', v_request_id, 'CREATED', 'Ride request submitted from website');

  RETURN jsonb_build_object(
    'reference', v_lead_number,
    'lead_id', v_lead_id,
    'ride_request_id', v_request_id,
    'duplicate', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_ride_enquiry(uuid, uuid, text, text, text, text, text, text, text, date, time, integer, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_ride_enquiry(uuid, uuid, text, text, text, text, text, text, text, date, time, integer, text, text) TO service_role;
