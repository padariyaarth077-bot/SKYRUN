-- Phase 8 proposal. Apply only after explicit approval to a named environment.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
CREATE TABLE public.notification_preferences (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE RESTRICT,
 in_app boolean NOT NULL DEFAULT true, sound boolean NOT NULL DEFAULT true,
 volume numeric NOT NULL DEFAULT 0.35 CHECK(volume BETWEEN 0 AND 1),
 normal boolean NOT NULL DEFAULT true, important boolean NOT NULL DEFAULT true, urgent boolean NOT NULL DEFAULT true,
 categories jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(categories)='object'),
 email_urgent boolean NOT NULL DEFAULT false, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.staff_notifications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), seq bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
 recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 business_unit_id uuid NOT NULL REFERENCES public.business_units(id) ON DELETE RESTRICT,
 source_key text NOT NULL CHECK(length(source_key)<=200), kind text NOT NULL CHECK(kind IN ('RIDE_ENQUIRY','CONTACT_MESSAGE','CHAT_MESSAGE','CHAT_HANDOFF','BOOKING_CREATED','BOOKING_CONFIRMED','BOOKING_CANCELLED','DEPOSIT_VERIFIED','PAYMENT_EXCEPTION','COMMUNICATION_FAILED')),
 severity text NOT NULL CHECK(severity IN ('NORMAL','IMPORTANT','URGENT')),
 title text NOT NULL CHECK(length(title)<=160), entity_type text NOT NULL CHECK(entity_type IN ('lead','booking','conversation')),
 entity_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), read_at timestamptz,
 UNIQUE(recipient_id,source_key)
);
CREATE INDEX ix_notification_recipient ON public.staff_notifications(recipient_id,seq DESC);
CREATE INDEX ix_notification_unread ON public.staff_notifications(recipient_id,seq DESC) WHERE read_at IS NULL;
CREATE TABLE public.communication_outbox (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_unit_id uuid NOT NULL REFERENCES public.business_units(id) ON DELETE RESTRICT,
 source_key text NOT NULL, recipient_key text NOT NULL, kind text NOT NULL CHECK(kind IN ('BOOKING_CONFIRMED','BOOKING_CANCELLED','STAFF_URGENT')),
 entity_type text NOT NULL CHECK(entity_type IN ('booking','conversation')), entity_id uuid NOT NULL,
 customer_id uuid REFERENCES public.customers(id), staff_id uuid REFERENCES auth.users(id),
 recipient text, payload jsonb NOT NULL, subject text, message_text text, message_html text, state text NOT NULL DEFAULT 'QUEUED' CHECK(state IN ('QUEUED','PROCESSING','PROVIDER_ACCEPTED','DELIVERED','FAILED','RECONCILE','CANCELLED')),
 attempts int NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 3), attempt_id uuid, lease_until timestamptz,
 first_attempt_at timestamptz, next_attempt_at timestamptz NOT NULL DEFAULT now(), last_attempt_at timestamptz,
 provider_email_id uuid UNIQUE, failure_category text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK((customer_id IS NULL) <> (staff_id IS NULL)), UNIQUE(source_key,recipient_key)
);
CREATE INDEX ix_communication_pending ON public.communication_outbox(next_attempt_at,created_at) WHERE state IN ('QUEUED','PROCESSING','FAILED');
CREATE INDEX ix_communication_unit ON public.communication_outbox(business_unit_id,created_at DESC);
CREATE TABLE public.communication_events (
 event_id text PRIMARY KEY CHECK(length(event_id) BETWEEN 1 AND 200), provider_email_id uuid NOT NULL,
 kind text NOT NULL CHECK(kind IN ('email.delivered','email.bounced','email.failed','email.complained','email.suppressed')),
 recipient text NOT NULL, sender text NOT NULL, payload_hash text NOT NULL CHECK(payload_hash ~ '^[a-f0-9]{64}$'), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_communication_provider_event ON public.communication_events(provider_email_id);

CREATE FUNCTION public.phase8_audience(_user uuid,_unit uuid,_kind text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT _user IS NOT NULL AND (public.is_super_admin(_user) OR (
 EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user AND business_unit_id=_unit AND role::text=ANY(
 CASE WHEN _kind IN ('DEPOSIT_VERIFIED','PAYMENT_EXCEPTION','COMMUNICATION_FAILED','BOOKING_CREATED') THEN ARRAY['ADMIN','MANAGER'] ELSE ARRAY['ADMIN','MANAGER','SUPPORT','DISPATCHER'] END))
 AND NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user AND business_unit_id=_unit AND role::text<>ALL(
 CASE WHEN _kind IN ('DEPOSIT_VERIFIED','PAYMENT_EXCEPTION','COMMUNICATION_FAILED','BOOKING_CREATED') THEN ARRAY['ADMIN','MANAGER'] ELSE ARRAY['ADMIN','MANAGER','SUPPORT','DISPATCHER'] END))));
