-- Prepared Phase 6 migration. Separate approval required before local or hosted execution.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
-- Do not invent dates or silently skip legacy messages when introducing keyset paging.
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.conversation_messages WHERE created_at IS NULL)
 THEN RAISE EXCEPTION 'Phase 6 requires review of chat messages with missing timestamps'; END IF;
END $$;
ALTER TABLE public.conversation_messages ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE public.conversations ADD COLUMN staff_read_message_id uuid;
ALTER TABLE public.conversation_messages ADD COLUMN client_operation_id uuid;
CREATE UNIQUE INDEX uq_chat_message_operation ON public.conversation_messages(conversation_id,client_operation_id) WHERE client_operation_id IS NOT NULL;
CREATE INDEX ix_chat_customer_latest ON public.conversation_messages(conversation_id,sender_type,created_at DESC,id DESC);
CREATE UNIQUE INDEX uq_phase6_operation ON public.activities((metadata->>'phase6_operation_id')) WHERE metadata ? 'phase6_operation_id';

CREATE FUNCTION public.can_handle_chat(_business_unit_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND (public.is_super_admin(auth.uid()) OR (
 EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND business_unit_id=_business_unit_id AND role IN ('ADMIN','MANAGER','SUPPORT','DISPATCHER'))
 AND NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND business_unit_id=_business_unit_id AND role NOT IN ('ADMIN','MANAGER','SUPPORT','DISPATCHER'))));
$$;

CREATE VIEW public.chat_inbox WITH (security_invoker=true) AS
 SELECT c.id,c.business_unit_id,c.status,c.assigned_to,c.handoff_requested_at,c.updated_at,c.lead_id,c.customer_id,
 cu.full_name AS customer_name,cu.email AS customer_email,cu.phone AS customer_phone,l.lead_number,
 latest.id AS last_customer_message_id,
 (latest.id IS NOT NULL AND latest.id IS DISTINCT FROM c.staff_read_message_id) AS unread,
 public.can_handle_chat(c.business_unit_id) AS can_handle
 FROM public.conversations c
 LEFT JOIN public.customers cu ON cu.id=c.customer_id AND cu.business_unit_id=c.business_unit_id
 LEFT JOIN public.leads l ON l.id=c.lead_id AND l.business_unit_id=c.business_unit_id
 LEFT JOIN LATERAL (SELECT m.id FROM public.conversation_messages m WHERE m.conversation_id=c.id AND m.sender_type='CUSTOMER' ORDER BY m.created_at DESC,m.id DESC LIMIT 1) latest ON true
 WHERE c.channel='CHAT_WIDGET';
REVOKE ALL ON public.chat_inbox FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.chat_inbox TO authenticated;
-- Keep staff reads scoped by existing RLS; never expose the visitor capability hash.
REVOKE ALL ON public.conversations,public.conversation_messages FROM PUBLIC,anon,authenticated;
GRANT SELECT(id,business_unit_id,lead_id,customer_id,channel,status,assigned_to,handoff_requested_at,visitor_last_read_at,staff_read_message_id,started_at,ended_at,created_at,updated_at) ON public.conversations TO authenticated;
GRANT SELECT ON public.conversation_messages TO authenticated;

