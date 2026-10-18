-- Pending separate approval, including local execution. No hosted application authorized.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
CREATE TABLE public.quote_deliveries (
  id uuid PRIMARY KEY REFERENCES public.quote_acceptance_links(id) ON DELETE RESTRICT,
  public_origin text NOT NULL,
  message_text text NOT NULL,
  is_test boolean NOT NULL,
  state text NOT NULL DEFAULT 'PREPARED' CHECK(state IN ('PREPARED','IN_FLIGHT','UNCERTAIN','PROVIDER_ACCEPTED','DELIVERED','FAILED')),
  first_attempt_at timestamptz,
  attempt_id uuid,
  lease_until timestamptz,
  provider_email_id uuid UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.quote_delivery_events (
  id text PRIMARY KEY CHECK(length(id) BETWEEN 1 AND 200),
  provider_email_id uuid NOT NULL,
  event_type text NOT NULL CHECK(event_type IN ('email.delivered','email.bounced','email.failed','email.complained','email.suppressed')),
  recipient text NOT NULL,
  sender text NOT NULL,
  payload_hash text NOT NULL CHECK(payload_hash ~ '^[a-f0-9]{64}$'),
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);
CREATE INDEX ix_quote_delivery_events_pending ON public.quote_delivery_events(provider_email_id) WHERE processed_at IS NULL;
ALTER TABLE public.quote_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_delivery_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.quote_deliveries, public.quote_delivery_events FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.quote_deliveries TO service_role;

CREATE FUNCTION public.quote_delivery_status(_quote_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE q public.quotes%ROWTYPE; link public.quote_acceptance_links%ROWTYPE; d public.quote_deliveries%ROWTYPE;
BEGIN
  SELECT * INTO q FROM public.quotes WHERE id=_quote_id;
  IF auth.uid() IS NULL OR NOT public.is_staff(auth.uid()) OR NOT FOUND
    OR (NOT public.is_super_admin(auth.uid()) AND (q.business_unit_id=ANY(public.current_user_business_unit_ids())) IS NOT TRUE)
    THEN RAISE EXCEPTION 'quote unavailable'; END IF;
  SELECT * INTO link FROM public.quote_acceptance_links WHERE quote_id=q.id ORDER BY (revoked_at IS NULL) DESC,created_at DESC,id DESC LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('deliveryId',NULL,'state','NOT_PREPARED','frozen',false,'recipient',NULL,'retryAllowed',true); END IF;
  SELECT * INTO d FROM public.quote_deliveries WHERE id=link.id;
  RETURN jsonb_build_object('deliveryId',link.id,'state',CASE WHEN link.revoked_at IS NOT NULL THEN 'REVOKED' ELSE COALESCE(d.state,'PREPARED') END,
    'frozen',true,'recipient',link.recipient_email,'retryAllowed',link.revoked_at IS NULL AND link.expires_at>now()
      AND (d.first_attempt_at IS NULL OR d.first_attempt_at+interval '23 hours'>now()));
END $$;

CREATE FUNCTION public.begin_quote_delivery(_quote_id uuid,_delivery_id uuid,_token_hash text,
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
  PERFORM public.log_activity('quote',q.id,'UPDATED','Staff requested quote email delivery',jsonb_build_object('delivery_id',link.id));
  RETURN jsonb_build_object('proceed',true,'state','IN_FLIGHT');
END $$;

CREATE FUNCTION public.finish_quote_delivery(_delivery_id uuid,_attempt_id uuid,_provider_email_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE d public.quote_deliveries%ROWTYPE; link public.quote_acceptance_links%ROWTYPE;
BEGIN
  SELECT * INTO d FROM public.quote_deliveries WHERE id=_delivery_id FOR UPDATE;
  IF NOT FOUND OR d.attempt_id IS DISTINCT FROM _attempt_id THEN RAISE EXCEPTION 'delivery attempt unavailable'; END IF;
  IF d.provider_email_id IS NOT NULL AND d.provider_email_id IS DISTINCT FROM _provider_email_id THEN RAISE EXCEPTION 'provider conflict'; END IF;
  IF d.provider_email_id IS NOT NULL THEN RETURN; END IF;
  UPDATE public.quote_deliveries SET state=CASE WHEN _provider_email_id IS NULL THEN 'UNCERTAIN' ELSE 'PROVIDER_ACCEPTED' END,
    provider_email_id=_provider_email_id,lease_until=NULL WHERE id=d.id;
  SELECT * INTO link FROM public.quote_acceptance_links WHERE id=d.id;
  INSERT INTO public.activities(business_unit_id,entity_type,entity_id,activity_type,description,metadata)
    VALUES(link.business_unit_id,'quote',link.quote_id,'UPDATED',CASE WHEN _provider_email_id IS NULL THEN 'Quote email result uncertain; reconcile or retry same delivery' ELSE 'Resend accepted quote email; delivery not yet verified' END,jsonb_build_object('delivery_id',d.id));
END $$;

CREATE FUNCTION public.store_quote_delivery_event(_event_id text,_provider_email_id uuid,_event_type text,_recipient text,_sender text,_payload_hash text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE saved public.quote_delivery_events%ROWTYPE;
BEGIN
  INSERT INTO public.quote_delivery_events(id,provider_email_id,event_type,recipient,sender,payload_hash)
    VALUES(_event_id,_provider_email_id,_event_type,lower(_recipient),lower(_sender),_payload_hash) ON CONFLICT(id) DO NOTHING;
  SELECT * INTO saved FROM public.quote_delivery_events WHERE id=_event_id;
  IF saved.provider_email_id IS DISTINCT FROM _provider_email_id OR saved.event_type IS DISTINCT FROM _event_type
    OR saved.payload_hash IS DISTINCT FROM _payload_hash THEN RAISE EXCEPTION 'event conflict'; END IF;
END $$;

CREATE FUNCTION public.process_quote_delivery_events(_provider_email_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE delivery_id uuid; quote_id uuid; request_id uuid; link public.quote_acceptance_links%ROWTYPE;
  d public.quote_deliveries%ROWTYPE; event public.quote_delivery_events%ROWTYPE; quote_state public.quote_status;
BEGIN
  SELECT id INTO delivery_id FROM public.quote_deliveries WHERE provider_email_id=_provider_email_id;
  IF NOT FOUND THEN RETURN; END IF; -- Durable early webhook is processed after the send response binds this ID.
  SELECT l.quote_id,q.ride_request_id INTO quote_id,request_id FROM public.quote_acceptance_links l JOIN public.quotes q ON q.id=l.quote_id WHERE l.id=delivery_id;
  PERFORM 1 FROM public.ride_requests WHERE id=request_id FOR UPDATE;
  SELECT status INTO quote_state FROM public.quotes WHERE id=quote_id FOR UPDATE;
  SELECT * INTO link FROM public.quote_acceptance_links WHERE id=delivery_id FOR UPDATE;
  SELECT * INTO d FROM public.quote_deliveries WHERE id=delivery_id FOR UPDATE;
  FOR event IN SELECT * FROM public.quote_delivery_events WHERE provider_email_id=_provider_email_id AND processed_at IS NULL ORDER BY received_at,id FOR UPDATE LOOP
    IF event.sender='support@skyrunlimo.com' AND event.recipient=lower(link.recipient_email) THEN
      IF event.event_type='email.delivered' THEN
        IF d.state<>'FAILED' THEN
          UPDATE public.quote_deliveries SET state='DELIVERED' WHERE id=d.id; d.state:='DELIVERED';
          IF link.revoked_at IS NULL AND link.expires_at>now() AND quote_state IN ('DRAFT','SENT') THEN PERFORM public.record_quote_delivery(link.id,_provider_email_id); END IF;
        END IF;
      ELSE
        UPDATE public.quote_deliveries SET state='FAILED' WHERE id=d.id; d.state:='FAILED';
        UPDATE public.quote_acceptance_links SET revoked_at=COALESCE(revoked_at,now()) WHERE id=link.id AND accepted_at IS NULL;
        link.revoked_at:=now();
      END IF;
      INSERT INTO public.activities(business_unit_id,entity_type,entity_id,activity_type,description,metadata)
        VALUES(link.business_unit_id,'quote',link.quote_id,'UPDATED','Verified email event: '||event.event_type,jsonb_build_object('delivery_id',d.id,'event_id',event.id));
    END IF;
    UPDATE public.quote_delivery_events SET processed_at=now() WHERE id=event.id;
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.quote_delivery_status(uuid),public.begin_quote_delivery(uuid,uuid,text,timestamptz,timestamptz,text,text,boolean,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.quote_delivery_status(uuid),public.begin_quote_delivery(uuid,uuid,text,timestamptz,timestamptz,text,text,boolean,uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.finish_quote_delivery(uuid,uuid,uuid),public.store_quote_delivery_event(text,uuid,text,text,text,text),public.process_quote_delivery_events(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finish_quote_delivery(uuid,uuid,uuid),public.store_quote_delivery_event(text,uuid,text,text,text,text),public.process_quote_delivery_events(uuid) TO service_role;
COMMIT;
