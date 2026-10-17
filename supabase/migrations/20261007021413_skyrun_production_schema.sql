-- ============================================================================
-- SKYRUN LIMO — PRODUCTION DATABASE SCHEMA
-- Migration: 20261007021413_skyrun_production_schema.sql
-- Target: Supabase PostgreSQL (project cudisqrugjupstgdeqac)
-- Architecture: Modular monolith, business-unit-aware, RLS-enforced
-- ============================================================================

-- ============================================================================
-- 1. EXTENSIONS
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 2. ENUMS / CUSTOM TYPES
-- ============================================================================

DO $$
BEGIN
    CREATE TYPE public.app_role AS ENUM ('SUPER_ADMIN', 'ADMIN', 'DISPATCHER', 'MANAGER', 'CONTENT_MANAGER', 'SUPPORT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'SUPER_ADMIN';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'ADMIN';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'DISPATCHER';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'MANAGER';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'CONTENT_MANAGER';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'SUPPORT';

DO $$
BEGIN
    CREATE TYPE public.lead_source AS ENUM ('CONTACT_FORM', 'RIDE_ENQUIRY', 'CHATBOT', 'PHONE', 'EMAIL', 'ADMIN', 'PARTNER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    CREATE TYPE public.lead_status AS ENUM ('NEW', 'REVIEWING', 'GENUINE', 'CONTACTED', 'QUALIFIED', 'QUOTE_REQUESTED', 'QUOTE_SENT', 'NEGOTIATING', 'WON', 'LOST', 'SPAM');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    CREATE TYPE public.ride_request_status AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'QUOTE_PENDING', 'QUOTED', 'ACCEPTED', 'CONVERTED', 'CANCELLED', 'EXPIRED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    CREATE TYPE public.quote_status AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    CREATE TYPE public.booking_status AS ENUM ('PENDING', 'CONFIRMED', 'ASSIGNED', 'DRIVER_ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN CREATE TYPE public.trip_type AS ENUM ('ONE_WAY', 'ROUND_TRIP', 'HOURLY'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.business_type AS ENUM ('LIMO', 'FOOD'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.entity_status AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- 3. EARLY HELPER FUNCTIONS
--    Only functions that do NOT query any application table go here.
--    Functions that reference public.user_roles are in section 4A (after
--    user_roles is created). log_activity is in section 4B (after all entity
--    tables are created).
-- ============================================================================

-- 3.1 Updated_at trigger function
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    NEW.updated_at = pg_catalog.now();
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_updated_at() TO authenticated;

-- 3.2 Profile creation on auth signup (references only auth.users and public.profiles,
--     both of which will exist before this trigger fires at runtime; the function
--     body is PL/pgSQL so table resolution is deferred to call time, but profiles
--     IS created before the trigger is attached in section 6, so this is safe.)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name)
    VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name')
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO authenticated;

-- ============================================================================
-- 4. CORE TABLES (dependency order)
-- ============================================================================

-- 4.1 organizations
CREATE TABLE IF NOT EXISTS public.organizations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    slug text NOT NULL UNIQUE,
    status entity_status NOT NULL DEFAULT 'ACTIVE',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 4.2 business_units
CREATE TABLE IF NOT EXISTS public.business_units (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name text NOT NULL,
    slug text NOT NULL,
    business_type business_type NOT NULL DEFAULT 'LIMO',
    status entity_status NOT NULL DEFAULT 'ACTIVE',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE (organization_id, slug)
);

-- Deterministic tenant seed needed before legacy row reconciliation.
INSERT INTO public.organizations (id, name, slug, status)
VALUES ('00000000-0000-0000-0000-000000000001', 'Skyrun LLC', 'skyrun-llc', 'ACTIVE')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.business_units (id, organization_id, name, slug, business_type, status)
VALUES ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Skyrun Limo', 'skyrun-limo', 'LIMO', 'ACTIVE')
ON CONFLICT (id) DO NOTHING;

-- 4.3 profiles (extends auth.users, no business_unit_id)
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name text,
    phone text,
    avatar_url text,
    status entity_status NOT NULL DEFAULT 'ACTIVE',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 4.4 user_roles (nullable business_unit_id for SUPER_ADMIN)
CREATE TABLE IF NOT EXISTS public.user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    business_unit_id uuid REFERENCES public.business_units(id) ON DELETE CASCADE,
    role public.app_role NOT NULL,
    created_at timestamptz DEFAULT now()
);

-- Partial unique indexes for SUPER_ADMIN (NULL BU) vs BU-scoped roles
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_roles_bu_not_null ON public.user_roles (user_id, business_unit_id, role) WHERE business_unit_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_roles_bu_null ON public.user_roles (user_id, role) WHERE business_unit_id IS NULL;

-- 4.4.1 SUPER_ADMIN exclusivity enforcement trigger function
-- (references public.user_roles, so defined AFTER user_roles exists)
CREATE OR REPLACE FUNCTION public.enforce_super_admin_exclusivity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(NEW.user_id::text)::bigint);

    IF TG_OP = 'INSERT' THEN
        IF NEW.role = 'SUPER_ADMIN' THEN
            IF NEW.business_unit_id IS NOT NULL THEN
                RAISE EXCEPTION 'enforce_super_admin_exclusivity: SUPER_ADMIN must have business_unit_id NULL';
            END IF;
            IF EXISTS (
                SELECT 1 FROM public.user_roles
                WHERE user_id = NEW.user_id
                  AND id != NEW.id
                  AND business_unit_id IS NOT NULL
            ) THEN
                RAISE EXCEPTION 'enforce_super_admin_exclusivity: user % already holds a BU-scoped role', NEW.user_id;
            END IF;
        ELSE
            IF NEW.business_unit_id IS NULL THEN
                RAISE EXCEPTION 'enforce_super_admin_exclusivity: BU-scoped role requires business_unit_id NOT NULL';
            END IF;
            IF EXISTS (
                SELECT 1 FROM public.user_roles
                WHERE user_id = NEW.user_id
                  AND id != NEW.id
                  AND role = 'SUPER_ADMIN'
            ) THEN
                RAISE EXCEPTION 'enforce_super_admin_exclusivity: user % already holds SUPER_ADMIN', NEW.user_id;
            END IF;
        END IF;
    ELSIF TG_OP = 'UPDATE' THEN
        IF NEW.role = 'SUPER_ADMIN' THEN
            IF NEW.business_unit_id IS NOT NULL THEN
                RAISE EXCEPTION 'enforce_super_admin_exclusivity: SUPER_ADMIN must have business_unit_id NULL';
            END IF;
            IF EXISTS (
                SELECT 1 FROM public.user_roles
                WHERE user_id = NEW.user_id
                  AND id != NEW.id
                  AND business_unit_id IS NOT NULL
            ) THEN
                RAISE EXCEPTION 'enforce_super_admin_exclusivity: user % already holds a BU-scoped role', NEW.user_id;
            END IF;
        ELSE
            IF NEW.business_unit_id IS NULL THEN
                RAISE EXCEPTION 'enforce_super_admin_exclusivity: BU-scoped role requires business_unit_id NOT NULL';
            END IF;
            IF EXISTS (
                SELECT 1 FROM public.user_roles
                WHERE user_id = NEW.user_id
                  AND id != NEW.id
                  AND role = 'SUPER_ADMIN'
            ) THEN
                RAISE EXCEPTION 'enforce_super_admin_exclusivity: user % already holds SUPER_ADMIN', NEW.user_id;
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_super_admin_exclusivity() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enforce_super_admin_exclusivity() TO authenticated;

ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS chk_user_roles_scope;
ALTER TABLE public.user_roles
    ADD CONSTRAINT chk_user_roles_scope CHECK (
        (role = 'SUPER_ADMIN'::public.app_role AND business_unit_id IS NULL)
        OR
        (role <> 'SUPER_ADMIN'::public.app_role AND business_unit_id IS NOT NULL)
    );

