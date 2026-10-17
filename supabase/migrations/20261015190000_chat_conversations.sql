-- SKYRUN LIMO — local-only hybrid chat support
-- This migration is additive to the approved 14-table model. It adds no table.
-- Do not apply remotely until the intended Supabase project is verified.

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS session_token_hash text,
  ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS handoff_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS visitor_last_read_at timestamptz;

-- Existing OPEN/CLOSED/ESCALATED rows remain valid while the explicit chat states
-- allow the public widget to stop automated replies after handoff.
ALTER TABLE public.conversations DROP CONSTRAINT IF EXISTS conversations_status_check;
ALTER TABLE public.conversations DROP CONSTRAINT IF EXISTS chk_conversations_status;
ALTER TABLE public.conversations ADD CONSTRAINT chk_conversations_status CHECK (
  status IN ('OPEN', 'CLOSED', 'ESCALATED', 'AI_HANDLING', 'HANDOFF_REQUESTED',
             'HUMAN_HANDLING', 'WAITING_FOR_CUSTOMER', 'RESOLVED')
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_conversations_session_token_hash
  ON public.conversations (session_token_hash) WHERE session_token_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_conversations_inbox
  ON public.conversations (business_unit_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_assigned
  ON public.conversations (assigned_to, updated_at DESC) WHERE assigned_to IS NOT NULL;

-- The opaque visitor session is checked only inside these server-called RPCs.
-- Browser clients receive no direct grants or RLS policy for anonymous chat data.
CREATE OR REPLACE FUNCTION public.chat_start_conversation(
  _business_unit_id uuid,
  _session_token_hash text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_conversation_id uuid;
BEGIN
  IF _business_unit_id <> '00000000-0000-0000-0000-000000000002'::uuid
     OR length(_session_token_hash) <> 64
     OR _session_token_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'invalid chat session';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(_session_token_hash)::bigint);

  SELECT id INTO v_conversation_id
  FROM public.conversations
  WHERE session_token_hash = _session_token_hash;

  IF v_conversation_id IS NOT NULL THEN
    RETURN v_conversation_id;
  END IF;

  INSERT INTO public.conversations (business_unit_id, session_token_hash, channel, status)
  VALUES (_business_unit_id, _session_token_hash, 'CHAT_WIDGET', 'AI_HANDLING')
  RETURNING id INTO v_conversation_id;

  INSERT INTO public.conversation_messages (conversation_id, sender_type, message)
  VALUES (
    v_conversation_id,
    'BOT',
    'Welcome to Skyrun Limo. I can help with chauffeur services, airport travel, fleet information, or preparing a trip enquiry. A ride is confirmed only after our team reviews and responds.'
  );
  RETURN v_conversation_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.chat_load_conversation(_session_token_hash text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_conversation public.conversations%ROWTYPE;
BEGIN
  SELECT * INTO v_conversation
  FROM public.conversations
  WHERE session_token_hash = _session_token_hash;
  IF NOT FOUND THEN RAISE EXCEPTION 'chat session not found'; END IF;

  UPDATE public.conversations
  SET visitor_last_read_at = pg_catalog.now()
  WHERE id = v_conversation.id;

  RETURN jsonb_build_object(
    'conversation', jsonb_build_object(
      'id', v_conversation.id,
      'status', v_conversation.status,
      'assigned_to', v_conversation.assigned_to,
      'handoff_requested_at', v_conversation.handoff_requested_at,
      'lead_id', v_conversation.lead_id,
      'customer_id', v_conversation.customer_id,
      'updated_at', v_conversation.updated_at
    ),
    'messages', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', m.id, 'sender_type', m.sender_type, 'message', m.message, 'created_at', m.created_at
      ) ORDER BY m.created_at, m.id)
      FROM public.conversation_messages m WHERE m.conversation_id = v_conversation.id
    ), '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.chat_append_visitor_message(
  _session_token_hash text,
  _message text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_conversation public.conversations%ROWTYPE;
  v_message_id uuid;
BEGIN
  IF length(pg_catalog.btrim(_message)) NOT BETWEEN 1 AND 1500 THEN
    RAISE EXCEPTION 'invalid chat message';
  END IF;
  SELECT * INTO v_conversation FROM public.conversations
  WHERE session_token_hash = _session_token_hash FOR UPDATE;
  IF NOT FOUND OR v_conversation.status IN ('CLOSED', 'RESOLVED') THEN
    RAISE EXCEPTION 'chat session unavailable';
  END IF;
  -- A durable per-conversation interval protects this public endpoint across instances.
  IF EXISTS (
    SELECT 1 FROM public.conversation_messages
    WHERE conversation_id = v_conversation.id AND sender_type = 'CUSTOMER'
      AND created_at > pg_catalog.now() - interval '2 seconds'
  ) THEN RAISE EXCEPTION 'please wait before sending another message'; END IF;

  INSERT INTO public.conversation_messages (conversation_id, sender_type, message)
  VALUES (v_conversation.id, 'CUSTOMER', pg_catalog.btrim(_message)) RETURNING id INTO v_message_id;
  IF v_conversation.status = 'WAITING_FOR_CUSTOMER' THEN
    v_conversation.status := 'HUMAN_HANDLING';
  END IF;
  UPDATE public.conversations
  SET status = v_conversation.status, updated_at = pg_catalog.now()
  WHERE id = v_conversation.id;
  RETURN jsonb_build_object('conversation_id', v_conversation.id, 'status', v_conversation.status, 'message_id', v_message_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.chat_append_bot_message(_session_token_hash text, _message text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_conversation_id uuid; v_message_id uuid;
BEGIN
  IF length(pg_catalog.btrim(_message)) NOT BETWEEN 1 AND 1500 THEN RAISE EXCEPTION 'invalid chat message'; END IF;
  SELECT id INTO v_conversation_id FROM public.conversations
  WHERE session_token_hash = _session_token_hash AND status IN ('AI_HANDLING', 'OPEN') FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'automated response unavailable'; END IF;
  INSERT INTO public.conversation_messages (conversation_id, sender_type, message)
  VALUES (v_conversation_id, 'BOT', pg_catalog.btrim(_message)) RETURNING id INTO v_message_id;
  UPDATE public.conversations SET updated_at = pg_catalog.now() WHERE id = v_conversation_id;
  RETURN v_message_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.chat_request_handoff(_session_token_hash text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_conversation public.conversations%ROWTYPE;
BEGIN
  SELECT * INTO v_conversation FROM public.conversations
  WHERE session_token_hash = _session_token_hash FOR UPDATE;
  IF NOT FOUND OR v_conversation.status IN ('CLOSED', 'RESOLVED') THEN RAISE EXCEPTION 'chat session unavailable'; END IF;
  UPDATE public.conversations
  SET status = 'HANDOFF_REQUESTED', handoff_requested_at = COALESCE(handoff_requested_at, pg_catalog.now()), updated_at = pg_catalog.now()
  WHERE id = v_conversation.id;
  INSERT INTO public.conversation_messages (conversation_id, sender_type, message)
  SELECT v_conversation.id, 'SYSTEM', 'Visitor requested human support.'
  WHERE v_conversation.status <> 'HANDOFF_REQUESTED';
  INSERT INTO public.activities (business_unit_id, entity_type, entity_id, activity_type, description)
  VALUES (v_conversation.business_unit_id, 'conversation', v_conversation.id, 'HANDOFF_REQUESTED', 'Visitor requested human support');
  RETURN jsonb_build_object('conversation_id', v_conversation.id, 'status', 'HANDOFF_REQUESTED');
END;
$$;

CREATE OR REPLACE FUNCTION public.chat_capture_contact(
  _session_token_hash text, _name text, _email text, _phone text, _trip_details text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_conversation public.conversations%ROWTYPE; v_customer_id uuid; v_lead_id uuid; v_reference text;
BEGIN
  IF length(pg_catalog.btrim(_name)) NOT BETWEEN 1 AND 120 OR length(pg_catalog.btrim(_email)) > 200
     OR length(pg_catalog.btrim(_phone)) NOT BETWEEN 5 AND 40 OR length(COALESCE(_trip_details, '')) > 2000 THEN
    RAISE EXCEPTION 'invalid contact details';
  END IF;
  SELECT * INTO v_conversation FROM public.conversations WHERE session_token_hash = _session_token_hash FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'chat session unavailable'; END IF;
  IF v_conversation.lead_id IS NOT NULL THEN
    SELECT lead_number INTO v_reference FROM public.leads WHERE id = v_conversation.lead_id;
    RETURN jsonb_build_object('ok', true, 'reference', v_reference);
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(lower(pg_catalog.btrim(_email)))::bigint);
  SELECT id INTO v_customer_id FROM public.customers
  WHERE business_unit_id = v_conversation.business_unit_id AND lower(email) = lower(pg_catalog.btrim(_email));
  IF v_customer_id IS NULL THEN
    INSERT INTO public.customers (business_unit_id, full_name, email, phone)
    VALUES (v_conversation.business_unit_id, pg_catalog.btrim(_name), lower(pg_catalog.btrim(_email)), pg_catalog.btrim(_phone))
    RETURNING id INTO v_customer_id;
  END IF;
  v_reference := 'SR-' || upper(encode(gen_random_bytes(6), 'hex'));
  INSERT INTO public.leads (business_unit_id, customer_id, lead_number, source, status, priority, subject, message)
  VALUES (v_conversation.business_unit_id, v_customer_id, v_reference, 'CHATBOT', 'NEW', 'NORMAL', 'Chatbot enquiry', COALESCE(NULLIF(_trip_details, ''), 'Chatbot contact details provided'))
  RETURNING id INTO v_lead_id;
  UPDATE public.conversations SET customer_id = v_customer_id, lead_id = v_lead_id, updated_at = pg_catalog.now() WHERE id = v_conversation.id;
  INSERT INTO public.activities (business_unit_id, entity_type, entity_id, activity_type, description)
  VALUES (v_conversation.business_unit_id, 'lead', v_lead_id, 'CREATED', 'Lead created from CHATBOT conversation');
  RETURN jsonb_build_object('ok', true, 'reference', v_reference);
END;
$$;

REVOKE ALL ON FUNCTION public.chat_start_conversation(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.chat_load_conversation(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.chat_append_visitor_message(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.chat_append_bot_message(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.chat_request_handoff(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.chat_capture_contact(text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.chat_start_conversation(uuid, text), public.chat_load_conversation(text), public.chat_append_visitor_message(text, text), public.chat_append_bot_message(text, text), public.chat_request_handoff(text), public.chat_capture_contact(text, text, text, text, text) TO service_role;

-- Realtime remains a transport: reconnecting clients load persisted history.
ALTER TABLE public.conversations REPLICA IDENTITY FULL;
ALTER TABLE public.conversation_messages REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'conversations') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'conversation_messages') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_messages;
    END IF;
  END IF;
END;
$$;

-- Rollback note: remove chat RPCs and added columns only after data-retention review.
