-- Local development only. Additive Regular approval provenance; Special functions unchanged.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
ALTER TABLE public.vehicle_categories ADD COLUMN regular_booking_code text
 CHECK(regular_booking_code IN ('regular-sedan','luxury-sedan','regular-suv','luxury-suv'));
CREATE UNIQUE INDEX regular_category_code ON public.vehicle_categories(business_unit_id,regular_booking_code) WHERE regular_booking_code IS NOT NULL;
-- Mapping is intentionally empty. A reviewed category ID must be explicitly authorized locally.
CREATE TABLE public.regular_ride_approvals (
 ride_request_id uuid PRIMARY KEY REFERENCES public.ride_requests(id) ON DELETE RESTRICT,
 business_unit_id uuid NOT NULL REFERENCES public.business_units(id) ON DELETE RESTRICT,
 vehicle_category_id uuid NOT NULL REFERENCES public.vehicle_categories(id) ON DELETE RESTRICT,
 category_code text NOT NULL CHECK(category_code IN ('regular-sedan','luxury-sedan','regular-suv','luxury-suv')),
 service text NOT NULL CHECK(service IN ('Airport transfer','Corporate transportation','Hourly chauffeur','Point-to-point','Special occasion','Event transportation','Other')),
 luggage_details text NOT NULL CHECK(length(luggage_details) BETWEEN 1 AND 500),
 input_hash text NOT NULL CHECK(input_hash ~ '^[a-f0-9]{64}$'),
 state text NOT NULL DEFAULT 'AWAITING_REVIEW' CHECK(state IN ('AWAITING_REVIEW','AWAITING_AVAILABILITY','APPROVED','REJECTED')),
 approved_amount numeric(10,2) CHECK(approved_amount>0 AND approved_amount<=99999999.99),
 currency text NOT NULL DEFAULT 'USD' CHECK(currency='USD'),
 pricing_basis text CHECK(length(btrim(pricing_basis)) BETWEEN 10 AND 1000),
 availability_note text CHECK(length(btrim(availability_note)) BETWEEN 10 AND 1000),
 availability_checked_by uuid REFERENCES auth.users(id), availability_checked_at timestamptz,
 reviewed_by uuid REFERENCES auth.users(id), reviewed_at timestamptz,
 rejection_reason text CHECK(length(btrim(rejection_reason)) BETWEEN 5 AND 1000),
 booking_id uuid UNIQUE REFERENCES public.bookings(id) ON DELETE RESTRICT,
 payment_status text NOT NULL DEFAULT 'NOT_REQUESTED' CHECK(payment_status='NOT_REQUESTED'),
 version integer NOT NULL DEFAULT 0 CHECK(version>=0),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK((availability_checked_by IS NULL)=(availability_checked_at IS NULL)),
 CHECK((state='APPROVED')=(booking_id IS NOT NULL)),
 CHECK(state<>'APPROVED' OR (approved_amount IS NOT NULL AND pricing_basis IS NOT NULL AND availability_note IS NOT NULL AND availability_checked_by IS NOT NULL AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)),
 CHECK(state<>'REJECTED' OR (rejection_reason IS NOT NULL AND reviewed_by IS NOT NULL))
);
CREATE INDEX regular_requests_unit ON public.regular_ride_approvals(business_unit_id,created_at DESC,ride_request_id);
ALTER TABLE public.regular_ride_approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY regular_review_read ON public.regular_ride_approvals FOR SELECT TO authenticated
 USING(public.can_manage_booking(business_unit_id));
REVOKE ALL ON public.regular_ride_approvals FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.regular_ride_approvals TO authenticated;
CREATE UNIQUE INDEX regular_operation_key ON public.activities((metadata->>'regular_operation_id')) WHERE metadata ? 'regular_operation_id';
-- HELD cannot be claimed or retried by the existing Phase 8 dispatcher.
ALTER TABLE public.communication_outbox DROP CONSTRAINT communication_outbox_state_check;
ALTER TABLE public.communication_outbox ADD CONSTRAINT communication_outbox_state_check CHECK(state IN ('HELD','QUEUED','PROCESSING','PROVIDER_ACCEPTED','DELIVERED','FAILED','RECONCILE','CANCELLED'));
ALTER TABLE public.communication_outbox DROP CONSTRAINT communication_outbox_kind_check;
ALTER TABLE public.communication_outbox ADD CONSTRAINT communication_outbox_kind_check CHECK(kind IN ('REGULAR_BOOKING_CONFIRMED','BOOKING_CONFIRMED','BOOKING_CANCELLED','STAFF_URGENT'));
ALTER TABLE public.staff_notifications DROP CONSTRAINT staff_notifications_entity_type_check;
ALTER TABLE public.staff_notifications ADD CONSTRAINT staff_notifications_entity_type_check CHECK(entity_type IN ('ride_request','lead','booking','conversation'));

