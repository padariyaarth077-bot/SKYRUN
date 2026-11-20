-- Local-first public reference presentation; UUIDs, existing references and RLS are unchanged.
BEGIN;
CREATE SEQUENCE public.enquiry_reference_seq AS bigint NO CYCLE;
CREATE SEQUENCE public.booking_reference_seq AS bigint NO CYCLE;
REVOKE ALL ON SEQUENCE public.enquiry_reference_seq, public.booking_reference_seq FROM PUBLIC, anon, authenticated, service_role;

-- References identify records for conversation only; they never authorize access.
-- nextval is atomic. Gaps after rollback are intentional; never recycle a reference.
CREATE FUNCTION public.next_enquiry_reference() RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE n bigint; reference text;
BEGIN
 LOOP
  n := nextval('public.enquiry_reference_seq'::regclass);
  reference := 'SKY-ENQ-' || lpad(n::text, greatest(6, length(n::text)), '0');
  EXIT WHEN NOT EXISTS (SELECT 1 FROM public.leads WHERE lead_number = reference)
    AND NOT EXISTS (SELECT 1 FROM public.ride_requests WHERE request_number = reference);
 END LOOP;
 RETURN reference;
END; $$;
CREATE FUNCTION public.next_booking_reference() RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE n bigint; reference text;
BEGIN
 LOOP
  n := nextval('public.booking_reference_seq'::regclass);
  reference := 'SKY-BKG-' || lpad(n::text, greatest(6, length(n::text)), '0');
  EXIT WHEN NOT EXISTS (SELECT 1 FROM public.bookings WHERE booking_number = reference);
 END LOOP;
 RETURN reference;
END; $$;
REVOKE ALL ON FUNCTION public.next_enquiry_reference(), public.next_booking_reference() FROM PUBLIC, anon, authenticated, service_role;

-- Reuse the current creation functions, changing only their number allocation.
-- Existing retry branches return the saved number, including legacy references.
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

  v_lead_number := public.next_enquiry_reference();
  v_request_number := v_lead_number;

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

CREATE OR REPLACE FUNCTION public.chat_capture_contact(_session_token_hash text,_name text,_email text,_phone text,_trip_details text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.conversations%ROWTYPE; customer uuid; lead uuid; reference text;
BEGIN
 IF _session_token_hash IS NULL OR _session_token_hash !~ '^[a-f0-9]{64}$' OR _name IS NULL OR length(btrim(_name)) NOT BETWEEN 1 AND 120
 OR _email IS NULL OR length(btrim(_email)) NOT BETWEEN 3 AND 200 OR btrim(_email) !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
 OR _phone IS NULL OR length(btrim(_phone)) NOT BETWEEN 5 AND 40 OR length(COALESCE(_trip_details,''))>2000 THEN RAISE EXCEPTION 'invalid contact details'; END IF;
 SELECT * INTO c FROM public.conversations WHERE session_token_hash=_session_token_hash AND channel='CHAT_WIDGET' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'chat unavailable'; END IF;
 IF c.lead_id IS NOT NULL THEN
   SELECT lead_number INTO reference FROM public.leads WHERE id=c.lead_id AND business_unit_id=c.business_unit_id;
   RETURN jsonb_build_object('ok',true,'reference',reference);
 END IF;
 IF c.status IN ('CLOSED','RESOLVED') THEN RAISE EXCEPTION 'chat closed'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(c.business_unit_id::text,6));
 SELECT id INTO customer FROM public.customers WHERE business_unit_id=c.business_unit_id
 AND (lower(email)=lower(btrim(_email)) OR phone=btrim(_phone))
 ORDER BY (lower(email)=lower(btrim(_email))) DESC NULLS LAST,id LIMIT 1;
 IF customer IS NULL THEN
   BEGIN
     INSERT INTO public.customers(business_unit_id,full_name,email,phone)
     VALUES(c.business_unit_id,btrim(_name),lower(btrim(_email)),btrim(_phone)) RETURNING id INTO customer;
   EXCEPTION WHEN unique_violation THEN
     SELECT id INTO customer FROM public.customers WHERE business_unit_id=c.business_unit_id AND (lower(email)=lower(btrim(_email)) OR phone=btrim(_phone))
     ORDER BY (lower(email)=lower(btrim(_email))) DESC NULLS LAST,id LIMIT 1;
     IF customer IS NULL THEN RAISE; END IF;
   END;
 END IF;
 reference:=public.next_enquiry_reference();
 INSERT INTO public.leads(business_unit_id,customer_id,lead_number,source,status,priority,subject,message)
 VALUES(c.business_unit_id,customer,reference,'CHATBOT','NEW','NORMAL','Chat enquiry',COALESCE(NULLIF(_trip_details,''),'Chat contact details provided')) RETURNING id INTO lead;
 UPDATE public.conversations SET customer_id=customer,lead_id=lead,updated_at=clock_timestamp() WHERE id=c.id;
 INSERT INTO public.activities(business_unit_id,entity_type,entity_id,activity_type,description)
 VALUES(c.business_unit_id,'lead',lead,'CREATED','Lead created from CHATBOT conversation');
 RETURN jsonb_build_object('ok',true,'reference',reference);