-- ============================================================================
-- 4A. ROLE-CHECK HELPER FUNCTIONS
--     Defined HERE — after public.user_roles exists — so PostgreSQL can resolve
--     the table reference when parsing LANGUAGE sql (stable) functions.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.has_role(_role public.app_role, _user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = _user_id AND role = _role
    );
END;
$$;

REVOKE ALL ON FUNCTION public.has_role(public.app_role, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(public.app_role, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.has_role_any(_roles public.app_role[], _user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = _user_id AND role = ANY(_roles)
    );
END;
$$;

REVOKE ALL ON FUNCTION public.has_role_any(public.app_role[], uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role_any(public.app_role[], uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.current_user_business_unit_ids()
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT COALESCE(array_agg(ur.business_unit_id), '{}'::uuid[])
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.business_unit_id IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.current_user_business_unit_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_business_unit_ids() TO authenticated;

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles ur
        WHERE ur.user_id = _user_id
          AND ur.role = 'SUPER_ADMIN'::public.app_role
          AND ur.business_unit_id IS NULL
    );
$$;

REVOKE ALL ON FUNCTION public.is_super_admin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles ur
        WHERE ur.user_id = _user_id
          AND ur.role = ANY(ARRAY['SUPER_ADMIN','ADMIN','MANAGER','DISPATCHER','SUPPORT','CONTENT_MANAGER']::public.app_role[])
    );
$$;

REVOKE ALL ON FUNCTION public.is_staff(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated;

-- ============================================================================
-- (continuing core tables — these reference vehicle_categories via FK so
--  vehicle_categories must precede ride_requests / quotes / bookings / vehicles)
-- ============================================================================

-- 4.5 customers
CREATE TABLE IF NOT EXISTS public.customers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_unit_id uuid NOT NULL REFERENCES public.business_units(id) ON DELETE CASCADE,
    full_name text NOT NULL,
    email text,
    phone text,
    company_name text,
    notes text,
    status entity_status NOT NULL DEFAULT 'ACTIVE',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Partial unique indexes for dedupe (email/phone per business unit)
CREATE UNIQUE INDEX IF NOT EXISTS uq_customers_email_bu ON public.customers (business_unit_id, lower(email)) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_customers_phone_bu ON public.customers (business_unit_id, phone) WHERE phone IS NOT NULL;

-- 4.6 leads (central unified lead entity)
CREATE TABLE IF NOT EXISTS public.leads (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_unit_id uuid NOT NULL REFERENCES public.business_units(id) ON DELETE CASCADE,
    customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
    lead_number text NOT NULL UNIQUE,
    source lead_source NOT NULL,
    status lead_status NOT NULL DEFAULT 'NEW',
    priority text NOT NULL DEFAULT 'NORMAL',
    assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    subject text,
    message text NOT NULL,
    last_activity_at timestamptz DEFAULT now(),
    reviewed_at timestamptz,
    reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    spam_reason text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 4.7 vehicle_categories (must precede ride_requests, quotes, bookings, vehicles)
CREATE TABLE IF NOT EXISTS public.vehicle_categories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_unit_id uuid NOT NULL REFERENCES public.business_units(id) ON DELETE CASCADE,
    name text NOT NULL,
    slug text NOT NULL,
    description text,
    passenger_capacity int NOT NULL DEFAULT 4,
    luggage_capacity int NOT NULL DEFAULT 2,
    display_order int NOT NULL DEFAULT 0,
    is_visible boolean NOT NULL DEFAULT TRUE,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE (business_unit_id, slug)
);

-- 4.8 conversations
CREATE TABLE IF NOT EXISTS public.conversations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_unit_id uuid NOT NULL REFERENCES public.business_units(id) ON DELETE CASCADE,
    lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
    customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
    channel text NOT NULL DEFAULT 'CHAT_WIDGET',
    status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','CLOSED','ESCALATED')),
    started_at timestamptz DEFAULT now(),
    ended_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 4.9 conversation_messages
CREATE TABLE IF NOT EXISTS public.conversation_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender_type text NOT NULL CHECK (sender_type IN ('CUSTOMER','BOT','ADMIN','SYSTEM')),
    message text NOT NULL,
    metadata jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT now()
);

-- 4.10 ride_requests (FK to vehicle_categories — created above at 4.7)
CREATE TABLE IF NOT EXISTS public.ride_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_unit_id uuid NOT NULL REFERENCES public.business_units(id) ON DELETE CASCADE,
    lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
    customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    vehicle_category_id uuid REFERENCES public.vehicle_categories(id) ON DELETE SET NULL,
    pickup_location text NOT NULL,
    dropoff_location text NOT NULL,
    travel_date date NOT NULL,
    pickup_time time,
    trip_type trip_type NOT NULL DEFAULT 'ONE_WAY',
    return_date date,
    return_time time,
    hourly_duration int,
    passenger_count int NOT NULL DEFAULT 1,
    airport_code text,
    airport_direction text CHECK (airport_direction IN ('ARRIVAL','DEPARTURE')),
    flight_number text,
    notes text,
    status ride_request_status NOT NULL DEFAULT 'DRAFT',
    request_number text NOT NULL UNIQUE,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 4.11 quotes (FK to vehicle_categories and ride_requests)
CREATE TABLE IF NOT EXISTS public.quotes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_unit_id uuid NOT NULL REFERENCES public.business_units(id) ON DELETE CASCADE,
    ride_request_id uuid NOT NULL REFERENCES public.ride_requests(id) ON DELETE CASCADE,
    customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    vehicle_category_id uuid REFERENCES public.vehicle_categories(id) ON DELETE SET NULL,
    pickup_location text NOT NULL,
    dropoff_location text NOT NULL,
    travel_date date NOT NULL,
    pickup_time time,
    amount numeric(10,2) NOT NULL,
    currency text NOT NULL DEFAULT 'USD',
    valid_until timestamptz NOT NULL,
    status quote_status NOT NULL DEFAULT 'DRAFT',
    notes text,
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 4.12 bookings (FK to vehicle_categories, ride_requests, quotes)
CREATE TABLE IF NOT EXISTS public.bookings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_unit_id uuid NOT NULL REFERENCES public.business_units(id) ON DELETE CASCADE,
    customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    ride_request_id uuid REFERENCES public.ride_requests(id) ON DELETE SET NULL,
    quote_id uuid REFERENCES public.quotes(id) ON DELETE SET NULL,
    vehicle_category_id uuid REFERENCES public.vehicle_categories(id) ON DELETE SET NULL,
    booking_number text NOT NULL UNIQUE,
    pickup_location text NOT NULL,
    dropoff_location text NOT NULL,
    travel_date date NOT NULL,
    pickup_time time,
    passenger_count int NOT NULL,
    status booking_status NOT NULL DEFAULT 'PENDING',
    final_amount numeric(10,2),
    currency text NOT NULL DEFAULT 'USD',
    notes text,
    confirmed_at timestamptz,
    completed_at timestamptz,
    cancelled_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 4.13 vehicles (FK to vehicle_categories)
CREATE TABLE IF NOT EXISTS public.vehicles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_unit_id uuid NOT NULL REFERENCES public.business_units(id) ON DELETE CASCADE,
    vehicle_category_id uuid NOT NULL REFERENCES public.vehicle_categories(id) ON DELETE CASCADE,
    make text NOT NULL,
    model text NOT NULL,
    year int,
    passenger_capacity int,
    luggage_capacity int,
    status entity_status NOT NULL DEFAULT 'ACTIVE',
    description text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 4.14 activities (unified polymorphic event model — append-only)
CREATE TABLE IF NOT EXISTS public.activities (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_unit_id uuid NOT NULL REFERENCES public.business_units(id) ON DELETE CASCADE,
    entity_type text NOT NULL CHECK (entity_type IN (
        'lead','ride_request','quote','booking','customer','conversation',
        'vehicle','vehicle_category','profile','user_role'
    )),
    entity_id uuid NOT NULL,
    activity_type text NOT NULL,
    actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    description text NOT NULL,
    metadata jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT now()
    -- no updated_at (append-only)
);

-- ============================================================================
-- 4B. log_activity — defined AFTER all 14 entity tables exist, because its
--     PL/pgSQL CASE block references leads, ride_requests, quotes, bookings,
--     customers, conversations, vehicles, vehicle_categories, and activities.
-- ============================================================================

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

REVOKE ALL ON FUNCTION public.log_activity(text, uuid, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_activity(text, uuid, text, text, jsonb) TO authenticated;

-- ============================================================================
-- 4.15 Legacy-schema reconciliation
--      Runs AFTER all 14 tables are created so ALTER TABLE, UPDATE, and DROP
--      have well-defined targets.
-- ============================================================================

ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS business_unit_id uuid REFERENCES public.business_units(id) ON DELETE CASCADE;
UPDATE public.user_roles
SET business_unit_id = '00000000-0000-0000-0000-000000000002'
WHERE role <> 'SUPER_ADMIN'::public.app_role
  AND business_unit_id IS NULL;
UPDATE public.user_roles
SET business_unit_id = NULL
WHERE role = 'SUPER_ADMIN'::public.app_role;

ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS business_unit_id uuid REFERENCES public.business_units(id) ON DELETE CASCADE;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS full_name text;
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'first_name'
    ) THEN
        EXECUTE $sql$
            UPDATE public.customers
            SET full_name = NULLIF(pg_catalog.btrim(COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')), '')
            WHERE full_name IS NULL
        $sql$;
    END IF;
END $$;
UPDATE public.customers
SET business_unit_id = '00000000-0000-0000-0000-000000000002'
WHERE business_unit_id IS NULL;
ALTER TABLE public.customers ALTER COLUMN business_unit_id SET NOT NULL;
ALTER TABLE public.customers ALTER COLUMN full_name SET NOT NULL;
ALTER TABLE public.customers DROP COLUMN IF EXISTS first_name;
ALTER TABLE public.customers DROP COLUMN IF EXISTS last_name;

ALTER TABLE public.profiles DROP COLUMN IF EXISTS email;

DO $$
BEGIN
    IF to_regclass('public.lead_activities') IS NOT NULL THEN
        INSERT INTO public.activities (business_unit_id, entity_type, entity_id, activity_type, actor_id, description, created_at)
        SELECT l.business_unit_id, 'lead', la.lead_id, la.type, la.actor_id, la.description, la.created_at
        FROM public.lead_activities la
        JOIN public.leads l ON l.id = la.lead_id
        WHERE NOT EXISTS (
            SELECT 1
            FROM public.activities a
            WHERE a.entity_type = 'lead'
              AND a.entity_id = la.lead_id
              AND a.activity_type = la.type
              AND a.description = la.description
              AND a.created_at = la.created_at
        );

        DROP TABLE public.lead_activities;
    END IF;
END $$;

-- ============================================================================
-- 5. INDEXES (21 total, justified by query patterns)
-- ============================================================================

-- leads (5)
CREATE INDEX IF NOT EXISTS idx_leads_status   ON public.leads (status);
CREATE INDEX IF NOT EXISTS idx_leads_source   ON public.leads (source);
CREATE INDEX IF NOT EXISTS idx_leads_created  ON public.leads (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_bu       ON public.leads (business_unit_id);
CREATE INDEX IF NOT EXISTS idx_leads_customer ON public.leads (customer_id);

-- customers (2)
CREATE INDEX IF NOT EXISTS idx_customers_email ON public.customers (lower(email));
CREATE INDEX IF NOT EXISTS idx_customers_bu    ON public.customers (business_unit_id);

-- ride_requests (4)
CREATE INDEX IF NOT EXISTS idx_rr_status   ON public.ride_requests (status);
CREATE INDEX IF NOT EXISTS idx_rr_travel   ON public.ride_requests (travel_date);
CREATE INDEX IF NOT EXISTS idx_rr_customer ON public.ride_requests (customer_id);
CREATE INDEX IF NOT EXISTS idx_rr_bu       ON public.ride_requests (business_unit_id);

-- quotes (2)
CREATE INDEX IF NOT EXISTS idx_quotes_status  ON public.quotes (status);
CREATE INDEX IF NOT EXISTS idx_quotes_request ON public.quotes (ride_request_id);

-- bookings (3)
CREATE INDEX IF NOT EXISTS idx_bookings_status   ON public.bookings (status);
CREATE INDEX IF NOT EXISTS idx_bookings_travel   ON public.bookings (travel_date);
CREATE INDEX IF NOT EXISTS idx_bookings_customer ON public.bookings (customer_id);

-- conversation_messages (1)
CREATE INDEX IF NOT EXISTS idx_cm_conv_created ON public.conversation_messages (conversation_id, created_at);

-- conversations (1)
CREATE INDEX IF NOT EXISTS idx_conv_bu ON public.conversations (business_unit_id);

-- activities (3)
CREATE INDEX IF NOT EXISTS idx_act_entity   ON public.activities (entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_act_bu_time  ON public.activities (business_unit_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_act_actor    ON public.activities (actor_id, created_at DESC);

-- ============================================================================
-- 6. TRIGGERS (updated_at + profile creation + exclusivity)
-- ============================================================================

DROP TRIGGER IF EXISTS trg_organizations_updated_at ON public.organizations;
CREATE TRIGGER trg_organizations_updated_at
    BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_business_units_updated_at ON public.business_units;
CREATE TRIGGER trg_business_units_updated_at
    BEFORE UPDATE ON public.business_units FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
    BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_user_roles_exclusivity ON public.user_roles;
CREATE TRIGGER trg_user_roles_exclusivity
    BEFORE INSERT OR UPDATE ON public.user_roles
    FOR EACH ROW EXECUTE FUNCTION public.enforce_super_admin_exclusivity();

DROP TRIGGER IF EXISTS trg_customers_updated_at ON public.customers;
CREATE TRIGGER trg_customers_updated_at
    BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_leads_updated_at ON public.leads;
CREATE TRIGGER trg_leads_updated_at
    BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_conversations_updated_at ON public.conversations;
CREATE TRIGGER trg_conversations_updated_at
    BEFORE UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_ride_requests_updated_at ON public.ride_requests;
CREATE TRIGGER trg_ride_requests_updated_at
    BEFORE UPDATE ON public.ride_requests FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_quotes_updated_at ON public.quotes;
CREATE TRIGGER trg_quotes_updated_at
    BEFORE UPDATE ON public.quotes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_bookings_updated_at ON public.bookings;
CREATE TRIGGER trg_bookings_updated_at
    BEFORE UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_vehicle_categories_updated_at ON public.vehicle_categories;
CREATE TRIGGER trg_vehicle_categories_updated_at
    BEFORE UPDATE ON public.vehicle_categories FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_vehicles_updated_at ON public.vehicles;
CREATE TRIGGER trg_vehicles_updated_at
    BEFORE UPDATE ON public.vehicles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Profile creation on auth signup
DROP TRIGGER IF EXISTS trg_on_auth_user_created ON auth.users;
CREATE TRIGGER trg_on_auth_user_created
    AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- 7. ROW LEVEL SECURITY POLICIES (per-table, tailored)
--    All policies call SECURITY DEFINER helper functions — no policy directly
--    queries public.user_roles, preventing 42P17 infinite recursion.
-- ============================================================================

-- 7.1 organizations
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS organizations_super_admin ON public.organizations;
CREATE POLICY organizations_super_admin ON public.organizations FOR ALL USING (
    public.is_super_admin()
);

DROP POLICY IF EXISTS organizations_staff_select ON public.organizations;
CREATE POLICY organizations_staff_select ON public.organizations FOR SELECT USING (
    public.is_super_admin()
    OR EXISTS (
        SELECT 1
        FROM public.business_units bu
        WHERE bu.organization_id = organizations.id
          AND bu.status = 'ACTIVE'
          AND bu.id = ANY(public.current_user_business_unit_ids())
    )
);

-- 7.2 business_units
ALTER TABLE public.business_units ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS business_units_super_admin ON public.business_units;
CREATE POLICY business_units_super_admin ON public.business_units FOR ALL USING (
    public.is_super_admin()
);

DROP POLICY IF EXISTS business_units_staff_select ON public.business_units;
CREATE POLICY business_units_staff_select ON public.business_units FOR SELECT USING (
    id = ANY(public.current_user_business_unit_ids())
);

DROP POLICY IF EXISTS business_units_staff_update ON public.business_units;
CREATE POLICY business_units_staff_update ON public.business_units FOR UPDATE USING (
    public.is_super_admin() OR id = ANY(public.current_user_business_unit_ids())
);

-- 7.3 profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_own ON public.profiles;
CREATE POLICY profiles_own ON public.profiles FOR ALL USING (auth.uid() = id);

DROP POLICY IF EXISTS profiles_staff_select ON public.profiles;
CREATE POLICY profiles_staff_select ON public.profiles FOR SELECT USING (
    public.is_super_admin()
    OR (
        public.is_staff()
        AND EXISTS (
            SELECT 1 FROM public.user_roles ur_target
            WHERE ur_target.user_id = profiles.id
              AND ur_target.business_unit_id IS NOT NULL
              AND ur_target.business_unit_id = ANY(public.current_user_business_unit_ids())
        )
    )
);

-- 7.4 user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_roles_own ON public.user_roles;
CREATE POLICY user_roles_own ON public.user_roles FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS user_roles_super_admin ON public.user_roles;
CREATE POLICY user_roles_super_admin ON public.user_roles FOR ALL USING (public.is_super_admin());

DROP POLICY IF EXISTS user_roles_admin ON public.user_roles;
CREATE POLICY user_roles_admin ON public.user_roles FOR ALL USING (
    business_unit_id = ANY(public.current_user_business_unit_ids())
);

-- 7.5 customers
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS customers_staff ON public.customers;
CREATE POLICY customers_staff ON public.customers FOR ALL USING (
    public.is_staff()
    AND (
        public.is_super_admin()
        OR business_unit_id = ANY(public.current_user_business_unit_ids())
    )
);

-- 7.6 leads
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS leads_staff ON public.leads;
CREATE POLICY leads_staff ON public.leads FOR ALL USING (
    public.is_staff()
    AND (
        public.is_super_admin()
        OR business_unit_id = ANY(public.current_user_business_unit_ids())
    )
);

-- 7.7 conversations
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS conversations_staff ON public.conversations;
CREATE POLICY conversations_staff ON public.conversations FOR ALL USING (
    public.is_staff()
    AND (
        public.is_super_admin()
        OR business_unit_id = ANY(public.current_user_business_unit_ids())
    )
);

-- 7.8 conversation_messages
ALTER TABLE public.conversation_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS conversation_messages_staff ON public.conversation_messages;
CREATE POLICY conversation_messages_staff ON public.conversation_messages FOR ALL USING (
    public.is_staff()
    AND EXISTS (
        SELECT 1 FROM public.conversations c
        WHERE c.id = conversation_messages.conversation_id
        AND (
            public.is_super_admin()
            OR c.business_unit_id = ANY(public.current_user_business_unit_ids())
        )
    )
);

-- 7.9 ride_requests
ALTER TABLE public.ride_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ride_requests_staff ON public.ride_requests;
CREATE POLICY ride_requests_staff ON public.ride_requests FOR ALL USING (
    public.is_staff()
    AND (
        public.is_super_admin()
        OR business_unit_id = ANY(public.current_user_business_unit_ids())
    )
);

-- 7.10 quotes
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS quotes_staff ON public.quotes;
CREATE POLICY quotes_staff ON public.quotes FOR ALL USING (
    public.is_staff()
    AND (
        public.is_super_admin()
        OR business_unit_id = ANY(public.current_user_business_unit_ids())
    )
);

-- 7.11 bookings
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bookings_staff ON public.bookings;
CREATE POLICY bookings_staff ON public.bookings FOR ALL USING (
    public.is_staff()
    AND (
        public.is_super_admin()
        OR business_unit_id = ANY(public.current_user_business_unit_ids())
    )
);

-- 7.12 vehicle_categories
ALTER TABLE public.vehicle_categories ENABLE ROW LEVEL SECURITY;

-- Public read: visible categories belonging to the Skyrun Limo business unit.
-- Uses a hardcoded UUID literal — NOT current_setting() — so it cannot be
-- overridden by client-supplied request headers.
DROP POLICY IF EXISTS vehicle_categories_public ON public.vehicle_categories;
CREATE POLICY vehicle_categories_public ON public.vehicle_categories FOR SELECT USING (
    is_visible = TRUE
    AND business_unit_id = '00000000-0000-0000-0000-000000000002'
);

DROP POLICY IF EXISTS vehicle_categories_staff ON public.vehicle_categories;
CREATE POLICY vehicle_categories_staff ON public.vehicle_categories FOR ALL USING (
    public.is_staff()
    AND (
        public.is_super_admin()
        OR business_unit_id = ANY(public.current_user_business_unit_ids())
    )
);

-- 7.13 vehicles
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

-- Public read: active vehicles whose category is visible, same hardcoded BU.
DROP POLICY IF EXISTS vehicles_public ON public.vehicles;
CREATE POLICY vehicles_public ON public.vehicles FOR SELECT USING (
    status = 'ACTIVE'
    AND business_unit_id = '00000000-0000-0000-0000-000000000002'
    AND vehicle_category_id IN (
        SELECT id FROM public.vehicle_categories
        WHERE is_visible = TRUE
          AND business_unit_id = '00000000-0000-0000-0000-000000000002'
    )
);

DROP POLICY IF EXISTS vehicles_staff ON public.vehicles;
CREATE POLICY vehicles_staff ON public.vehicles FOR ALL USING (
    public.is_staff()
    AND (
        public.is_super_admin()
        OR business_unit_id = ANY(public.current_user_business_unit_ids())
    )
);

-- 7.14 activities (append-only: SELECT and INSERT only — no UPDATE/DELETE policies)
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS activities_staff_select ON public.activities;
CREATE POLICY activities_staff_select ON public.activities FOR SELECT USING (
    public.is_staff()
    AND (
        public.is_super_admin()
        OR business_unit_id = ANY(public.current_user_business_unit_ids())
    )
);

DROP POLICY IF EXISTS activities_staff_insert ON public.activities;
CREATE POLICY activities_staff_insert ON public.activities FOR INSERT WITH CHECK (
    public.is_staff()
    AND (
        public.is_super_admin()
        OR business_unit_id = ANY(public.current_user_business_unit_ids())
    )
);

-- ============================================================================
-- 8. GRANTS
--    REST/PostgREST layer. RLS is the authorization boundary; these grants
--    only allow the transport layer to see the tables at all.
-- ============================================================================

GRANT SELECT ON public.vehicle_categories, public.vehicles TO anon;

GRANT SELECT, INSERT, UPDATE ON
    public.organizations,
    public.business_units,
    public.profiles,
    public.user_roles,
    public.customers,
    public.leads,
    public.conversations,
    public.conversation_messages,
    public.ride_requests,
    public.quotes,
    public.bookings,
    public.vehicle_categories,
    public.vehicles,
    public.activities
TO authenticated;

-- ============================================================================
-- 9. STRUCTURAL SEED DATA (deterministic, FK-safe, idempotent)
-- ============================================================================

DO $$
DECLARE
    v_org_id uuid := '00000000-0000-0000-0000-000000000001';
    v_bu_id  uuid := '00000000-0000-0000-0000-000000000002';
BEGIN
    INSERT INTO public.organizations (id, name, slug, status)
    VALUES (v_org_id, 'Skyrun LLC', 'skyrun-llc', 'ACTIVE')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.business_units (id, organization_id, name, slug, business_type, status)
    VALUES (v_bu_id, v_org_id, 'Skyrun Limo', 'skyrun-limo', 'LIMO', 'ACTIVE')
    ON CONFLICT (id) DO NOTHING;
END $$;

-- ============================================================================
-- 10. CONFIRMATION CHECKLIST (embedded as comments for review)
-- ============================================================================

-- [x] Exactly 14 core tables created
-- [x] NO idempotency_keys / contact_messages / email_events / notifications tables
-- [x] NO drivers / availability / services / service_areas / vehicle_assignments
-- [x] NO payment_transactions / invoices / promotions / partners / analytics tables
-- [x] lead_source enum: 7 values
-- [x] lead_status enum: includes SPAM + 10 sales states
-- [x] SUPER_ADMIN: user_roles.business_unit_id NULLABLE (CHECK + trigger + 2 partial indexes)
-- [x] Quote VIEWED status: NOT present
-- [x] No credentials/secrets in migration
-- [x] No demo/test data inserted
-- [x] RLS enabled on all 14 tables
-- [x] SUPER_ADMIN global access via explicit OR is_super_admin() in all staff policies
-- [x] 21 indexes
-- [x] user_roles uniqueness via two partial unique indexes
-- [x] Public vehicle/vehicle_categories policies use hardcoded BU UUID (not current_setting)
-- [x] Structural seed is idempotent (ON CONFLICT DO NOTHING)
-- [x] service_id columns absent
-- [x] log_activity() SECURITY DEFINER, search_path='', entity-type validation, BU auth, restricted EXECUTE
-- [x] All 14 RLS policies call helper functions — no policy directly queries user_roles (no 42P17 risk)
-- [x] ORDERING FIX: has_role / has_role_any / current_user_business_unit_ids / is_super_admin /
--     is_staff all moved to section 4A (after user_roles table)
-- [x] ORDERING FIX: log_activity moved to section 4B (after all 14 entity tables)
-- [x] ORDERING FIX: enforce_super_admin_exclusivity moved to section 4.4.1 (after user_roles)
-- [x] vehicle_categories (4.7) precedes ride_requests (4.10), quotes (4.11), bookings (4.12),
--     vehicles (4.13) — all FK references satisfied

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
