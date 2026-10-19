-- Phase 4. Local execution authorized; hosted execution requires separate approval.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
ALTER TABLE public.bookings ADD COLUMN required_deposit_amount numeric(10,2)
  CHECK(required_deposit_amount BETWEEN 0 AND 99999999.99);
CREATE TABLE public.booking_deposit_receipts (
 id uuid PRIMARY KEY, booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE RESTRICT,
 business_unit_id uuid NOT NULL REFERENCES public.business_units(id) ON DELETE RESTRICT,
 external_reference text NOT NULL CHECK(length(external_reference) BETWEEN 1 AND 200),
 amount numeric(10,2) NOT NULL CHECK(amount > 0 AND amount <= 99999999.99),
 currency text NOT NULL CHECK(currency ~ '^[A-Z]{3}$'), received_at timestamptz NOT NULL CHECK(isfinite(received_at)),
 recorded_by uuid NOT NULL REFERENCES auth.users(id), recorded_at timestamptz NOT NULL DEFAULT now(),
 verified_by uuid REFERENCES auth.users(id), verified_at timestamptz,
 CHECK((verified_by IS NULL) = (verified_at IS NULL)), UNIQUE(business_unit_id,external_reference)
);
CREATE TABLE public.booking_deposit_reversals (
 id uuid PRIMARY KEY, receipt_id uuid NOT NULL UNIQUE REFERENCES public.booking_deposit_receipts(id) ON DELETE RESTRICT,
 booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE RESTRICT,
 business_unit_id uuid NOT NULL REFERENCES public.business_units(id) ON DELETE RESTRICT,
 reason text NOT NULL CHECK(length(btrim(reason)) BETWEEN 1 AND 1000),
 actor_id uuid NOT NULL REFERENCES auth.users(id), created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.booking_deposit_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_deposit_reversals ENABLE ROW LEVEL SECURITY;
CREATE POLICY deposit_receipt_read ON public.booking_deposit_receipts FOR SELECT TO authenticated
 USING(public.is_staff() AND (public.is_super_admin() OR business_unit_id=ANY(public.current_user_business_unit_ids())));
CREATE POLICY deposit_reversal_read ON public.booking_deposit_reversals FOR SELECT TO authenticated
 USING(public.is_staff() AND (public.is_super_admin() OR business_unit_id=ANY(public.current_user_business_unit_ids())));
REVOKE ALL ON public.booking_deposit_receipts,public.booking_deposit_reversals FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.booking_deposit_receipts,public.booking_deposit_reversals TO authenticated,service_role;
REVOKE ALL ON public.bookings,public.activities FROM PUBLIC,authenticated,anon;
GRANT SELECT ON public.bookings,public.activities TO authenticated;
CREATE UNIQUE INDEX uq_phase4_operation ON public.activities((metadata->>'phase4_operation_id')) WHERE metadata ? 'phase4_operation_id';

CREATE FUNCTION public.can_manage_booking(_business_unit_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND (public.is_super_admin(auth.uid()) OR (
 EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND business_unit_id=_business_unit_id AND role IN ('ADMIN','MANAGER'))
 AND NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND business_unit_id=_business_unit_id AND role NOT IN ('ADMIN','MANAGER'))));
$$;

CREATE FUNCTION public.phase4_booking_action(_booking_id uuid,_operation_id uuid,_action text,_payload jsonb,_expected_updated_at timestamptz)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE b public.bookings%ROWTYPE; r public.booking_deposit_receipts%ROWTYPE; previous public.activities%ROWTYPE;
 amount numeric; eligible numeric; receipt uuid; reference text; reason text; event text;
