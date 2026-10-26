-- Phase 9 local hardening. Hosted execution requires separate approval.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';

-- These application writes already have controlled RPCs, or no supported UI.
REVOKE ALL ON public.leads,public.ride_requests,public.vehicles,public.vehicle_categories,public.business_units,public.organizations FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.leads,public.ride_requests,public.vehicles,public.vehicle_categories,public.business_units,public.organizations TO authenticated;
GRANT SELECT ON public.vehicles,public.vehicle_categories TO anon;
REVOKE ALL ON public.quotes FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.quotes TO authenticated;
DROP POLICY business_units_staff_update ON public.business_units;
DROP POLICY leads_staff ON public.leads;
CREATE POLICY leads_staff ON public.leads FOR SELECT TO authenticated USING(public.is_staff() AND (public.is_super_admin() OR business_unit_id=ANY(public.current_user_business_unit_ids())));
DROP POLICY ride_requests_staff ON public.ride_requests;
CREATE POLICY ride_requests_staff ON public.ride_requests FOR SELECT TO authenticated USING(public.is_staff() AND (public.is_super_admin() OR business_unit_id=ANY(public.current_user_business_unit_ids())));
DROP POLICY quotes_staff ON public.quotes;
CREATE POLICY quotes_staff ON public.quotes FOR SELECT TO authenticated USING(public.is_staff() AND (public.is_super_admin() OR business_unit_id=ANY(public.current_user_business_unit_ids())));
DROP POLICY customers_staff ON public.customers;
CREATE POLICY customers_staff ON public.customers FOR SELECT TO authenticated USING(public.is_staff() AND (public.is_super_admin() OR business_unit_id=ANY(public.current_user_business_unit_ids())));
DROP POLICY vehicles_staff ON public.vehicles;
CREATE POLICY vehicles_staff ON public.vehicles FOR SELECT TO authenticated USING(public.is_staff() AND (public.is_super_admin() OR business_unit_id=ANY(public.current_user_business_unit_ids())));
DROP POLICY vehicle_categories_staff ON public.vehicle_categories;
CREATE POLICY vehicle_categories_staff ON public.vehicle_categories FOR SELECT TO authenticated USING(public.is_staff() AND (public.is_super_admin() OR business_unit_id=ANY(public.current_user_business_unit_ids())));

-- Profiles are personal settings, not an organization/staff administration path.
REVOKE ALL ON public.profiles FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.profiles TO authenticated;
GRANT INSERT(id,full_name),UPDATE(full_name) ON public.profiles TO authenticated;
CREATE FUNCTION public.phase9_profile_check() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF length(COALESCE(NEW.full_name,''))>200 THEN RAISE EXCEPTION 'invalid profile name'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER phase9_profile_check BEFORE INSERT OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.phase9_profile_check();

