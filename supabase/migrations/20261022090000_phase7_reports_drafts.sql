-- Phase 7 additive draft/report architecture. PENDING APPROVAL; do not apply automatically.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
CREATE TABLE public.document_profiles (
 business_unit_id uuid PRIMARY KEY REFERENCES public.business_units(id) ON DELETE RESTRICT,
 legal_name text NOT NULL DEFAULT '' CHECK(length(legal_name)<=200), address text NOT NULL DEFAULT '' CHECK(length(address)<=1000),
 phone text NOT NULL DEFAULT '' CHECK(length(phone)<=40), email text NOT NULL DEFAULT '' CHECK(length(email)<=200),
 website text NOT NULL DEFAULT '' CHECK(length(website)<=300), footer text NOT NULL DEFAULT '' CHECK(length(footer)<=2000),
 payment_terms text NOT NULL DEFAULT '' CHECK(length(payment_terms)<=1000), updated_at timestamptz NOT NULL DEFAULT now(),
 updated_by uuid NOT NULL REFERENCES auth.users(id)
);
CREATE TABLE public.invoice_drafts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_unit_id uuid NOT NULL REFERENCES public.business_units(id) ON DELETE RESTRICT,
 booking_id uuid NOT NULL UNIQUE REFERENCES public.bookings(id) ON DELETE RESTRICT,
 customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
 amount numeric(10,2) NOT NULL CHECK(amount>=0 AND amount<=99999999.99), currency text NOT NULL CHECK(currency ~ '^[A-Z]{3}$'),
 customer_snapshot jsonb NOT NULL, business_snapshot jsonb NOT NULL,
 description text NOT NULL CHECK(length(btrim(description)) BETWEEN 1 AND 2000),
 created_by uuid NOT NULL REFERENCES auth.users(id), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
-- There are deliberately no issued invoices, numbering sequences, tax rules or receipt documents.
ALTER TABLE public.document_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_drafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY document_profile_read ON public.document_profiles FOR SELECT TO authenticated USING(public.can_manage_booking(business_unit_id));
CREATE POLICY invoice_draft_read ON public.invoice_drafts FOR SELECT TO authenticated USING(public.can_manage_booking(business_unit_id));
REVOKE ALL ON public.document_profiles,public.invoice_drafts FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.document_profiles,public.invoice_drafts TO authenticated;
ALTER TABLE public.activities DROP CONSTRAINT activities_entity_type_check;
ALTER TABLE public.activities ADD CONSTRAINT activities_entity_type_check CHECK(entity_type IN ('lead','ride_request','quote','booking','customer','conversation','vehicle','vehicle_category','profile','user_role','service_configuration','document_profile','invoice_draft'));
CREATE UNIQUE INDEX uq_phase7_operation ON public.activities((metadata->>'phase7_operation_id')) WHERE metadata ? 'phase7_operation_id';
CREATE FUNCTION public.phase7_save(_operation_id uuid,_kind text,_entity_id uuid,_payload jsonb,_expected_updated_at timestamptz) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE unit uuid; b public.bookings%ROWTYPE; d public.invoice_drafts%ROWTYPE; p public.document_profiles%ROWTYPE;
 previous public.activities%ROWTYPE; result uuid; event text; snapshot jsonb; before_data jsonb;