BEGIN
 SELECT * INTO b FROM public.bookings WHERE id=_booking_id FOR UPDATE;
 IF NOT FOUND OR NOT public.can_manage_booking(b.business_unit_id) THEN RAISE EXCEPTION 'booking unavailable'; END IF;
 IF _operation_id IS NULL OR _payload IS NULL OR jsonb_typeof(_payload)<>'object' OR _action IS NULL
 THEN RAISE EXCEPTION 'invalid operation'; END IF;
 SELECT * INTO previous FROM public.activities WHERE metadata->>'phase4_operation_id'=_operation_id::text;
 IF FOUND THEN
   IF previous.entity_id<>b.id OR previous.actor_id IS DISTINCT FROM auth.uid()
      OR previous.metadata->>'action' IS DISTINCT FROM _action OR previous.metadata->'payload' IS DISTINCT FROM _payload
   THEN RAISE EXCEPTION 'operation conflict'; END IF;
   RETURN b.id;
 END IF;
 IF b.updated_at IS DISTINCT FROM _expected_updated_at THEN RAISE EXCEPTION 'booking changed; refresh'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.customers WHERE id=b.customer_id AND business_unit_id=b.business_unit_id)
 OR (b.quote_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.quotes WHERE id=b.quote_id AND business_unit_id=b.business_unit_id AND customer_id=b.customer_id AND ride_request_id=b.ride_request_id))
 OR (b.ride_request_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.ride_requests WHERE id=b.ride_request_id AND business_unit_id=b.business_unit_id AND customer_id=b.customer_id))
 THEN RAISE EXCEPTION 'booking relationships unavailable'; END IF;
 IF _action NOT IN ('requirement','receipt','verify','reverse','confirm','cancel','complete') THEN RAISE EXCEPTION 'invalid action'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(_payload) k WHERE k <> ALL(CASE _action
   WHEN 'requirement' THEN ARRAY['amount'] WHEN 'receipt' THEN ARRAY['amount','reference','currency','receivedAt']
   WHEN 'verify' THEN ARRAY['receiptId','attested'] WHEN 'reverse' THEN ARRAY['receiptId','reason']
   WHEN 'cancel' THEN ARRAY['reason'] WHEN 'complete' THEN ARRAY['attested'] ELSE ARRAY[]::text[] END))
 THEN RAISE EXCEPTION 'unexpected operation data'; END IF;
 IF _action='reverse' THEN
   IF b.status NOT IN ('PENDING','CONFIRMED','COMPLETED','CANCELLED') THEN RAISE EXCEPTION 'unsupported booking state'; END IF;
 ELSIF b.status NOT IN ('PENDING','CONFIRMED') THEN RAISE EXCEPTION 'terminal or unsupported booking state'; END IF;
 IF _action='requirement' THEN
   IF b.status<>'PENDING' OR EXISTS(SELECT 1 FROM public.booking_deposit_receipts WHERE booking_id=b.id) THEN RAISE EXCEPTION 'requirement locked'; END IF;
   amount:=(_payload->>'amount')::numeric;
   IF amount IS NULL OR NOT(amount BETWEEN 0 AND 99999999.99) OR amount<>round(amount,2) THEN RAISE EXCEPTION 'invalid amount'; END IF;
   UPDATE public.bookings SET required_deposit_amount=amount WHERE id=b.id;
   event:='DEPOSIT_REQUIREMENT_SET';
 ELSIF _action='receipt' THEN
   IF b.required_deposit_amount IS NULL THEN RAISE EXCEPTION 'record requirement first'; END IF;
   amount:=(_payload->>'amount')::numeric; reference:=lower(btrim(_payload->>'reference'));
   IF amount IS NULL OR NOT(amount>0 AND amount<=99999999.99) OR amount<>round(amount,2)
     OR _payload->>'currency' IS DISTINCT FROM b.currency OR reference IS NULL OR length(reference) NOT BETWEEN 1 AND 200
     OR reference ~* '(https?://|www\.)' OR NOT isfinite((_payload->>'receivedAt')::timestamptz)
     OR (_payload->>'receivedAt')::timestamptz>now() OR _payload->>'receivedAt' IS NULL THEN RAISE EXCEPTION 'invalid receipt'; END IF;
   INSERT INTO public.booking_deposit_receipts(id,booking_id,business_unit_id,external_reference,amount,currency,received_at,recorded_by)
    VALUES(_operation_id,b.id,b.business_unit_id,reference,amount,b.currency,(_payload->>'receivedAt')::timestamptz,auth.uid());
   event:='DEPOSIT_RECORDED';
 ELSIF _action IN ('verify','reverse') THEN
   receipt:=(_payload->>'receiptId')::uuid;
   SELECT * INTO r FROM public.booking_deposit_receipts WHERE id=receipt AND booking_id=b.id AND business_unit_id=b.business_unit_id FOR UPDATE;
   IF NOT FOUND OR r.currency<>b.currency THEN RAISE EXCEPTION 'receipt unavailable'; END IF;
   IF _action='verify' THEN
     IF _payload->'attested' IS DISTINCT FROM 'true'::jsonb OR r.verified_at IS NOT NULL THEN RAISE EXCEPTION 'verification unavailable'; END IF;
     UPDATE public.booking_deposit_receipts SET verified_by=auth.uid(),verified_at=now() WHERE id=r.id;
     event:='DEPOSIT_VERIFIED';
   ELSE
     reason:=btrim(_payload->>'reason');
     IF r.verified_at IS NULL OR reason IS NULL OR length(reason) NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'reversal reason required'; END IF;
     INSERT INTO public.booking_deposit_reversals(id,receipt_id,booking_id,business_unit_id,reason,actor_id)
      VALUES(_operation_id,r.id,b.id,b.business_unit_id,reason,auth.uid());
     event:='DEPOSIT_REVERSED';
   END IF;
 ELSIF _action='confirm' THEN
   IF b.status<>'PENDING' OR b.required_deposit_amount IS NULL THEN RAISE EXCEPTION 'deposit requirement missing or state invalid'; END IF;
   SELECT coalesce(sum(d.amount),0) INTO eligible FROM public.booking_deposit_receipts d
    WHERE d.booking_id=b.id AND d.business_unit_id=b.business_unit_id AND d.currency=b.currency AND d.verified_at IS NOT NULL
     AND NOT EXISTS(SELECT 1 FROM public.booking_deposit_reversals rev WHERE rev.receipt_id=d.id);
   IF eligible<b.required_deposit_amount THEN RAISE EXCEPTION 'verified deposit insufficient'; END IF;
   IF NOT EXISTS(SELECT 1 FROM public.quote_acceptance_links l WHERE l.booking_id=b.id AND l.quote_id=b.quote_id AND l.accepted_at IS NOT NULL
     AND l.business_unit_id=b.business_unit_id AND (l.snapshot->'quote'->>'amount')::numeric=b.final_amount
     AND l.snapshot->'quote'->>'currency'=b.currency AND l.snapshot->'quote'->>'pickup_location'=b.pickup_location
     AND l.snapshot->'quote'->>'dropoff_location'=b.dropoff_location AND (l.snapshot->'quote'->>'travel_date')::date=b.travel_date
     AND (l.snapshot->'quote'->>'pickup_time')::time IS NOT DISTINCT FROM b.pickup_time
     AND (l.snapshot->'ride'->>'passenger_count')::int=b.passenger_count)
     THEN RAISE EXCEPTION 'accepted booking proof required'; END IF;
   UPDATE public.bookings SET status='CONFIRMED',confirmed_at=now() WHERE id=b.id; event:='BOOKING_CONFIRMED';
 ELSIF _action='cancel' THEN
   reason:=btrim(_payload->>'reason');
   IF reason IS NULL OR length(reason) NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'cancellation reason required'; END IF;
   UPDATE public.bookings SET status='CANCELLED',cancelled_at=now() WHERE id=b.id; event:='BOOKING_CANCELLED';
 ELSE
   IF b.status<>'CONFIRMED' OR _payload->'attested' IS DISTINCT FROM 'true'::jsonb THEN RAISE EXCEPTION 'completion attestation required'; END IF;
   UPDATE public.bookings SET status='COMPLETED',completed_at=now() WHERE id=b.id; event:='BOOKING_COMPLETED';
 END IF;
 -- Receipt operations also advance the version, coordinating stale UI and concurrent actions.
 UPDATE public.bookings SET updated_at=clock_timestamp() WHERE id=b.id;
 INSERT INTO public.activities(business_unit_id,entity_type,entity_id,activity_type,actor_id,description,metadata)
 VALUES(b.business_unit_id,'booking',b.id,event,auth.uid(),event,
 jsonb_build_object('phase4_operation_id',_operation_id,'action',_action,'payload',_payload,'previous_status',b.status,'previous_requirement',b.required_deposit_amount,'authoritative',true));
 RETURN b.id;