END;
$$;

CREATE OR REPLACE FUNCTION public.phase9_contact(_key uuid,_source public.lead_source,_name text,_email text,_phone text,_subject text,_message text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE unit constant uuid:='00000000-0000-0000-0000-000000000002'; customer uuid; lead public.leads%ROWTYPE;
BEGIN
 IF _key IS NULL OR _source IS NULL OR _source NOT IN ('CONTACT_FORM','CHATBOT')
 OR length(btrim(COALESCE(_name,''))) NOT BETWEEN 1 AND 120 OR length(COALESCE(_email,''))>200 OR _email IS NULL OR _email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
 OR length(btrim(COALESCE(_phone,''))) NOT BETWEEN 5 AND 40 OR length(COALESCE(_subject,''))>200 OR length(COALESCE(_message,''))>4000 THEN RAISE EXCEPTION 'invalid contact'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('contact/'||_key::text,9));
 SELECT * INTO lead FROM public.leads WHERE business_unit_id=unit AND submission_key=_key;
 IF FOUND THEN RETURN jsonb_build_object('reference',lead.lead_number); END IF;
 INSERT INTO public.customers(business_unit_id,full_name,email,phone) VALUES(unit,btrim(_name),lower(btrim(_email)),btrim(_phone)) ON CONFLICT DO NOTHING RETURNING id INTO customer;
 IF customer IS NULL THEN SELECT id INTO customer FROM public.customers WHERE business_unit_id=unit AND (lower(email)=lower(btrim(_email)) OR phone=btrim(_phone)) ORDER BY (lower(email)=lower(btrim(_email))) DESC NULLS LAST,id LIMIT 1; END IF;
 IF customer IS NULL THEN RAISE EXCEPTION 'customer unavailable'; END IF;
 INSERT INTO public.leads(business_unit_id,customer_id,lead_number,source,status,priority,subject,message,submission_key)
 VALUES(unit,customer,public.next_enquiry_reference(),_source,'NEW','NORMAL',COALESCE(NULLIF(btrim(_subject),''),'Contact form request'),COALESCE(NULLIF(btrim(_message),''),NULLIF(btrim(_subject),''),btrim(_name)),_key) RETURNING * INTO lead;
 INSERT INTO public.activities(business_unit_id,entity_type,entity_id,activity_type,description,metadata)
 VALUES(unit,'lead',lead.id,'CREATED','Lead created from '||_source::text,jsonb_build_object('authoritative',true));
 RETURN jsonb_build_object('reference',lead.lead_number);
END; $$;

CREATE OR REPLACE FUNCTION public.submit_regular_ride(_key uuid,_category text,_name text,_email text,_phone text,_service text,
 _pickup text,_dropoff text,_date date,_time time,_passengers integer,_luggage text,_notes text) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE unit constant uuid:='00000000-0000-0000-0000-000000000002'; cat public.vehicle_categories%ROWTYPE;
 req public.ride_requests%ROWTYPE; approval public.regular_ride_approvals%ROWTYPE; customer uuid; fingerprint text; count_matches int;