BEGIN
 IF _operation_id IS NULL OR _entity_id IS NULL OR _kind IS NULL OR _kind NOT IN ('profile','draft') OR _payload IS NULL OR jsonb_typeof(_payload)<>'object' THEN RAISE EXCEPTION 'invalid document action'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(_operation_id::text,7));
 IF _kind='profile' THEN
   unit:=_entity_id;
   PERFORM 1 FROM public.business_units WHERE id=unit FOR UPDATE;
   IF NOT FOUND OR NOT public.can_manage_booking(unit) THEN RAISE EXCEPTION 'document unavailable'; END IF;
 ELSE
   SELECT * INTO b FROM public.bookings WHERE id=_entity_id FOR UPDATE;
   IF NOT FOUND OR NOT public.can_manage_booking(b.business_unit_id) THEN RAISE EXCEPTION 'document unavailable'; END IF;
   unit:=b.business_unit_id;
 END IF;
 SELECT * INTO previous FROM public.activities WHERE metadata->>'phase7_operation_id'=_operation_id::text;
 IF FOUND THEN
   IF previous.actor_id IS DISTINCT FROM auth.uid() OR previous.metadata->>'kind' IS DISTINCT FROM _kind
   OR previous.metadata->>'input_id' IS DISTINCT FROM _entity_id::text OR previous.metadata->'payload' IS DISTINCT FROM _payload THEN RAISE EXCEPTION 'operation conflict'; END IF;
   RETURN previous.entity_id;
 END IF;
 IF _kind='profile' THEN
   IF EXISTS(SELECT 1 FROM jsonb_object_keys(_payload) k WHERE k<>ALL(ARRAY['legal_name','address','phone','email','website','footer','payment_terms']))
    OR EXISTS(SELECT 1 FROM jsonb_each(_payload) v WHERE jsonb_typeof(v.value)<>'string') THEN RAISE EXCEPTION 'invalid profile fields'; END IF;
   SELECT * INTO p FROM public.document_profiles WHERE business_unit_id=unit FOR UPDATE;
   IF p.updated_at IS DISTINCT FROM _expected_updated_at THEN RAISE EXCEPTION 'profile changed; refresh'; END IF;
   before_data:=to_jsonb(p);
   IF length(COALESCE(_payload->>'email',''))>0 AND _payload->>'email' !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN RAISE EXCEPTION 'invalid email'; END IF;
   IF length(COALESCE(_payload->>'website',''))>0 AND _payload->>'website' !~ '^https://[^[:space:]@]+$' THEN RAISE EXCEPTION 'invalid website'; END IF;
   INSERT INTO public.document_profiles(business_unit_id,legal_name,address,phone,email,website,footer,payment_terms,updated_by)
   VALUES(unit,btrim(COALESCE(_payload->>'legal_name','')),btrim(COALESCE(_payload->>'address','')),btrim(COALESCE(_payload->>'phone','')),btrim(COALESCE(_payload->>'email','')),btrim(COALESCE(_payload->>'website','')),btrim(COALESCE(_payload->>'footer','')),btrim(COALESCE(_payload->>'payment_terms','')),auth.uid())
   ON CONFLICT(business_unit_id) DO UPDATE SET legal_name=excluded.legal_name,address=excluded.address,phone=excluded.phone,email=excluded.email,website=excluded.website,footer=excluded.footer,payment_terms=excluded.payment_terms,updated_by=auth.uid(),updated_at=clock_timestamp();
   result:=unit;event:='FINANCE_PROFILE_SAVED';
 ELSE
   IF EXISTS(SELECT 1 FROM jsonb_object_keys(_payload) k WHERE k<>'description') OR jsonb_typeof(_payload->'description') IS DISTINCT FROM 'string'
   OR length(btrim(_payload->>'description')) NOT BETWEEN 1 AND 2000 THEN RAISE EXCEPTION 'invalid description'; END IF;
   SELECT * INTO d FROM public.invoice_drafts WHERE booking_id=b.id FOR UPDATE;
   IF d.updated_at IS DISTINCT FROM _expected_updated_at THEN RAISE EXCEPTION 'draft changed; refresh'; END IF;
   before_data:=to_jsonb(d);
   IF d.id IS NULL THEN
     IF b.status NOT IN ('PENDING','CONFIRMED','COMPLETED') OR b.final_amount IS NULL THEN RAISE EXCEPTION 'booking not eligible for draft'; END IF;
     SELECT jsonb_build_object('name',full_name,'email',email,'company',company_name) INTO snapshot FROM public.customers WHERE id=b.customer_id AND business_unit_id=unit;
     IF snapshot IS NULL THEN RAISE EXCEPTION 'customer unavailable'; END IF;
     INSERT INTO public.invoice_drafts(business_unit_id,booking_id,customer_id,amount,currency,customer_snapshot,business_snapshot,description,created_by)
     VALUES(unit,b.id,b.customer_id,b.final_amount,b.currency,snapshot,COALESCE((SELECT to_jsonb(profile_row)-'updated_by' FROM public.document_profiles profile_row WHERE profile_row.business_unit_id=unit),'{}'::jsonb),btrim(_payload->>'description'),auth.uid()) RETURNING id INTO result;
     event:='FINANCE_DRAFT_CREATED';
   ELSE
     UPDATE public.invoice_drafts SET description=btrim(_payload->>'description'),updated_at=clock_timestamp() WHERE id=d.id RETURNING id INTO result;
     event:='FINANCE_DRAFT_UPDATED';
   END IF;
 END IF;
 INSERT INTO public.activities(business_unit_id,entity_type,entity_id,activity_type,actor_id,description,metadata)
 VALUES(unit,CASE _kind WHEN 'profile' THEN 'document_profile' ELSE 'invoice_draft' END,result,event,auth.uid(),CASE _kind WHEN 'profile' THEN 'Document business profile saved' ELSE 'Invoice draft saved; not issued' END,
 jsonb_build_object('phase7_operation_id',_operation_id,'kind',_kind,'input_id',_entity_id,'payload',_payload,'before',before_data,'authoritative',true));
 RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.phase7_save(uuid,text,uuid,jsonb,timestamptz) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.phase7_save(uuid,text,uuid,jsonb,timestamptz) TO authenticated;

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
    IF _metadata ? 'phase4_operation_id' OR _metadata ? 'phase5_operation_id' OR _metadata ? 'phase7_operation_id' OR _metadata ? 'phase6_operation_id' OR _metadata ? 'authoritative'
      OR _activity_type LIKE 'BOOKING_%' OR _activity_type LIKE 'DEPOSIT_%' OR _activity_type LIKE 'PHASE5_%' OR _activity_type LIKE 'CHAT_%' OR _activity_type LIKE 'FINANCE_%'
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