END $$;
REVOKE ALL ON FUNCTION public.can_manage_booking(uuid),public.phase4_booking_action(uuid,uuid,text,jsonb,timestamptz) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.can_manage_booking(uuid),public.phase4_booking_action(uuid,uuid,text,jsonb,timestamptz) TO authenticated;
CREATE OR REPLACE FUNCTION public.log_activity(
    _entity_type text,
    _entity_id uuid,
    _activity_type text,
    _description text,
    _metadata jsonb DEFAULT '{}'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_caller uuid := auth.uid();
    v_entity_bu uuid;
    v_activity_id uuid;
    v_allowed_entity_types text[] := ARRAY[
        'lead','ride_request','quote','booking','customer','conversation','vehicle','vehicle_category'
    ];
BEGIN
    IF _metadata ? 'phase4_operation_id' OR _metadata ? 'authoritative'
      OR _activity_type LIKE 'BOOKING_%' OR _activity_type LIKE 'DEPOSIT_%'
      OR (_entity_type='booking' AND _activity_type IS DISTINCT FROM 'NOTE')
    THEN RAISE EXCEPTION 'reserved workflow activity'; END IF;
    -- 1. Caller must be authenticated
    IF v_caller IS NULL THEN
        RAISE EXCEPTION 'log_activity: authentication required';
    END IF;

    -- 2. Caller must have a staff role (or be SUPER_ADMIN)
    IF NOT public.is_staff(v_caller) THEN
        RAISE EXCEPTION 'log_activity: insufficient privileges';
    END IF;

    -- 3. Validate entity_type
    IF _entity_type = ANY(v_allowed_entity_types) IS NOT TRUE THEN
        RAISE EXCEPTION 'log_activity: invalid entity_type %', _entity_type;
    END IF;

    -- 4. Validate entity exists and resolve its business_unit_id.
    --    Each branch is a fixed table reference — no dynamic SQL, no injection risk.
    CASE _entity_type
        WHEN 'lead'             THEN SELECT business_unit_id INTO v_entity_bu FROM public.leads            WHERE id = _entity_id;
        WHEN 'ride_request'     THEN SELECT business_unit_id INTO v_entity_bu FROM public.ride_requests    WHERE id = _entity_id;
        WHEN 'quote'            THEN SELECT business_unit_id INTO v_entity_bu FROM public.quotes           WHERE id = _entity_id;
        WHEN 'booking'          THEN SELECT business_unit_id INTO v_entity_bu FROM public.bookings         WHERE id = _entity_id;
        WHEN 'customer'         THEN SELECT business_unit_id INTO v_entity_bu FROM public.customers        WHERE id = _entity_id;
        WHEN 'conversation'     THEN SELECT business_unit_id INTO v_entity_bu FROM public.conversations    WHERE id = _entity_id;
        WHEN 'vehicle'          THEN SELECT business_unit_id INTO v_entity_bu FROM public.vehicles         WHERE id = _entity_id;
        WHEN 'vehicle_category' THEN SELECT business_unit_id INTO v_entity_bu FROM public.vehicle_categories WHERE id = _entity_id;
    END CASE;

    IF v_entity_bu IS NULL THEN
        RAISE EXCEPTION 'log_activity: entity % with id % not found', _entity_type, _entity_id;
    END IF;

    -- 5. Authorization: SUPER_ADMIN bypasses BU check, otherwise must match caller's BU
    IF NOT public.is_super_admin(v_caller) THEN
        IF NOT v_entity_bu = ANY(public.current_user_business_unit_ids()) THEN
            RAISE EXCEPTION 'log_activity: cross-business-unit access denied';
        END IF;
    END IF;

    -- 6. Insert activity record
    INSERT INTO public.activities (business_unit_id, entity_type, entity_id, activity_type, actor_id, description, metadata)
    VALUES (v_entity_bu, _entity_type, _entity_id, _activity_type, v_caller, _description, _metadata)
    RETURNING id INTO v_activity_id;

    RETURN v_activity_id;
END;
$$;

REVOKE ALL ON FUNCTION public.log_activity(text, uuid, text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_activity(text, uuid, text, text, jsonb) TO authenticated;


COMMIT;