CREATE FUNCTION public.phase9_lead_status(_id uuid,_status public.lead_status,_expected public.lead_status,_reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE l public.leads%ROWTYPE;
BEGIN
 SELECT * INTO l FROM public.leads WHERE id=_id FOR UPDATE;
 IF NOT FOUND OR NOT public.can_handle_chat(l.business_unit_id) THEN RAISE EXCEPTION 'lead unavailable'; END IF;
 IF _status IS NULL OR length(COALESCE(_reason,''))>1000 THEN RAISE EXCEPTION 'invalid lead status'; END IF;
 IF l.status=_status THEN RETURN; END IF;
 IF _expected IS NULL OR l.status IS DISTINCT FROM _expected THEN RAISE EXCEPTION 'lead changed'; END IF;
 UPDATE public.leads SET status=_status,
 reviewed_by=CASE WHEN _status IN ('GENUINE','SPAM') THEN auth.uid() ELSE reviewed_by END,
 reviewed_at=CASE WHEN _status IN ('GENUINE','SPAM') THEN clock_timestamp() ELSE reviewed_at END,
 spam_reason=CASE WHEN _status='SPAM' THEN NULLIF(btrim(_reason),'') WHEN _status='GENUINE' THEN NULL ELSE spam_reason END
 WHERE id=l.id;
 INSERT INTO public.activities(business_unit_id,entity_type,entity_id,activity_type,actor_id,description,metadata)
 VALUES(l.business_unit_id,'lead',l.id,'STATUS_CHANGE',auth.uid(),'Marked as '||_status::text,jsonb_build_object('authoritative',true,'previous_status',l.status));
END; $$;

ALTER TABLE public.leads ADD COLUMN submission_key uuid;
CREATE UNIQUE INDEX uq_lead_submission ON public.leads(business_unit_id,submission_key) WHERE submission_key IS NOT NULL;
CREATE FUNCTION public.phase9_contact(_key uuid,_source public.lead_source,_name text,_email text,_phone text,_subject text,_message text)
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
 VALUES(unit,customer,'SR-'||replace(gen_random_uuid()::text,'-',''),_source,'NEW','NORMAL',COALESCE(NULLIF(btrim(_subject),''),'Contact form request'),COALESCE(NULLIF(btrim(_message),''),NULLIF(btrim(_subject),''),btrim(_name)),_key) RETURNING * INTO lead;
 INSERT INTO public.activities(business_unit_id,entity_type,entity_id,activity_type,description,metadata)
 VALUES(unit,'lead',lead.id,'CREATED','Lead created from '||_source::text,jsonb_build_object('authoritative',true));
 RETURN jsonb_build_object('reference',lead.lead_number);
END; $$;

CREATE FUNCTION public.phase9_role_audit() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.user_roles%ROWTYPE; unit uuid;
BEGIN
 IF TG_OP='UPDATE' AND OLD IS NOT DISTINCT FROM NEW THEN RETURN NEW; END IF;
 IF TG_OP='DELETE' THEN r:=OLD; ELSE r:=NEW; END IF;
 unit:=COALESCE(r.business_unit_id,(SELECT id FROM public.business_units ORDER BY id LIMIT 1));
 INSERT INTO public.activities(business_unit_id,entity_type,entity_id,activity_type,actor_id,description,metadata)
 VALUES(unit,'user_role',r.id,'ROLE_CHANGED',auth.uid(),'Staff role '||lower(TG_OP),jsonb_build_object('authoritative',true,'target_user_id',r.user_id,'role',r.role,'operation',TG_OP));
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END; $$;
CREATE TRIGGER phase9_role_audit AFTER INSERT OR UPDATE OR DELETE ON public.user_roles FOR EACH ROW EXECUTE FUNCTION public.phase9_role_audit();

CREATE FUNCTION public.phase9_management_access() RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.business_units WHERE public.can_manage_operations(id));
$$;