BEGIN
 IF _key IS NULL OR length(btrim(coalesce(_name,''))) NOT BETWEEN 1 AND 120
 OR length(btrim(coalesce(_email,''))) NOT BETWEEN 3 AND 200 OR _email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
 OR length(btrim(coalesce(_phone,''))) NOT BETWEEN 5 AND 40
 OR length(btrim(coalesce(_pickup,''))) NOT BETWEEN 1 AND 300 OR length(btrim(coalesce(_dropoff,''))) NOT BETWEEN 1 AND 300
 OR length(btrim(coalesce(_luggage,''))) NOT BETWEEN 1 AND 500 OR length(coalesce(_notes,''))>2000
 OR _passengers IS NULL OR _passengers NOT BETWEEN 1 AND 99 OR NOT coalesce(public.regular_trip_valid(_date,_time),false)
 OR _service IS NULL OR _service NOT IN ('Airport transfer','Corporate transportation','Hourly chauffeur','Point-to-point','Special occasion','Event transportation','Other')
 THEN RAISE EXCEPTION 'invalid regular ride request'; END IF;
 SELECT * INTO cat FROM public.vehicle_categories WHERE business_unit_id=unit AND regular_booking_code=_category AND is_visible FOR SHARE;
 IF NOT FOUND OR lower(btrim(cat.name))<>replace(_category,'-',' ') THEN RAISE EXCEPTION 'regular category unavailable'; END IF;
 fingerprint:=encode(sha256(convert_to(jsonb_build_array(_category,btrim(_name),lower(btrim(_email)),btrim(_phone),_service,btrim(_pickup),btrim(_dropoff),_date,_time,_passengers,btrim(_luggage),coalesce(_notes,''))::text,'UTF8')),'hex');
 PERFORM pg_advisory_xact_lock(hashtext(_key::text)::bigint);
 SELECT * INTO req FROM public.ride_requests WHERE business_unit_id=unit AND submission_key=_key;
 IF FOUND THEN
  SELECT * INTO approval FROM public.regular_ride_approvals WHERE ride_request_id=req.id;
  IF NOT FOUND OR approval.input_hash<>fingerprint THEN RAISE EXCEPTION 'submission conflict'; END IF;
  RETURN jsonb_build_object('reference',req.request_number,'duplicate',true);
 END IF;
 -- Serialize matching of the same email and phone, in a consistent order.
 PERFORM pg_advisory_xact_lock(hashtext(lower(btrim(_email)))::bigint);
 INSERT INTO public.customers(business_unit_id,full_name,email,phone) VALUES(unit,btrim(_name),lower(btrim(_email)),btrim(_phone)) ON CONFLICT DO NOTHING RETURNING id INTO customer;
 IF customer IS NULL THEN
  SELECT count(*),min(id::text)::uuid INTO count_matches,customer FROM public.customers WHERE business_unit_id=unit AND (lower(email)=lower(btrim(_email)) OR phone=btrim(_phone));
  IF count_matches<>1 OR NOT EXISTS(SELECT 1 FROM public.customers WHERE id=customer AND lower(email)=lower(btrim(_email))) THEN RAISE EXCEPTION 'customer contact requires review'; END IF;
 END IF;
 INSERT INTO public.ride_requests(business_unit_id,customer_id,vehicle_category_id,pickup_location,dropoff_location,travel_date,pickup_time,trip_type,passenger_count,notes,status,request_number,submission_key)
 VALUES(unit,customer,cat.id,btrim(_pickup),btrim(_dropoff),_date,_time,CASE WHEN _service='Hourly chauffeur' THEN 'HOURLY'::public.trip_type ELSE 'ONE_WAY'::public.trip_type END,_passengers,nullif(btrim(_notes),''),'SUBMITTED',public.next_enquiry_reference(),_key) RETURNING * INTO req;
 INSERT INTO public.regular_ride_approvals(ride_request_id,business_unit_id,vehicle_category_id,category_code,service,luggage_details,input_hash) VALUES(req.id,unit,cat.id,_category,_service,btrim(_luggage),fingerprint);
 INSERT INTO public.activities(business_unit_id,entity_type,entity_id,activity_type,description,metadata) VALUES(unit,'ride_request',req.id,'REGULAR_REQUEST_SUBMITTED','Regular ride awaiting review',jsonb_build_object('authoritative',true));
 PERFORM public.phase8_emit(unit,'regular/request/'||req.id,'RIDE_ENQUIRY','NORMAL','New Regular ride request','ride_request',req.id);
 RETURN jsonb_build_object('reference',req.request_number,'duplicate',false);
END; $$;