CREATE FUNCTION public.regular_trip_valid(_date date,_time time) RETURNS boolean
 LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT _date IS NOT NULL AND _time IS NOT NULL AND isfinite(_date)
 AND ((_date+_time) AT TIME ZONE 'America/Chicago')>now()
 AND (((_date+_time) AT TIME ZONE 'America/Chicago') AT TIME ZONE 'America/Chicago')=(_date+_time)
 AND ((((_date+_time) AT TIME ZONE 'America/Chicago')+interval '1 hour') AT TIME ZONE 'America/Chicago')<>(_date+_time)
 AND ((((_date+_time) AT TIME ZONE 'America/Chicago')-interval '1 hour') AT TIME ZONE 'America/Chicago')<>(_date+_time);
$$;
CREATE FUNCTION public.regular_category_guard() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF (NEW.regular_booking_code IS DISTINCT FROM OLD.regular_booking_code OR NEW.business_unit_id IS DISTINCT FROM OLD.business_unit_id)
 AND EXISTS(SELECT 1 FROM public.regular_ride_approvals WHERE vehicle_category_id=OLD.id)
 THEN RAISE EXCEPTION 'referenced regular classification is immutable'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER regular_category_guard BEFORE UPDATE ON public.vehicle_categories FOR EACH ROW EXECUTE FUNCTION public.regular_category_guard();

CREATE FUNCTION public.submit_regular_ride(_key uuid,_category text,_name text,_email text,_phone text,_service text,
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
 VALUES(unit,customer,cat.id,btrim(_pickup),btrim(_dropoff),_date,_time,CASE WHEN _service='Hourly chauffeur' THEN 'HOURLY'::public.trip_type ELSE 'ONE_WAY'::public.trip_type END,_passengers,nullif(btrim(_notes),''),'SUBMITTED','RR-'||replace(gen_random_uuid()::text,'-',''),_key) RETURNING * INTO req;
 INSERT INTO public.regular_ride_approvals(ride_request_id,business_unit_id,vehicle_category_id,category_code,service,luggage_details,input_hash) VALUES(req.id,unit,cat.id,_category,_service,btrim(_luggage),fingerprint);
 INSERT INTO public.activities(business_unit_id,entity_type,entity_id,activity_type,description,metadata) VALUES(unit,'ride_request',req.id,'REGULAR_REQUEST_SUBMITTED','Regular ride awaiting review',jsonb_build_object('authoritative',true));
 PERFORM public.phase8_emit(unit,'regular/request/'||req.id,'RIDE_ENQUIRY','NORMAL','New Regular ride request','ride_request',req.id);
 RETURN jsonb_build_object('reference',req.request_number,'duplicate',false);
END; $$;

CREATE FUNCTION public.review_regular_ride(_id uuid,_operation uuid,_expected integer,_action text,_amount numeric DEFAULT NULL,_basis text DEFAULT NULL,_availability text DEFAULT NULL,_reason text DEFAULT NULL) RETURNS uuid
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
   VALUES(a.business_unit_id,c.id,r.id,cat.id,'RB-'||replace(gen_random_uuid()::text,'-',''),r.pickup_location,r.dropoff_location,r.travel_date,r.pickup_time,r.passenger_count,'CONFIRMED',_amount,'USD',r.notes,now()) RETURNING * INTO b;
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
REVOKE ALL ON FUNCTION public.regular_trip_valid(date,time),public.regular_category_guard(),public.submit_regular_ride(uuid,text,text,text,text,text,text,text,date,time,integer,text,text),public.review_regular_ride(uuid,uuid,integer,text,numeric,text,text,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.submit_regular_ride(uuid,text,text,text,text,text,text,text,date,time,integer,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.review_regular_ride(uuid,uuid,integer,text,numeric,text,text,text) TO authenticated;
COMMIT;