-- Durable distributed budgets; no raw addresses or capability tokens retained.
CREATE TABLE public.request_budgets(subject_hash text NOT NULL CHECK(subject_hash ~ '^[a-f0-9]{64}$'),scope text NOT NULL,bucket timestamptz NOT NULL,used integer NOT NULL CHECK(used>0),PRIMARY KEY(subject_hash,scope,bucket));
ALTER TABLE public.request_budgets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.request_budgets FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.phase9_budget(_subject text,_scope text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE maximum integer; duration interval; tally integer;
BEGIN
 CASE _scope
 WHEN 'lead' THEN maximum:=20;duration:=interval '1 hour';
 WHEN 'ride' THEN maximum:=30;duration:=interval '1 hour';
 WHEN 'chat_start' THEN maximum:=30;duration:=interval '1 hour';
 WHEN 'chat_read' THEN maximum:=120;duration:=interval '1 minute';
 WHEN 'chat_write' THEN maximum:=30;duration:=interval '1 minute';
 WHEN 'acceptance' THEN maximum:=60;duration:=interval '1 minute';
 ELSE RAISE EXCEPTION 'invalid budget scope'; END CASE;
 IF _subject IS NULL OR _subject !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'invalid budget subject'; END IF;
 INSERT INTO public.request_budgets(subject_hash,scope,bucket,used) VALUES(_subject,_scope,pg_catalog.date_bin(duration,now(),'2000-01-01'::timestamptz),1)
 ON CONFLICT(subject_hash,scope,bucket) DO UPDATE SET used=public.request_budgets.used+1 WHERE public.request_budgets.used<maximum RETURNING used INTO tally;
 RETURN tally IS NOT NULL;
END; $$;

-- Public log_activity is a note operation, never a caller-selected audit event.
CREATE OR REPLACE FUNCTION public.log_activity(_entity_type text,_entity_id uuid,_activity_type text,_description text,_metadata jsonb DEFAULT '{}') RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE unit uuid; result uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_staff() OR _activity_type IS DISTINCT FROM 'NOTE'
 OR length(btrim(COALESCE(_description,''))) NOT BETWEEN 1 AND 4000 OR _metadata IS NULL OR jsonb_typeof(_metadata)<>'object'
 OR _metadata ?| ARRAY['authoritative','phase4_operation_id','phase5_operation_id','phase6_operation_id','phase7_operation_id'] THEN RAISE EXCEPTION 'note unavailable'; END IF;
 CASE _entity_type
 WHEN 'lead' THEN SELECT business_unit_id INTO unit FROM public.leads WHERE id=_entity_id;
 WHEN 'customer' THEN SELECT business_unit_id INTO unit FROM public.customers WHERE id=_entity_id;
 WHEN 'ride_request' THEN SELECT business_unit_id INTO unit FROM public.ride_requests WHERE id=_entity_id;
 WHEN 'quote' THEN SELECT business_unit_id INTO unit FROM public.quotes WHERE id=_entity_id;
 WHEN 'booking' THEN SELECT business_unit_id INTO unit FROM public.bookings WHERE id=_entity_id;
 WHEN 'conversation' THEN SELECT business_unit_id INTO unit FROM public.conversations WHERE id=_entity_id;
 WHEN 'vehicle' THEN SELECT business_unit_id INTO unit FROM public.vehicles WHERE id=_entity_id;
 WHEN 'vehicle_category' THEN SELECT business_unit_id INTO unit FROM public.vehicle_categories WHERE id=_entity_id;
 ELSE RAISE EXCEPTION 'note unavailable'; END CASE;
 IF unit IS NULL OR (NOT public.is_super_admin() AND NOT unit=ANY(public.current_user_business_unit_ids())) THEN RAISE EXCEPTION 'note unavailable'; END IF;
 INSERT INTO public.activities(business_unit_id,entity_type,entity_id,activity_type,actor_id,description,metadata)
 VALUES(unit,_entity_type,_entity_id,'NOTE',auth.uid(),btrim(_description),_metadata-'actor_id') RETURNING id INTO result;
 RETURN result;
END; $$;

REVOKE ALL ON FUNCTION public.phase9_profile_check(),public.phase9_role_audit(),public.phase9_lead_status(uuid,public.lead_status,public.lead_status,text),public.phase9_contact(uuid,public.lead_source,text,text,text,text,text),public.phase9_management_access(),public.phase9_budget(text,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.phase9_lead_status(uuid,public.lead_status,public.lead_status,text),public.phase9_management_access() TO authenticated;
GRANT EXECUTE ON FUNCTION public.phase9_contact(uuid,public.lead_source,text,text,text,text,text),public.phase9_budget(text,text) TO service_role;
-- Trusted quote RPC audit inserts are appended below; generic callers can only NOTE.
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
    INSERT INTO public.activities(business_unit_id,entity_type,entity_id,activity_type,actor_id,description,metadata) VALUES(v_ride.business_unit_id,'quote',v_quote.id,'UPDATED',v_actor,'Quote draft updated','{"authoritative":true}'::jsonb);
  ELSE
    IF _expected_updated_at IS NOT NULL THEN RAISE EXCEPTION 'draft unavailable'; END IF;
    INSERT INTO public.quotes (id,business_unit_id,ride_request_id,customer_id,vehicle_category_id,
      pickup_location,dropoff_location,travel_date,pickup_time,amount,currency,valid_until,notes,created_by,status)
    VALUES (_quote_id,v_ride.business_unit_id,v_ride.id,v_ride.customer_id,v_ride.vehicle_category_id,
      v_ride.pickup_location,v_ride.dropoff_location,v_ride.travel_date,v_ride.pickup_time,
      _amount,_currency,_valid_until,pg_catalog.btrim(_notes),v_actor,'DRAFT');
    INSERT INTO public.activities(business_unit_id,entity_type,entity_id,activity_type,actor_id,description,metadata) VALUES(v_ride.business_unit_id,'quote',_quote_id,'CREATED',v_actor,'Quote draft created; not sent','{"authoritative":true}'::jsonb);
  END IF;
  RETURN _quote_id;
END;
$$;


CREATE OR REPLACE FUNCTION public.prepare_quote_acceptance(_link_id uuid, _quote_id uuid, _token_hash text, _expected_updated_at timestamptz)
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
  INSERT INTO public.activities(business_unit_id,entity_type,entity_id,activity_type,actor_id,description,metadata) VALUES(q.business_unit_id,'quote',q.id,'UPDATED',auth.uid(),'Quote frozen for delivery; not sent',jsonb_build_object('authoritative',true,'link_id',_link_id));
  RETURN jsonb_build_object('id',_link_id);
END $$;

CREATE OR REPLACE FUNCTION public.revoke_quote_acceptance(_link_id uuid) RETURNS void
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
    INSERT INTO public.activities(business_unit_id,entity_type,entity_id,activity_type,actor_id,description,metadata) VALUES(q.business_unit_id,'quote',q.id,'UPDATED',auth.uid(),'Quote acceptance link revoked',jsonb_build_object('authoritative',true,'link_id',_link_id));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.begin_quote_delivery(_quote_id uuid,_delivery_id uuid,_token_hash text,
  _expected_updated_at timestamptz,_expected_ride_updated_at timestamptz,_reviewed_recipient text,
  _public_origin text,_is_test boolean,_attempt_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE q public.quotes%ROWTYPE; r public.ride_requests%ROWTYPE; c public.customers%ROWTYPE;
  link public.quote_acceptance_links%ROWTYPE; d public.quote_deliveries%ROWTYPE; request_id uuid; body text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'staff access required'; END IF;
  IF _attempt_id IS NULL OR _is_test IS NULL OR _public_origin NOT IN (
    'https://skyrun.padariyaarth077.workers.dev','https://skyrunlimo.com','https://www.skyrunlimo.com','http://127.0.0.1:56500')
    OR _public_origin IS NULL THEN RAISE EXCEPTION 'invalid delivery configuration'; END IF;
  SELECT ride_request_id INTO request_id FROM public.quotes WHERE id=_quote_id;
  SELECT * INTO r FROM public.ride_requests WHERE id=request_id FOR UPDATE;
  SELECT * INTO q FROM public.quotes WHERE id=_quote_id FOR UPDATE;
  IF NOT FOUND OR (NOT public.is_super_admin(auth.uid()) AND (q.business_unit_id=ANY(public.current_user_business_unit_ids())) IS NOT TRUE)
    THEN RAISE EXCEPTION 'quote unavailable'; END IF;
  SELECT * INTO c FROM public.customers WHERE id=q.customer_id FOR SHARE;
  IF NOT FOUND OR lower(c.email) IS DISTINCT FROM lower(_reviewed_recipient) THEN RAISE EXCEPTION 'review recipient again'; END IF;
  IF _is_test AND lower(c.email) <> 'padariyaarth077@gmail.com' THEN RAISE EXCEPTION 'test recipient only'; END IF;
  SELECT * INTO link FROM public.quote_acceptance_links WHERE quote_id=q.id ORDER BY (revoked_at IS NULL) DESC,created_at DESC,id DESC LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN
    IF r.updated_at IS DISTINCT FROM _expected_ride_updated_at THEN RAISE EXCEPTION 'review trip again'; END IF;
    PERFORM public.prepare_quote_acceptance(_delivery_id,q.id,_token_hash,_expected_updated_at);
    SELECT * INTO link FROM public.quote_acceptance_links WHERE id=_delivery_id FOR UPDATE;
  END IF;
  IF link.id IS DISTINCT FROM _delivery_id OR link.token_hash IS DISTINCT FROM _token_hash OR link.revoked_at IS NOT NULL
    OR link.expires_at<=now() OR lower(link.recipient_email) IS DISTINCT FROM lower(_reviewed_recipient)
    THEN RAISE EXCEPTION 'delivery unavailable'; END IF;
  PERFORM 1 FROM public.leads WHERE id=r.lead_id AND status='GENUINE' AND business_unit_id=q.business_unit_id AND customer_id=q.customer_id FOR SHARE;
  IF NOT FOUND OR r.status NOT IN ('SUBMITTED','UNDER_REVIEW','QUOTE_PENDING','QUOTED') THEN RAISE EXCEPTION 'enquiry unavailable'; END IF;
  SELECT * INTO d FROM public.quote_deliveries WHERE id=link.id FOR UPDATE;
  IF NOT FOUND THEN
    -- Persist the exact template without the bearer secret; append the deterministic link only in server memory.
    body := CASE WHEN _is_test THEN '[TEST ONLY - NO REAL RIDE]' || E'\n' ELSE '' END ||
      format(E'SKYRUN LIMO\nQuote reference: %s\n\nPickup: %s\nDrop-off: %s\nTravel date: %s\nPickup time: %s\nPassengers: %s\nTrip type: %s\nReturn: %s %s\nHourly duration: %s\nFlight: %s\nQuoted amount: %s %s\nValid until: %s\n\nThis quote is not a confirmed booking. Acceptance creates a pending booking.\nFor questions, reply to support@skyrunlimo.com.',
      q.id,link.snapshot->'quote'->>'pickup_location',link.snapshot->'quote'->>'dropoff_location',
      link.snapshot->'quote'->>'travel_date',COALESCE(link.snapshot->'quote'->>'pickup_time','Not specified'),
      link.snapshot->'ride'->>'passenger_count',link.snapshot->'ride'->>'trip_type',
      COALESCE(link.snapshot->'ride'->>'return_date','Not applicable'),COALESCE(link.snapshot->'ride'->>'return_time',''),
      COALESCE(link.snapshot->'ride'->>'hourly_duration','Not applicable'),COALESCE(link.snapshot->'ride'->>'flight_number','Not specified'),
      link.snapshot->'quote'->>'currency',link.snapshot->'quote'->>'amount',link.expires_at);
    INSERT INTO public.quote_deliveries(id,public_origin,message_text,is_test) VALUES(link.id,_public_origin,body,_is_test);
    SELECT * INTO d FROM public.quote_deliveries WHERE id=link.id FOR UPDATE;
  END IF;
  IF d.public_origin<>_public_origin OR d.is_test<>_is_test THEN RAISE EXCEPTION 'delivery configuration changed'; END IF;
  IF d.state IN ('PROVIDER_ACCEPTED','DELIVERED','FAILED') THEN RETURN jsonb_build_object('proceed',false,'state',d.state); END IF;
  IF q.status<>'DRAFT' THEN RAISE EXCEPTION 'quote unavailable'; END IF;
  IF d.first_attempt_at IS NOT NULL AND d.first_attempt_at+interval '23 hours'<=now() THEN RAISE EXCEPTION 'delivery reconciliation required'; END IF;
  IF d.lease_until>now() THEN RETURN jsonb_build_object('proceed',false,'state','IN_FLIGHT'); END IF;
  UPDATE public.quote_deliveries SET state='IN_FLIGHT',first_attempt_at=COALESCE(first_attempt_at,now()),attempt_id=_attempt_id,lease_until=now()+interval '60 seconds' WHERE id=link.id;
  INSERT INTO public.activities(business_unit_id,entity_type,entity_id,activity_type,actor_id,description,metadata) VALUES(q.business_unit_id,'quote',q.id,'UPDATED',auth.uid(),'Staff requested quote email delivery',jsonb_build_object('authoritative',true,'delivery_id',link.id));
  RETURN jsonb_build_object('proceed',true,'state','IN_FLIGHT');
END $$;
COMMIT;
