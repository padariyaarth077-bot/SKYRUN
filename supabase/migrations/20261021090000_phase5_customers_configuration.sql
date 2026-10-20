-- Proposal only. Applying this migration requires separate approval.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';

-- No service/service-area persistence exists in the base schema. One scoped
-- catalogue is sufficient; it adds no pricing, geography or public-site rules.
CREATE TABLE public.service_configuration (
 id uuid PRIMARY KEY,
 business_unit_id uuid NOT NULL REFERENCES public.business_units(id) ON DELETE RESTRICT,
 kind text NOT NULL CHECK(kind IN ('service','service_area')),
 name text NOT NULL CHECK(length(btrim(name)) BETWEEN 1 AND 100),
 description text NOT NULL DEFAULT '' CHECK(length(description)<=2000),
 is_active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_service_configuration_name ON public.service_configuration(business_unit_id,kind,lower(btrim(name)));
ALTER TABLE public.service_configuration ENABLE ROW LEVEL SECURITY;
CREATE POLICY service_configuration_read ON public.service_configuration FOR SELECT TO authenticated
 USING(public.is_staff() AND (public.is_super_admin() OR business_unit_id=ANY(public.current_user_business_unit_ids())));
REVOKE ALL ON public.service_configuration FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.service_configuration TO authenticated,service_role;

ALTER TABLE public.vehicles ADD COLUMN image_path text;
ALTER TABLE public.vehicle_categories ADD COLUMN image_path text;
ALTER TABLE public.vehicles ADD CONSTRAINT vehicles_image_path_check CHECK(image_path ~ '^/vehicle-images/[a-z0-9-]+\.(jpg|webp)$');
ALTER TABLE public.vehicle_categories ADD CONSTRAINT categories_image_path_check CHECK(image_path ~ '^/vehicle-images/[a-z0-9-]+\.(jpg|webp)$');

ALTER TABLE public.activities DROP CONSTRAINT activities_entity_type_check;
ALTER TABLE public.activities ADD CONSTRAINT activities_entity_type_check CHECK(entity_type IN (
 'lead','ride_request','quote','booking','customer','conversation','vehicle','vehicle_category','profile','user_role','service_configuration'));
CREATE UNIQUE INDEX uq_phase5_operation ON public.activities((metadata->>'phase5_operation_id')) WHERE metadata ? 'phase5_operation_id';

CREATE FUNCTION public.can_manage_operations(_business_unit_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM public.business_units WHERE id=_business_unit_id)
 AND (public.is_super_admin(auth.uid()) OR (
 EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND business_unit_id=_business_unit_id AND role IN ('ADMIN','MANAGER'))
 AND NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND business_unit_id=_business_unit_id AND role NOT IN ('ADMIN','MANAGER'))));
$$;

