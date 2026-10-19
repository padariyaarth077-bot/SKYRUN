-- Reviewed local hardening. Hosted execution requires separate approval.
-- Apply before Phase 4 booking/deposit operations on a fresh release.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- Membership alone must never authorize assigning or replacing staff roles.
-- Retain existing own-row SELECT and trusted SUPER_ADMIN FOR ALL policies.
DROP POLICY IF EXISTS user_roles_admin ON public.user_roles;
CREATE POLICY user_roles_staff_select ON public.user_roles
  FOR SELECT TO authenticated USING (
    public.is_staff() AND business_unit_id = ANY(public.current_user_business_unit_ids())
  );
REVOKE ALL ON public.user_roles FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;

-- RLS does not protect TRUNCATE. Revoke all instead of only row-write grants.
-- Controlled postgres-owned functions and trusted server grants stay intact.
REVOKE ALL ON public.bookings, public.activities FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.bookings, public.activities TO authenticated;

-- Existing explicit anon grants survive REVOKE FROM PUBLIC / CREATE OR REPLACE.
REVOKE ALL ON FUNCTION public.log_activity(text, uuid, text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_activity(text, uuid, text, text, jsonb) TO authenticated;
COMMIT;