CREATE FUNCTION public.chat_message_page(_conversation_id uuid,_before_created_at timestamptz,_before_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 WITH page AS (
 SELECT id,sender_type,message,created_at FROM public.conversation_messages
 WHERE conversation_id=_conversation_id AND (_before_id IS NULL OR (created_at,id)<(_before_created_at,_before_id))
 ORDER BY created_at DESC,id DESC LIMIT 101
 ), shown AS (SELECT * FROM page ORDER BY created_at DESC,id DESC LIMIT 100)
 SELECT jsonb_build_object('messages',COALESCE((SELECT jsonb_agg(to_jsonb(shown) ORDER BY created_at,id) FROM shown),'[]'::jsonb),'has_more',(SELECT count(*)>100 FROM page));
$$;

CREATE FUNCTION public.chat_load_page(_session_token_hash text,_before_created_at timestamptz,_before_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.conversations%ROWTYPE;
BEGIN
 IF _session_token_hash IS NULL OR _session_token_hash !~ '^[a-f0-9]{64}$' OR ((_before_id IS NULL)<>(_before_created_at IS NULL)) THEN RAISE EXCEPTION 'chat unavailable'; END IF;
 SELECT * INTO c FROM public.conversations WHERE session_token_hash=_session_token_hash AND channel='CHAT_WIDGET' FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'chat unavailable'; END IF;
 RETURN public.chat_message_page(c.id,_before_created_at,_before_id) || jsonb_build_object('conversation',jsonb_build_object(
 'id',c.id,'status',c.status,'assigned_to',c.assigned_to,'handoff_requested_at',c.handoff_requested_at,
 'lead_id',c.lead_id,'customer_id',c.customer_id,'updated_at',c.updated_at));
END;
$$;

CREATE FUNCTION public.chat_staff_load(_conversation_id uuid,_before_created_at timestamptz,_before_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.conversations%ROWTYPE; latest uuid;
BEGIN
 SELECT * INTO c FROM public.conversations WHERE id=_conversation_id AND channel='CHAT_WIDGET' FOR SHARE;
 IF NOT FOUND OR NOT public.is_staff() OR (NOT public.is_super_admin() AND (c.business_unit_id=ANY(public.current_user_business_unit_ids())) IS NOT TRUE)
 OR ((_before_id IS NULL)<>(_before_created_at IS NULL)) THEN RAISE EXCEPTION 'chat unavailable'; END IF;
 SELECT id INTO latest FROM public.conversation_messages WHERE conversation_id=c.id AND sender_type='CUSTOMER' ORDER BY created_at DESC,id DESC LIMIT 1;
 RETURN public.chat_message_page(c.id,_before_created_at,_before_id) || jsonb_build_object('last_customer_message_id',latest,
 'can_handle',public.can_handle_chat(c.business_unit_id),'conversation',jsonb_build_object('id',c.id,'status',c.status,'assigned_to',c.assigned_to,
 'handoff_requested_at',c.handoff_requested_at,'lead_id',c.lead_id,'customer_id',c.customer_id,'updated_at',c.updated_at));
END;
$$;

CREATE FUNCTION public.chat_mark_read(_conversation_id uuid,_last_customer_message_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.conversations%ROWTYPE; latest uuid;
BEGIN
 SELECT * INTO c FROM public.conversations WHERE id=_conversation_id AND channel='CHAT_WIDGET' FOR UPDATE;
 IF NOT FOUND OR NOT public.can_handle_chat(c.business_unit_id) THEN RAISE EXCEPTION 'chat unavailable'; END IF;
 SELECT id INTO latest FROM public.conversation_messages WHERE conversation_id=c.id AND sender_type='CUSTOMER' ORDER BY created_at DESC,id DESC LIMIT 1;
 -- A message arriving after the loaded page must stay unread for the team.
 IF latest IS NOT NULL AND latest=_last_customer_message_id AND c.staff_read_message_id IS DISTINCT FROM latest
 THEN UPDATE public.conversations SET staff_read_message_id=latest WHERE id=c.id; END IF;
 RETURN latest IS NOT NULL AND latest IS NOT DISTINCT FROM _last_customer_message_id;
END;
$$;

CREATE FUNCTION public.chat_send_message(_session_token_hash text,_operation_id uuid,_message text,_reply text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.conversations%ROWTYPE; saved public.conversation_messages%ROWTYPE; reply_text text;
BEGIN
 IF _session_token_hash IS NULL OR _session_token_hash !~ '^[a-f0-9]{64}$' OR _operation_id IS NULL
 OR _message IS NULL OR length(btrim(_message)) NOT BETWEEN 1 AND 1500 OR _reply IS NULL OR length(btrim(_reply)) NOT BETWEEN 1 AND 1500
 THEN RAISE EXCEPTION 'invalid chat message'; END IF;
 SELECT * INTO c FROM public.conversations WHERE session_token_hash=_session_token_hash AND channel='CHAT_WIDGET' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'chat unavailable'; END IF;
 SELECT * INTO saved FROM public.conversation_messages WHERE conversation_id=c.id AND client_operation_id=_operation_id;
 IF FOUND THEN
   IF saved.sender_type<>'CUSTOMER' OR saved.message IS DISTINCT FROM btrim(_message) THEN RAISE EXCEPTION 'operation conflict'; END IF;
   SELECT message INTO reply_text FROM public.conversation_messages WHERE conversation_id=c.id AND sender_type='BOT' AND metadata->>'in_reply_to'=saved.id::text;
   RETURN jsonb_build_object('conversation_id',c.id,'status',c.status,'message_id',saved.id,'reply',reply_text);
 END IF;
 IF c.status IN ('CLOSED','RESOLVED') THEN RAISE EXCEPTION 'chat closed'; END IF;
 IF EXISTS(SELECT 1 FROM public.conversation_messages WHERE conversation_id=c.id AND sender_type='CUSTOMER' AND created_at>clock_timestamp()-interval '2 seconds') THEN RAISE EXCEPTION 'please wait before sending another message'; END IF;
 INSERT INTO public.conversation_messages(conversation_id,sender_type,message,client_operation_id,created_at)
 VALUES(c.id,'CUSTOMER',btrim(_message),_operation_id,clock_timestamp()) RETURNING * INTO saved;
 IF c.status IN ('AI_HANDLING','OPEN') THEN
   reply_text:=btrim(_reply);
   INSERT INTO public.conversation_messages(conversation_id,sender_type,message,metadata,created_at)
   VALUES(c.id,'BOT',reply_text,jsonb_build_object('in_reply_to',saved.id),clock_timestamp());
 END IF;
 UPDATE public.conversations SET status=CASE WHEN c.status='WAITING_FOR_CUSTOMER' THEN 'HUMAN_HANDLING' ELSE c.status END,updated_at=clock_timestamp() WHERE id=c.id RETURNING * INTO c;
 RETURN jsonb_build_object('conversation_id',c.id,'status',c.status,'message_id',saved.id,'reply',reply_text);
END;
$$;

CREATE FUNCTION public.chat_staff_action(_conversation_id uuid,_operation_id uuid,_action text,_message text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.conversations%ROWTYPE; previous public.activities%ROWTYPE; payload_hash text; message_id uuid;
BEGIN
 IF _conversation_id IS NULL OR _operation_id IS NULL OR _action IS NULL OR _action NOT IN ('claim','reply','resolve') OR _message IS NULL
 OR (_action='reply' AND length(btrim(_message)) NOT BETWEEN 1 AND 1500) OR (_action<>'reply' AND _message<>'') THEN RAISE EXCEPTION 'invalid chat operation'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(_operation_id::text,6));
 SELECT * INTO c FROM public.conversations WHERE id=_conversation_id AND channel='CHAT_WIDGET' FOR UPDATE;
 IF NOT FOUND OR NOT public.can_handle_chat(c.business_unit_id) THEN RAISE EXCEPTION 'chat unavailable'; END IF;
 payload_hash:=encode(sha256(convert_to(btrim(_message),'UTF8')),'hex');
 SELECT * INTO previous FROM public.activities WHERE metadata->>'phase6_operation_id'=_operation_id::text;
 IF FOUND THEN
   IF previous.entity_id<>c.id OR previous.actor_id IS DISTINCT FROM auth.uid() OR previous.metadata->>'action' IS DISTINCT FROM _action OR previous.metadata->>'payload_hash' IS DISTINCT FROM payload_hash
   THEN RAISE EXCEPTION 'operation conflict'; END IF;
   RETURN c.id;
 END IF;
 IF c.status IN ('CLOSED','RESOLVED') THEN RAISE EXCEPTION 'chat closed'; END IF;
 IF _action='claim' THEN
   IF c.assigned_to=auth.uid() AND c.status IN ('HUMAN_HANDLING','WAITING_FOR_CUSTOMER') THEN RETURN c.id; END IF;
   IF c.assigned_to IS NOT NULL AND c.assigned_to<>auth.uid() THEN RAISE EXCEPTION 'conversation already assigned'; END IF;
   UPDATE public.conversations SET assigned_to=auth.uid(),status='HUMAN_HANDLING',updated_at=clock_timestamp() WHERE id=c.id;
 ELSE
   IF c.assigned_to IS DISTINCT FROM auth.uid() OR c.status NOT IN ('HUMAN_HANDLING','WAITING_FOR_CUSTOMER') THEN RAISE EXCEPTION 'take over this conversation first'; END IF;
   IF _action='reply' THEN
     INSERT INTO public.conversation_messages(conversation_id,sender_type,message,client_operation_id,metadata,created_at)
     VALUES(c.id,'ADMIN',btrim(_message),_operation_id,jsonb_build_object('actor_id',auth.uid()),clock_timestamp()) RETURNING id INTO message_id;
     UPDATE public.conversations SET status='WAITING_FOR_CUSTOMER',updated_at=clock_timestamp() WHERE id=c.id;
   ELSE
     UPDATE public.conversations SET status='RESOLVED',ended_at=clock_timestamp(),updated_at=clock_timestamp() WHERE id=c.id;
   END IF;
 END IF;
 INSERT INTO public.activities(business_unit_id,entity_type,entity_id,activity_type,actor_id,description,metadata)
 VALUES(c.business_unit_id,'conversation',c.id,'CHAT_'||upper(_action),auth.uid(),'Staff chat '||_action,
 jsonb_build_object('phase6_operation_id',_operation_id,'action',_action,'payload_hash',payload_hash,'message_id',message_id,'authoritative',true));
 RETURN c.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.chat_request_handoff(_session_token_hash text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.conversations%ROWTYPE;
BEGIN
 IF _session_token_hash IS NULL OR _session_token_hash !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'chat unavailable'; END IF;
 SELECT * INTO c FROM public.conversations WHERE session_token_hash=_session_token_hash AND channel='CHAT_WIDGET' FOR UPDATE;
 IF NOT FOUND OR c.status IN ('CLOSED','RESOLVED') THEN RAISE EXCEPTION 'chat unavailable'; END IF;
 IF c.status NOT IN ('HANDOFF_REQUESTED','HUMAN_HANDLING','WAITING_FOR_CUSTOMER') THEN
   UPDATE public.conversations SET status='HANDOFF_REQUESTED',handoff_requested_at=COALESCE(handoff_requested_at,clock_timestamp()),updated_at=clock_timestamp() WHERE id=c.id RETURNING * INTO c;
   INSERT INTO public.conversation_messages(conversation_id,sender_type,message) VALUES(c.id,'SYSTEM','Visitor requested human support.');
   INSERT INTO public.activities(business_unit_id,entity_type,entity_id,activity_type,description,metadata)
   VALUES(c.business_unit_id,'conversation',c.id,'CHAT_HANDOFF','Visitor requested human support',jsonb_build_object('authoritative',true));
 END IF;
 RETURN jsonb_build_object('conversation_id',c.id,'status',c.status);
END;
$$;

-- Internal paging is never a public capability. Public visitor RPCs require the trusted server.
REVOKE ALL ON FUNCTION public.chat_message_page(uuid,timestamptz,uuid) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.chat_load_page(text,timestamptz,uuid),public.chat_send_message(text,uuid,text,text),public.chat_start_conversation(uuid,text),public.chat_load_conversation(text),public.chat_append_visitor_message(text,text),public.chat_append_bot_message(text,text),public.chat_request_handoff(text),public.chat_capture_contact(text,text,text,text,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.chat_load_page(text,timestamptz,uuid),public.chat_send_message(text,uuid,text,text),public.chat_start_conversation(uuid,text),public.chat_load_conversation(text),public.chat_append_visitor_message(text,text),public.chat_append_bot_message(text,text),public.chat_request_handoff(text),public.chat_capture_contact(text,text,text,text,text) TO service_role;
REVOKE ALL ON FUNCTION public.can_handle_chat(uuid),public.chat_staff_load(uuid,timestamptz,uuid),public.chat_mark_read(uuid,uuid),public.chat_staff_action(uuid,uuid,text,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.can_handle_chat(uuid),public.chat_staff_load(uuid,timestamptz,uuid),public.chat_mark_read(uuid,uuid),public.chat_staff_action(uuid,uuid,text,text) TO authenticated;
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
    IF _metadata ? 'phase4_operation_id' OR _metadata ? 'phase5_operation_id' OR _metadata ? 'phase6_operation_id' OR _metadata ? 'authoritative'
      OR _activity_type LIKE 'BOOKING_%' OR _activity_type LIKE 'DEPOSIT_%' OR _activity_type LIKE 'PHASE5_%' OR _activity_type LIKE 'CHAT_%'
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
 reference:='SR-'||replace(pg_catalog.gen_random_uuid()::text,'-','');
 INSERT INTO public.leads(business_unit_id,customer_id,lead_number,source,status,priority,subject,message)
 VALUES(c.business_unit_id,customer,reference,'CHATBOT','NEW','NORMAL','Chat enquiry',COALESCE(NULLIF(_trip_details,''),'Chat contact details provided')) RETURNING id INTO lead;
 UPDATE public.conversations SET customer_id=customer,lead_id=lead,updated_at=clock_timestamp() WHERE id=c.id;
 INSERT INTO public.activities(business_unit_id,entity_type,entity_id,activity_type,description)
 VALUES(c.business_unit_id,'lead',lead,'CREATED','Lead created from CHATBOT conversation');
 RETURN jsonb_build_object('ok',true,'reference',reference);
END;
$$;
COMMIT;