CREATE FUNCTION public.phase5_save(_kind text,_id uuid,_business_unit_id uuid,_payload jsonb,_expected_updated_at timestamptz,_operation_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE previous public.activities%ROWTYPE; unit uuid; version timestamptz; row_exists boolean; event_entity text;
BEGIN
 IF _kind IS NULL OR _kind NOT IN ('customer','service','service_area','vehicle','vehicle_category')
 OR _id IS NULL OR _operation_id IS NULL OR _payload IS NULL OR jsonb_typeof(_payload)<>'object'
 OR NOT public.can_manage_operations(_business_unit_id) THEN RAISE EXCEPTION 'operation unavailable'; END IF;
 -- Serialize retries before taking the entity lock; audit and mutation commit together.
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(_operation_id::text,5));
 SELECT * INTO previous FROM public.activities WHERE metadata->>'phase5_operation_id'=_operation_id::text;
 IF FOUND THEN
   IF previous.entity_id<>_id OR previous.business_unit_id<>_business_unit_id OR previous.actor_id IS DISTINCT FROM auth.uid()
    OR previous.metadata->>'kind' IS DISTINCT FROM _kind OR previous.metadata->'payload' IS DISTINCT FROM _payload
   THEN RAISE EXCEPTION 'operation conflict'; END IF;
   RETURN _id;
 END IF;
 IF _kind='customer' THEN
   SELECT business_unit_id,updated_at INTO unit,version FROM public.customers WHERE id=_id FOR UPDATE;
 ELSIF _kind='vehicle' THEN
   SELECT business_unit_id,updated_at INTO unit,version FROM public.vehicles WHERE id=_id FOR UPDATE;
 ELSIF _kind='vehicle_category' THEN
   SELECT business_unit_id,updated_at INTO unit,version FROM public.vehicle_categories WHERE id=_id FOR UPDATE;
 ELSE
   PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(_id::text,6));
   SELECT business_unit_id,updated_at INTO unit,version FROM public.service_configuration WHERE id=_id AND kind=_kind FOR UPDATE;
 END IF;
 row_exists:=FOUND;
 IF (row_exists AND (unit IS DISTINCT FROM _business_unit_id OR version IS DISTINCT FROM _expected_updated_at))
 OR (NOT row_exists AND (_kind IN ('customer','vehicle','vehicle_category') OR _expected_updated_at IS NOT NULL))
 THEN RAISE EXCEPTION 'record changed or unavailable'; END IF;
 IF _kind='customer' THEN
   IF (SELECT count(*) FROM jsonb_object_keys(_payload))<>5 OR NOT (_payload ?& ARRAY['full_name','email','phone','company_name','notes'])
    OR EXISTS(SELECT 1 FROM jsonb_each(_payload) WHERE jsonb_typeof(value)<>'string')
    OR length(btrim(_payload->>'full_name')) NOT BETWEEN 1 AND 200 OR length(_payload->>'email')>254
    OR ((_payload->>'email')<>'' AND (_payload->>'email') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
    OR ((_payload->>'phone')<>'' AND ((_payload->>'phone') !~ '^\+?[0-9 ().-]{7,30}$' OR length(regexp_replace(_payload->>'phone','[^0-9]','','g'))<7))
    OR length(_payload->>'company_name')>200 OR length(_payload->>'notes')>4000 THEN RAISE EXCEPTION 'invalid contact details'; END IF;
   UPDATE public.customers SET full_name=btrim(_payload->>'full_name'),email=nullif(lower(btrim(_payload->>'email')),''),
    phone=nullif(btrim(_payload->>'phone'),''),company_name=nullif(btrim(_payload->>'company_name'),''),notes=nullif(btrim(_payload->>'notes'),''),updated_at=clock_timestamp() WHERE id=_id;
   event_entity:='customer';
 ELSIF _kind IN ('vehicle','vehicle_category') THEN
   IF (SELECT count(*) FROM jsonb_object_keys(_payload))<>1 OR NOT (_payload ? 'image_path')
    OR (jsonb_typeof(_payload->'image_path') NOT IN ('string','null'))
    OR ((_payload->>'image_path') IS NOT NULL AND (_payload->>'image_path') !~ '^/vehicle-images/[a-z0-9-]+\.(jpg|webp)$') THEN RAISE EXCEPTION 'invalid image'; END IF;
   IF _kind='vehicle' THEN UPDATE public.vehicles SET image_path=_payload->>'image_path',updated_at=clock_timestamp() WHERE id=_id;
   ELSE UPDATE public.vehicle_categories SET image_path=_payload->>'image_path',updated_at=clock_timestamp() WHERE id=_id; END IF;
   event_entity:=_kind;
 ELSE
   IF (SELECT count(*) FROM jsonb_object_keys(_payload))<>3 OR NOT (_payload ?& ARRAY['name','description','is_active'])
    OR jsonb_typeof(_payload->'name')<>'string' OR jsonb_typeof(_payload->'description')<>'string' OR jsonb_typeof(_payload->'is_active')<>'boolean'
    OR length(btrim(_payload->>'name')) NOT BETWEEN 1 AND 100 OR length(_payload->>'description')>2000 THEN RAISE EXCEPTION 'invalid configuration'; END IF;
   IF row_exists THEN UPDATE public.service_configuration SET name=btrim(_payload->>'name'),description=btrim(_payload->>'description'),is_active=(_payload->>'is_active')::boolean,updated_at=clock_timestamp() WHERE id=_id;
   ELSE INSERT INTO public.service_configuration(id,business_unit_id,kind,name,description,is_active) VALUES(_id,_business_unit_id,_kind,btrim(_payload->>'name'),btrim(_payload->>'description'),(_payload->>'is_active')::boolean); END IF;
   event_entity:='service_configuration';
 END IF;
 INSERT INTO public.activities(business_unit_id,entity_type,entity_id,activity_type,actor_id,description,metadata)
 VALUES(_business_unit_id,event_entity,_id,'PHASE5_SAVED',auth.uid(),'Staff saved '||replace(_kind,'_',' '),
 jsonb_build_object('phase5_operation_id',_operation_id,'kind',_kind,'payload',_payload));
 RETURN _id;
END;
$$;
-- Customer intake by existing trusted server/definer paths remains intact.
REVOKE ALL ON public.customers FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.customers TO authenticated;

-- Existing fleet CRUD policies remain. Protect only the newly controlled image.
CREATE FUNCTION public.protect_fleet_image() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF current_user <> 'postgres' AND ((TG_OP='INSERT' AND NEW.image_path IS NOT NULL) OR (TG_OP='UPDATE' AND NEW.image_path IS DISTINCT FROM OLD.image_path))
 THEN RAISE EXCEPTION 'use controlled image operation'; END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER protect_vehicle_image BEFORE INSERT OR UPDATE ON public.vehicles FOR EACH ROW EXECUTE FUNCTION public.protect_fleet_image();
CREATE TRIGGER protect_category_image BEFORE INSERT OR UPDATE ON public.vehicle_categories FOR EACH ROW EXECUTE FUNCTION public.protect_fleet_image();
REVOKE ALL ON FUNCTION public.protect_fleet_image() FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.can_manage_operations(uuid),public.phase5_save(text,uuid,uuid,jsonb,timestamptz,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.can_manage_operations(uuid),public.phase5_save(text,uuid,uuid,jsonb,timestamptz,uuid) TO authenticated;
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
    IF _metadata ? 'phase4_operation_id' OR _metadata ? 'phase5_operation_id' OR _metadata ? 'authoritative'
      OR _activity_type LIKE 'BOOKING_%' OR _activity_type LIKE 'DEPOSIT_%' OR _activity_type LIKE 'PHASE5_%'
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


COMMIT;