CREATE OR REPLACE FUNCTION public.review_regular_ride(_id uuid,_operation uuid,_expected integer,_action text,_amount numeric DEFAULT NULL,_basis text DEFAULT NULL,_availability text DEFAULT NULL,_reason text DEFAULT NULL) RETURNS uuid
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a public.regular_ride_approvals%ROWTYPE; r public.ride_requests%ROWTYPE; c public.customers%ROWTYPE; cat public.vehicle_categories%ROWTYPE;
 b public.bookings%ROWTYPE; previous public.activities%ROWTYPE; payload jsonb; event text;
BEGIN
 SELECT * INTO a FROM public.regular_ride_approvals WHERE ride_request_id=_id FOR UPDATE;
 IF NOT FOUND OR NOT public.can_manage_booking(a.business_unit_id) THEN RAISE EXCEPTION 'regular request unavailable'; END IF;
 IF _operation IS NULL OR _action IS NULL OR _action NOT IN ('price','approve','reject') THEN RAISE EXCEPTION 'invalid review'; END IF;
 payload:=jsonb_build_object('action',_action,'amount',_amount,'basis',_basis,'availability',_availability,'reason',_reason);
 SELECT * INTO previous FROM public.activities WHERE metadata->>'regular_operation_id'=_operation::text;
 IF FOUND THEN
  IF previous.entity_id<>_id OR previous.actor_id IS DISTINCT FROM auth.uid() OR previous.metadata->'payload' IS DISTINCT FROM payload THEN RAISE EXCEPTION 'operation conflict'; END IF;
  RETURN a.booking_id;
 END IF;
 IF a.version IS DISTINCT FROM _expected OR a.state IN ('APPROVED','REJECTED') THEN RAISE EXCEPTION 'request changed or already decided'; END IF;
 SELECT * INTO r FROM public.ride_requests WHERE id=_id FOR UPDATE;
 SELECT * INTO c FROM public.customers WHERE id=r.customer_id AND business_unit_id=a.business_unit_id FOR SHARE;
 IF NOT FOUND OR r.business_unit_id<>a.business_unit_id OR r.vehicle_category_id IS DISTINCT FROM a.vehicle_category_id OR r.lead_id IS NOT NULL OR r.status NOT IN ('SUBMITTED','UNDER_REVIEW') THEN RAISE EXCEPTION 'request relationships unavailable'; END IF;
 IF EXISTS(SELECT 1 FROM public.bookings WHERE ride_request_id=r.id) OR EXISTS(SELECT 1 FROM public.quotes WHERE ride_request_id=r.id) THEN RAISE EXCEPTION 'request already has a commercial workflow'; END IF;
 IF _action='reject' THEN
  IF length(btrim(coalesce(_reason,''))) NOT BETWEEN 5 AND 1000 OR _amount IS NOT NULL OR _basis IS NOT NULL OR _availability IS NOT NULL THEN RAISE EXCEPTION 'rejection reason required'; END IF;
  UPDATE public.regular_ride_approvals SET state='REJECTED',rejection_reason=btrim(_reason),reviewed_by=auth.uid(),reviewed_at=now() WHERE ride_request_id=r.id;
  UPDATE public.ride_requests SET status='CANCELLED' WHERE id=r.id; event:='REGULAR_REQUEST_REJECTED';
 ELSE
  SELECT * INTO cat FROM public.vehicle_categories WHERE id=a.vehicle_category_id AND business_unit_id=a.business_unit_id AND regular_booking_code=a.category_code AND is_visible FOR SHARE;
  IF NOT FOUND OR lower(btrim(cat.name))<>replace(a.category_code,'-',' ') OR NOT coalesce(public.regular_trip_valid(r.travel_date,r.pickup_time),false) OR r.passenger_count NOT BETWEEN 1 AND 99
  OR length(btrim(coalesce(r.pickup_location,''))) NOT BETWEEN 1 AND 300 OR length(btrim(coalesce(r.dropoff_location,''))) NOT BETWEEN 1 AND 300
  OR length(btrim(coalesce(c.full_name,''))) NOT BETWEEN 1 AND 120 OR length(btrim(coalesce(c.phone,''))) NOT BETWEEN 5 AND 40
  OR _amount IS NULL OR _amount<=0 OR _amount>99999999.99 OR _amount<>round(_amount,2) OR _amount::text IN ('NaN','Infinity','-Infinity')
  OR length(btrim(coalesce(_basis,''))) NOT BETWEEN 10 AND 1000 OR _reason IS NOT NULL
  THEN RAISE EXCEPTION 'valid category trip and approved USD amount required'; END IF;
  IF _action='price' THEN
   IF _availability IS NOT NULL THEN RAISE EXCEPTION 'availability not confirmed'; END IF;
   UPDATE public.regular_ride_approvals SET state='AWAITING_AVAILABILITY',approved_amount=_amount,pricing_basis=btrim(_basis),reviewed_by=auth.uid(),reviewed_at=now() WHERE ride_request_id=r.id;
   UPDATE public.ride_requests SET status='UNDER_REVIEW' WHERE id=r.id; event:='REGULAR_PRICE_REVIEWED';
  ELSE
   IF length(btrim(coalesce(_availability,''))) NOT BETWEEN 10 AND 1000 OR coalesce(c.email,'') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN RAISE EXCEPTION 'availability attestation and customer email required'; END IF;
   INSERT INTO public.bookings(business_unit_id,customer_id,ride_request_id,vehicle_category_id,booking_number,pickup_location,dropoff_location,travel_date,pickup_time,passenger_count,status,final_amount,currency,notes,confirmed_at)
   VALUES(a.business_unit_id,c.id,r.id,cat.id,public.next_booking_reference(),r.pickup_location,r.dropoff_location,r.travel_date,r.pickup_time,r.passenger_count,'CONFIRMED',_amount,'USD',r.notes,now()) RETURNING * INTO b;
   UPDATE public.regular_ride_approvals SET state='APPROVED',approved_amount=_amount,pricing_basis=btrim(_basis),availability_note=btrim(_availability),availability_checked_by=auth.uid(),availability_checked_at=now(),reviewed_by=auth.uid(),reviewed_at=now(),booking_id=b.id WHERE ride_request_id=r.id;
   UPDATE public.ride_requests SET status='CONVERTED' WHERE id=r.id;
   INSERT INTO public.communication_outbox(business_unit_id,source_key,recipient_key,kind,entity_type,entity_id,customer_id,recipient,payload,state,failure_category)
   VALUES(a.business_unit_id,'regular/confirmed/'||r.id,'customer/'||c.id,'REGULAR_BOOKING_CONFIRMED','booking',b.id,c.id,lower(c.email),jsonb_build_object('reference',b.booking_number,'name',c.full_name,'status','CONFIRMED','travelDate',b.travel_date,'pickupTime',b.pickup_time,'pickup',b.pickup_location,'dropoff',b.dropoff_location,'category',cat.name,'amount',b.final_amount,'currency',b.currency,'paymentStatus','NOT_REQUESTED','timeZone','America/Chicago'),'HELD','REGULAR_DELIVERY_NOT_AUTHORIZED');
   INSERT INTO public.activities(business_unit_id,entity_type,entity_id,activity_type,actor_id,description,metadata) VALUES(a.business_unit_id,'booking',b.id,'REGULAR_BOOKING_CONFIRMED',auth.uid(),'Regular booking confirmed; payment not requested',jsonb_build_object('authoritative',true,'ride_request_id',r.id));
   PERFORM public.phase8_emit(a.business_unit_id,'regular/confirmed/'||r.id,'BOOKING_CONFIRMED','IMPORTANT','Regular booking confirmed — payment not requested','booking',b.id,auth.uid());
   event:='REGULAR_REQUEST_APPROVED';
  END IF;
 END IF;
 UPDATE public.regular_ride_approvals SET version=version+1,updated_at=clock_timestamp() WHERE ride_request_id=r.id;
 INSERT INTO public.activities(business_unit_id,entity_type,entity_id,activity_type,actor_id,description,metadata) VALUES(a.business_unit_id,'ride_request',r.id,event,auth.uid(),event,jsonb_build_object('authoritative',true,'regular_operation_id',_operation,'payload',payload));
 RETURN b.id;
END; $$;

CREATE OR REPLACE FUNCTION public.customer_quote_acceptance(_token_hash text, _accept boolean DEFAULT false)
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
    booking := gen_random_uuid(); number := public.next_booking_reference();
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

COMMIT;