-- Report function is appended below before COMMIT.

CREATE FUNCTION public.phase7_report(_kind text,_from date,_to date,_status text,_source text,_search text,_unit uuid,_offset integer,_limit integer) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' SET timezone='UTC' AS $$
DECLARE result jsonb;
BEGIN
 IF NOT public.is_staff() OR auth.uid() IS NULL THEN RAISE EXCEPTION 'staff access required'; END IF;
 IF _kind IS NULL OR _kind NOT IN ('enquiries','quotes','bookings','customers','deposits','invoices','receipts','audit')
 OR _offset IS NULL OR _limit IS NULL OR _offset<0 OR _offset>100000 OR _limit NOT BETWEEN 1 AND 10000
 OR length(COALESCE(_search,''))>120 OR length(COALESCE(_status,''))>40 OR length(COALESCE(_source,''))>40 OR (_from IS NOT NULL AND _to IS NOT NULL AND _from>_to) THEN RAISE EXCEPTION 'invalid report filters'; END IF;
 IF _unit IS NOT NULL AND NOT(public.is_super_admin() OR _unit=ANY(public.current_user_business_unit_ids())) THEN RAISE EXCEPTION 'unit unavailable'; END IF;
 IF _kind IN ('deposits','invoices','receipts') AND NOT(public.is_super_admin() OR EXISTS(SELECT 1 FROM public.user_roles u WHERE u.user_id=auth.uid() AND public.can_manage_booking(u.business_unit_id))) THEN RAISE EXCEPTION 'financial role required'; END IF;
 WITH records AS (
 SELECT l.id,l.business_unit_id,l.created_at AS date,l.status::text AS status,
 jsonb_build_object('id',l.id,'reference',l.lead_number,'customer',c.full_name,'customer_id',l.customer_id,'source',l.source,'status',l.status,'reviewed_at',l.reviewed_at,'date',l.created_at,'entity_type','lead','business_unit_id',l.business_unit_id) AS data
 FROM public.leads l LEFT JOIN public.customers c ON c.id=l.customer_id AND c.business_unit_id=l.business_unit_id WHERE _kind='enquiries'
 UNION ALL
 SELECT q.id,q.business_unit_id,q.created_at,q.status::text,
 jsonb_build_object('id',q.id,'reference',q.id,'customer',c.full_name,'customer_id',q.customer_id,'ride_request_id',q.ride_request_id,'amount',q.amount::text,'currency',q.currency,'status',q.status,'valid_until',q.valid_until,'date',q.created_at,'entity_type','quote','business_unit_id',q.business_unit_id)
 FROM public.quotes q LEFT JOIN public.customers c ON c.id=q.customer_id AND c.business_unit_id=q.business_unit_id WHERE _kind='quotes'
 UNION ALL
 SELECT b.id,b.business_unit_id,b.travel_date::timestamptz,b.status::text,
 jsonb_build_object('id',b.id,'reference',b.booking_number,'customer',c.full_name,'customer_id',b.customer_id,'quote_id',b.quote_id,'amount',b.final_amount::text,'currency',b.currency,'status',b.status,'date',b.travel_date,'entity_type','booking','business_unit_id',b.business_unit_id)
 FROM public.bookings b LEFT JOIN public.customers c ON c.id=b.customer_id AND c.business_unit_id=b.business_unit_id WHERE _kind='bookings'
 UNION ALL
 SELECT c.id,c.business_unit_id,c.created_at,'',jsonb_build_object('id',c.id,'reference',c.full_name,'customer',c.full_name,'date',c.created_at,'entity_type','customer','business_unit_id',c.business_unit_id,
 'enquiries',(SELECT count(*) FROM public.leads l WHERE l.customer_id=c.id AND l.business_unit_id=c.business_unit_id),
 'quotes',(SELECT count(*) FROM public.quotes q WHERE q.customer_id=c.id AND q.business_unit_id=c.business_unit_id),
 'bookings',(SELECT count(*) FROM public.bookings b WHERE b.customer_id=c.id AND b.business_unit_id=c.business_unit_id)) FROM public.customers c WHERE _kind='customers'
 UNION ALL
 SELECT b.id,b.business_unit_id,b.travel_date::timestamptz,b.status::text,
 jsonb_build_object('id',b.id,'reference',b.booking_number,'customer',c.full_name,'customer_id',b.customer_id,'currency',b.currency,'required',b.required_deposit_amount::text,'verified',e.total::text,
 'shortfall',CASE WHEN b.required_deposit_amount IS NULL THEN NULL ELSE greatest(0,b.required_deposit_amount-e.total)::text END,
 'payment_exception',(b.confirmed_at IS NOT NULL AND EXISTS(SELECT 1 FROM public.booking_deposit_reversals v WHERE v.booking_id=b.id AND v.business_unit_id=b.business_unit_id AND v.created_at>=b.confirmed_at)) OR (b.status IN ('CONFIRMED','COMPLETED') AND (b.required_deposit_amount IS NULL OR e.total<b.required_deposit_amount)),'status',b.status,'date',b.travel_date,'entity_type','booking','business_unit_id',b.business_unit_id)
 FROM public.bookings b LEFT JOIN public.customers c ON c.id=b.customer_id AND c.business_unit_id=b.business_unit_id
 CROSS JOIN LATERAL(SELECT COALESCE(sum(r.amount),0) AS total FROM public.booking_deposit_receipts r WHERE r.booking_id=b.id AND r.business_unit_id=b.business_unit_id AND r.currency=b.currency AND r.verified_at IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.booking_deposit_reversals v WHERE v.receipt_id=r.id)) e
 WHERE _kind='deposits' AND public.can_manage_booking(b.business_unit_id)
 UNION ALL
 SELECT d.id,d.business_unit_id,d.created_at,'DRAFT',jsonb_build_object('id',d.id,'reference',d.id,'customer',d.customer_snapshot->>'name','customer_id',d.customer_id,'booking_id',d.booking_id,'amount',d.amount::text,'currency',d.currency,'status','DRAFT','date',d.created_at,'entity_type','invoice_draft','business_unit_id',d.business_unit_id)
 FROM public.invoice_drafts d WHERE _kind='invoices'
 UNION ALL
 SELECT r.id,r.business_unit_id,r.received_at,
 CASE WHEN v.id IS NOT NULL THEN 'REVERSED' WHEN r.currency<>b.currency THEN 'CURRENCY_MISMATCH' WHEN r.verified_at IS NULL THEN 'UNVERIFIED' ELSE 'VERIFIED' END,
 jsonb_build_object('id',r.id,'reference',r.id,'customer',c.full_name,'customer_id',b.customer_id,'booking_id',b.id,'amount',r.amount::text,'currency',r.currency,
 'status',CASE WHEN v.id IS NOT NULL THEN 'REVERSED' WHEN r.currency<>b.currency THEN 'CURRENCY_MISMATCH' WHEN r.verified_at IS NULL THEN 'UNVERIFIED' ELSE 'VERIFIED' END,
 'date',r.received_at,'entity_type','payment_evidence','business_unit_id',r.business_unit_id)
 FROM public.booking_deposit_receipts r JOIN public.bookings b ON b.id=r.booking_id AND b.business_unit_id=r.business_unit_id
 LEFT JOIN public.customers c ON c.id=b.customer_id AND c.business_unit_id=b.business_unit_id LEFT JOIN public.booking_deposit_reversals v ON v.receipt_id=r.id
 WHERE _kind='receipts' AND public.can_manage_booking(r.business_unit_id)
 UNION ALL
 SELECT a.id,a.business_unit_id,a.created_at,a.activity_type,jsonb_build_object('id',a.entity_id,'reference',a.description,'actor',a.actor_id,'action',a.activity_type,'status',a.activity_type,'date',a.created_at,'entity_type',a.entity_type,'business_unit_id',a.business_unit_id,'activity_id',a.id)
 FROM public.activities a WHERE _kind='audit'
 ), filtered AS (
 SELECT * FROM records WHERE (_unit IS NULL OR business_unit_id=_unit) AND (_from IS NULL OR date>=_from::timestamptz)
 AND (_to IS NULL OR date<(_to+1)::timestamptz) AND (COALESCE(_status,'')='' OR status=_status)
 AND (COALESCE(_source,'')='' OR data->>'source'=_source)
 AND (COALESCE(btrim(_search),'')='' OR strpos(lower(data::text),lower(btrim(_search)))>0)
 ), page AS (SELECT * FROM filtered ORDER BY date DESC,id DESC OFFSET _offset LIMIT _limit)
 SELECT jsonb_build_object('total',(SELECT count(*) FROM filtered),'rows',COALESCE((SELECT jsonb_agg(data ORDER BY date DESC,id DESC) FROM page),'[]'::jsonb)) INTO result;
 RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.phase7_report(text,date,date,text,text,text,uuid,integer,integer) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.phase7_report(text,date,date,text,text,text,uuid,integer,integer) TO authenticated;
COMMIT;