$$;
CREATE FUNCTION public.phase8_can_read(_unit uuid,_kind text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT public.phase8_audience(auth.uid(),_unit,_kind); $$;
ALTER TABLE public.staff_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_notification_read ON public.staff_notifications FOR SELECT TO authenticated USING(recipient_id=auth.uid() AND public.phase8_can_read(business_unit_id,kind));
CREATE POLICY own_preferences_read ON public.notification_preferences FOR SELECT TO authenticated USING(user_id=auth.uid() AND public.is_staff());
CREATE POLICY managed_communication_read ON public.communication_outbox FOR SELECT TO authenticated USING(public.can_manage_booking(business_unit_id));
REVOKE ALL ON public.staff_notifications,public.notification_preferences,public.communication_outbox,public.communication_events FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.staff_notifications,public.notification_preferences,public.communication_outbox TO authenticated;

CREATE FUNCTION public.phase8_emit(_unit uuid,_key text,_kind text,_severity text,_title text,_entity text,_id uuid,_actor uuid DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 INSERT INTO public.staff_notifications(recipient_id,business_unit_id,source_key,kind,severity,title,entity_type,entity_id)
 SELECT DISTINCT ur.user_id,_unit,_key,_kind,_severity,_title,_entity,_id FROM public.user_roles ur
 WHERE (ur.business_unit_id=_unit OR ur.role='SUPER_ADMIN') AND public.phase8_audience(ur.user_id,_unit,_kind) AND ur.user_id IS DISTINCT FROM _actor
 ON CONFLICT(recipient_id,source_key) DO NOTHING;
 IF _kind IN ('CHAT_HANDOFF','PAYMENT_EXCEPTION') THEN
 INSERT INTO public.communication_outbox(business_unit_id,source_key,recipient_key,kind,entity_type,entity_id,staff_id,recipient,payload)
 SELECT DISTINCT _unit,_key,'staff/'||n.recipient_id,'STAFF_URGENT',_entity,_id,n.recipient_id,lower(u.email),jsonb_build_object('title',_title,'reference',_id,'eventKind',_kind)
 FROM public.staff_notifications n JOIN public.notification_preferences p ON p.user_id=n.recipient_id AND p.email_urgent
 JOIN auth.users u ON u.id=n.recipient_id AND u.email_confirmed_at IS NOT NULL
 WHERE n.source_key=_key AND n.business_unit_id=_unit AND u.email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
 ON CONFLICT(source_key,recipient_key) DO NOTHING;
 END IF;
END;
$$;
CREATE FUNCTION public.phase8_source_event() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE unit uuid; kind text; severity text:='NORMAL'; title text; entity text; entity_id uuid; actor uuid; source text;
 b public.bookings%ROWTYPE; c public.customers%ROWTYPE; conversation public.conversations%ROWTYPE;
BEGIN
 IF TG_TABLE_NAME='leads' THEN
   IF NEW.source NOT IN ('RIDE_ENQUIRY','CONTACT_FORM') THEN RETURN NEW; END IF;
   unit:=NEW.business_unit_id; kind:=CASE NEW.source WHEN 'RIDE_ENQUIRY' THEN 'RIDE_ENQUIRY' ELSE 'CONTACT_MESSAGE' END;
   title:=CASE NEW.source WHEN 'RIDE_ENQUIRY' THEN 'New ride enquiry' ELSE 'New contact message' END;
   entity:='lead';entity_id:=NEW.id;
   source:='lead/'||NEW.id;
 ELSIF TG_TABLE_NAME='conversation_messages' THEN
   IF NEW.sender_type<>'CUSTOMER' THEN RETURN NEW; END IF;
   SELECT * INTO conversation FROM public.conversations WHERE id=NEW.conversation_id AND channel='CHAT_WIDGET';
   IF NOT FOUND THEN RETURN NEW; END IF;
   unit:=conversation.business_unit_id; kind:='CHAT_MESSAGE';title:='New customer chat message';entity:='conversation';entity_id:=NEW.conversation_id;source:='message/'||NEW.id;
 ELSE
   unit:=NEW.business_unit_id; entity:=NEW.entity_type;entity_id:=NEW.entity_id;actor:=NEW.actor_id; source:='activity/'||NEW.id;
   IF NEW.entity_type='conversation' AND NEW.activity_type='CHAT_HANDOFF' AND NEW.metadata->'authoritative'='true'::jsonb THEN
     kind:='CHAT_HANDOFF';severity:='IMPORTANT';title:='Customer requested human support';
   ELSIF NEW.entity_type='booking' THEN
     SELECT * INTO b FROM public.bookings WHERE id=NEW.entity_id AND business_unit_id=unit;
     IF NOT FOUND THEN RETURN NEW; END IF;
     IF NEW.activity_type='CREATED' AND b.status='PENDING' AND EXISTS(SELECT 1 FROM public.quote_acceptance_links l JOIN public.quotes q ON q.id=l.quote_id WHERE l.id::text=NEW.metadata->>'link_id' AND l.booking_id=b.id AND l.accepted_at IS NOT NULL AND q.status='ACCEPTED' AND q.business_unit_id=unit) THEN
       kind:='BOOKING_CREATED';severity:='IMPORTANT';title:='Quote accepted — pending booking created';
     ELSIF NEW.metadata->'authoritative'='true'::jsonb AND NEW.metadata ? 'phase4_operation_id' THEN
       CASE NEW.activity_type
        WHEN 'BOOKING_CONFIRMED' THEN IF b.status<>'CONFIRMED' THEN RETURN NEW; END IF;kind:='BOOKING_CONFIRMED';severity:='IMPORTANT';title:='Booking confirmed';
        WHEN 'BOOKING_CANCELLED' THEN IF b.status<>'CANCELLED' THEN RETURN NEW; END IF;kind:='BOOKING_CANCELLED';severity:='IMPORTANT';title:='Booking cancelled';
        WHEN 'DEPOSIT_VERIFIED' THEN kind:='DEPOSIT_VERIFIED';title:='Deposit evidence verified';
        WHEN 'DEPOSIT_REVERSED' THEN kind:='PAYMENT_EXCEPTION';severity:='URGENT';title:='Payment evidence reversed — review booking';
        ELSE RETURN NEW;
       END CASE;
     ELSE RETURN NEW; END IF;
   ELSE RETURN NEW; END IF;
 END IF;
 PERFORM public.phase8_emit(unit,source,kind,severity,title,entity,entity_id,actor);
 IF TG_TABLE_NAME='activities' AND kind IN ('BOOKING_CONFIRMED','BOOKING_CANCELLED') THEN
   SELECT * INTO c FROM public.customers WHERE id=b.customer_id AND business_unit_id=unit;
   INSERT INTO public.communication_outbox(business_unit_id,source_key,recipient_key,kind,entity_type,entity_id,customer_id,recipient,payload,state,failure_category)
   VALUES(unit,source,'customer/'||c.id,kind,'booking',b.id,c.id,lower(c.email),
    jsonb_build_object('reference',b.booking_number,'name',c.full_name,'status',b.status,'travelDate',b.travel_date,'pickupTime',b.pickup_time,'pickup',b.pickup_location,'dropoff',b.dropoff_location),
    CASE WHEN c.email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN 'QUEUED' ELSE 'FAILED' END,
    CASE WHEN c.email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN NULL ELSE 'MISSING_RECIPIENT' END)
   ON CONFLICT(source_key,recipient_key) DO NOTHING;
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER phase8_lead_event AFTER INSERT ON public.leads FOR EACH ROW EXECUTE FUNCTION public.phase8_source_event();
CREATE TRIGGER phase8_chat_event AFTER INSERT ON public.conversation_messages FOR EACH ROW EXECUTE FUNCTION public.phase8_source_event();
CREATE TRIGGER phase8_activity_event AFTER INSERT ON public.activities FOR EACH ROW EXECUTE FUNCTION public.phase8_source_event();

CREATE FUNCTION public.phase8_snapshot() RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT jsonb_build_object('rows',COALESCE((SELECT jsonb_agg(to_jsonb(s)) FROM (SELECT id,seq::text,business_unit_id,kind,severity,title,entity_type,entity_id,created_at,read_at FROM public.staff_notifications ORDER BY seq DESC LIMIT 50) s),'[]'::jsonb),
 'unread',(SELECT count(*) FROM public.staff_notifications WHERE read_at IS NULL),'through',COALESCE((SELECT max(seq)::text FROM public.staff_notifications),'0'),
 'preferences',COALESCE((SELECT to_jsonb(p)-'user_id' FROM public.notification_preferences p WHERE user_id=auth.uid()),'{}'::jsonb));
$$;
CREATE FUNCTION public.phase8_user_action(_action text,_id uuid DEFAULT NULL,_through bigint DEFAULT NULL,_preferences jsonb DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE p jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_staff() THEN RAISE EXCEPTION 'staff access required'; END IF;
 IF _action='read' THEN
   UPDATE public.staff_notifications SET read_at=COALESCE(read_at,now()) WHERE id=_id AND recipient_id=auth.uid() AND public.phase8_can_read(business_unit_id,kind);
 ELSIF _action='read_all' THEN
   IF _through IS NULL OR _through<0 THEN RAISE EXCEPTION 'invalid read boundary'; END IF;
   UPDATE public.staff_notifications SET read_at=COALESCE(read_at,now()) WHERE recipient_id=auth.uid() AND seq<=_through AND public.phase8_can_read(business_unit_id,kind);
 ELSIF _action='preferences' THEN
   p:=_preferences;
   IF p IS NULL OR jsonb_typeof(p)<>'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(p) k WHERE k<>ALL(ARRAY['in_app','sound','volume','normal','important','urgent','categories','email_urgent']))
   OR NOT(p ?& ARRAY['in_app','sound','volume','normal','important','urgent','categories','email_urgent'])
   OR EXISTS(SELECT 1 FROM jsonb_each(p) v WHERE v.key NOT IN ('volume','categories') AND jsonb_typeof(v.value)<>'boolean')
   OR jsonb_typeof(p->'volume')<>'number' OR NOT((p->>'volume')::numeric BETWEEN 0 AND 1)
   OR jsonb_typeof(p->'categories')<>'object' THEN RAISE EXCEPTION 'invalid preferences'; END IF;
   IF EXISTS(SELECT 1 FROM jsonb_each(p->'categories') v WHERE v.key<>ALL(ARRAY['RIDE_ENQUIRY','CONTACT_MESSAGE','CHAT_MESSAGE','CHAT_HANDOFF','BOOKING_CREATED','BOOKING_CONFIRMED','BOOKING_CANCELLED','DEPOSIT_VERIFIED','PAYMENT_EXCEPTION','COMMUNICATION_FAILED']) OR jsonb_typeof(v.value)<>'boolean') THEN RAISE EXCEPTION 'invalid categories'; END IF;
   PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text,8));
   IF EXISTS(SELECT 1 FROM public.notification_preferences x WHERE x.user_id=auth.uid() AND (to_jsonb(x)-'user_id'-'updated_at')=p) THEN RETURN; END IF;
   INSERT INTO public.notification_preferences(user_id,in_app,sound,volume,normal,important,urgent,categories,email_urgent)
   VALUES(auth.uid(),(p->>'in_app')::boolean,(p->>'sound')::boolean,(p->>'volume')::numeric,(p->>'normal')::boolean,(p->>'important')::boolean,(p->>'urgent')::boolean,p->'categories',(p->>'email_urgent')::boolean)
   ON CONFLICT(user_id) DO UPDATE SET in_app=excluded.in_app,sound=excluded.sound,volume=excluded.volume,normal=excluded.normal,important=excluded.important,urgent=excluded.urgent,categories=excluded.categories,email_urgent=excluded.email_urgent,updated_at=clock_timestamp();
   INSERT INTO public.activities(business_unit_id,entity_type,entity_id,activity_type,actor_id,description,metadata)
   SELECT COALESCE(business_unit_id,(SELECT id FROM public.business_units ORDER BY id LIMIT 1)),'profile',auth.uid(),'NOTIFICATION_PREFERENCES_UPDATED',auth.uid(),'Own notification preferences updated',jsonb_build_object('authoritative',true) FROM public.user_roles WHERE user_id=auth.uid() ORDER BY business_unit_id NULLS LAST LIMIT 1;
 ELSE RAISE EXCEPTION 'invalid notification action'; END IF;
END;
$$;

CREATE FUNCTION public.phase8_retry(_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.communication_outbox%ROWTYPE;
BEGIN
 SELECT * INTO c FROM public.communication_outbox WHERE id=_id FOR UPDATE;
 IF NOT FOUND OR NOT public.can_manage_booking(c.business_unit_id) THEN RAISE EXCEPTION 'communication unavailable'; END IF;
 IF c.state='QUEUED' THEN RETURN; END IF;
 IF c.state<>'FAILED' OR c.attempts>=3 OR c.recipient IS NULL OR c.failure_category='MISSING_RECIPIENT' OR c.provider_email_id IS NOT NULL OR c.first_attempt_at<now()-interval '23 hours' THEN RAISE EXCEPTION 'retry unavailable; reconciliation may be required'; END IF;
 UPDATE public.communication_outbox SET state='QUEUED',next_attempt_at=now(),updated_at=clock_timestamp() WHERE id=c.id;
 INSERT INTO public.activities(business_unit_id,entity_type,entity_id,activity_type,actor_id,description,metadata) VALUES(c.business_unit_id,c.entity_type,c.entity_id,'COMMUNICATION_RETRY',auth.uid(),'Communication retry queued',jsonb_build_object('authoritative',true,'communication_id',c.id));
END;
$$;
CREATE FUNCTION public.phase8_claim(_attempt uuid,_id uuid DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.communication_outbox%ROWTYPE;
BEGIN
 IF _attempt IS NULL THEN RAISE EXCEPTION 'invalid attempt'; END IF;
 SELECT * INTO c FROM public.communication_outbox WHERE (_id IS NULL OR id=_id) AND (state IN ('QUEUED','FAILED') OR (state='PROCESSING' AND lease_until<now())) AND (attempts<3 OR state='PROCESSING') AND recipient ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' AND provider_email_id IS NULL AND next_attempt_at<=now() ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1;
 IF NOT FOUND THEN RETURN NULL; END IF;
 IF c.attempts>=3 OR c.first_attempt_at<now()-interval '23 hours' THEN
   UPDATE public.communication_outbox SET state='RECONCILE',failure_category='IDEMPOTENCY_WINDOW',updated_at=clock_timestamp() WHERE id=c.id;
   PERFORM public.phase8_emit(c.business_unit_id,'communication/'||c.id,'COMMUNICATION_FAILED','URGENT','Communication requires reconciliation',c.entity_type,c.entity_id);
   RETURN NULL;
 END IF;
 IF (c.customer_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.customers cu JOIN public.bookings b ON b.customer_id=cu.id AND b.id=c.entity_id AND b.business_unit_id=cu.business_unit_id WHERE cu.id=c.customer_id AND cu.business_unit_id=c.business_unit_id AND lower(cu.email)=c.recipient AND b.status::text=c.payload->>'status'))
 OR (c.staff_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM auth.users u JOIN public.notification_preferences p ON p.user_id=u.id AND p.email_urgent WHERE u.id=c.staff_id AND u.email_confirmed_at IS NOT NULL AND lower(u.email)=c.recipient AND public.phase8_audience(u.id,c.business_unit_id,c.payload->>'eventKind'))) THEN
   UPDATE public.communication_outbox SET state='CANCELLED',failure_category='RECIPIENT_OR_EVENT_CHANGED',updated_at=clock_timestamp() WHERE id=c.id;RETURN NULL;
 END IF;
 UPDATE public.communication_outbox SET state='PROCESSING',attempt_id=_attempt,attempts=attempts+1,first_attempt_at=COALESCE(first_attempt_at,now()),last_attempt_at=now(),lease_until=now()+interval '2 minutes',next_attempt_at=now()+interval '2 minutes',updated_at=clock_timestamp() WHERE id=c.id RETURNING * INTO c;
 RETURN to_jsonb(c);
END;
$$;
CREATE FUNCTION public.phase8_apply_delivery(_provider uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.communication_outbox%ROWTYPE; desired text;
BEGIN
 SELECT * INTO c FROM public.communication_outbox WHERE provider_email_id=_provider FOR UPDATE;
 IF NOT FOUND THEN RETURN; END IF;
 SELECT CASE WHEN bool_or(e.kind<>'email.delivered') THEN 'FAILED' ELSE 'DELIVERED' END INTO desired FROM public.communication_events e WHERE e.provider_email_id=_provider AND lower(e.recipient)=c.recipient AND lower(e.sender)='support@skyrunlimo.com' HAVING count(*)>0;
 IF desired IS NULL OR c.state=desired THEN RETURN; END IF;
 UPDATE public.communication_outbox SET state=desired,failure_category=CASE WHEN desired='FAILED' THEN 'PROVIDER_DELIVERY_FAILURE' ELSE NULL END,updated_at=clock_timestamp() WHERE id=c.id;
 INSERT INTO public.activities(business_unit_id,entity_type,entity_id,activity_type,description,metadata) VALUES(c.business_unit_id,c.entity_type,c.entity_id,'COMMUNICATION_'||desired,'Communication provider event verified',jsonb_build_object('authoritative',true,'communication_id',c.id));
 IF desired='FAILED' THEN PERFORM public.phase8_emit(c.business_unit_id,'communication/'||c.id,'COMMUNICATION_FAILED','URGENT','Communication delivery failed',c.entity_type,c.entity_id); END IF;
END;
$$;
CREATE FUNCTION public.phase8_freeze(_id uuid,_attempt uuid,_subject text,_text text,_html text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.communication_outbox%ROWTYPE;
BEGIN
 SELECT * INTO c FROM public.communication_outbox WHERE id=_id FOR UPDATE;
 IF NOT FOUND OR c.attempt_id IS DISTINCT FROM _attempt OR c.state<>'PROCESSING' THEN RAISE EXCEPTION 'attempt unavailable'; END IF;
 IF c.message_text IS NULL THEN
  IF _subject IS NULL OR length(_subject) NOT BETWEEN 1 AND 300 OR (strpos(_subject,chr(10))>0 OR strpos(_subject,chr(13))>0) OR _text IS NULL OR length(_text) NOT BETWEEN 1 AND 20000 OR _html IS NULL OR length(_html) NOT BETWEEN 1 AND 40000 THEN RAISE EXCEPTION 'invalid message'; END IF;
  UPDATE public.communication_outbox SET subject=_subject,message_text=_text,message_html=_html WHERE id=c.id RETURNING * INTO c;
 END IF;
 RETURN jsonb_build_object('id',c.id,'to',c.recipient,'subject',c.subject,'text',c.message_text,'html',c.message_html);
END;
$$;
REVOKE ALL ON FUNCTION public.phase8_freeze(uuid,uuid,text,text,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.phase8_freeze(uuid,uuid,text,text,text) TO service_role;
CREATE FUNCTION public.phase8_finish(_id uuid,_attempt uuid,_provider uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.communication_outbox%ROWTYPE;
BEGIN
 SELECT * INTO c FROM public.communication_outbox WHERE id=_id FOR UPDATE;
 IF NOT FOUND OR c.attempt_id IS DISTINCT FROM _attempt OR c.state<>'PROCESSING' THEN RAISE EXCEPTION 'attempt unavailable'; END IF;
 UPDATE public.communication_outbox SET provider_email_id=_provider,state=CASE WHEN _provider IS NULL AND attempts=3 THEN 'RECONCILE' WHEN _provider IS NULL THEN 'FAILED' ELSE 'PROVIDER_ACCEPTED' END,failure_category=CASE WHEN _provider IS NULL THEN 'PROVIDER_OUTCOME_UNKNOWN' ELSE NULL END,next_attempt_at=now()+interval '5 minutes',lease_until=NULL,updated_at=clock_timestamp() WHERE id=c.id;
 INSERT INTO public.activities(business_unit_id,entity_type,entity_id,activity_type,description,metadata) VALUES(c.business_unit_id,c.entity_type,c.entity_id,CASE WHEN _provider IS NULL THEN 'COMMUNICATION_ATTEMPT_UNCONFIRMED' ELSE 'COMMUNICATION_PROVIDER_ACCEPTED' END,'Communication attempt recorded',jsonb_build_object('authoritative',true,'communication_id',c.id));
 IF _provider IS NOT NULL THEN PERFORM public.phase8_apply_delivery(_provider); END IF;
 IF _provider IS NULL AND c.attempts=3 THEN PERFORM public.phase8_emit(c.business_unit_id,'communication/'||c.id,'COMMUNICATION_FAILED','URGENT','Communication requires reconciliation',c.entity_type,c.entity_id); END IF;
END;
$$;
CREATE FUNCTION public.phase8_delivery_event(_event text,_provider uuid,_kind text,_recipient text,_sender text,_hash text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 INSERT INTO public.communication_events(event_id,provider_email_id,kind,recipient,sender,payload_hash) VALUES(_event,_provider,_kind,lower(_recipient),lower(_sender),_hash) ON CONFLICT(event_id) DO NOTHING;
 IF EXISTS(SELECT 1 FROM public.communication_events WHERE event_id=_event AND (payload_hash<>_hash OR provider_email_id<>_provider)) THEN RAISE EXCEPTION 'event conflict'; END IF;
 PERFORM public.phase8_apply_delivery(_provider);
END;
$$;
REVOKE ALL ON FUNCTION public.phase8_audience(uuid,uuid,text),public.phase8_emit(uuid,text,text,text,text,text,uuid,uuid),public.phase8_source_event(),public.phase8_apply_delivery(uuid) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.phase8_can_read(uuid,text),public.phase8_snapshot(),public.phase8_user_action(text,uuid,bigint,jsonb),public.phase8_retry(uuid),public.phase8_claim(uuid,uuid),public.phase8_finish(uuid,uuid,uuid),public.phase8_delivery_event(text,uuid,text,text,text,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.phase8_can_read(uuid,text),public.phase8_snapshot(),public.phase8_user_action(text,uuid,bigint,jsonb),public.phase8_retry(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.phase8_claim(uuid,uuid),public.phase8_finish(uuid,uuid,uuid),public.phase8_delivery_event(text,uuid,text,text,text,text) TO service_role;
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
      OR _activity_type LIKE 'BOOKING_%' OR _activity_type LIKE 'DEPOSIT_%' OR _activity_type LIKE 'PHASE5_%' OR _activity_type LIKE 'CHAT_%' OR _activity_type LIKE 'FINANCE_%' OR _activity_type LIKE 'NOTIFICATION_%' OR _activity_type LIKE 'COMMUNICATION_%'
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


COMMIT;
