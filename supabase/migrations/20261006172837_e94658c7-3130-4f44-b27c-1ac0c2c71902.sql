CREATE OR REPLACE FUNCTION public.bootstrap_first_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_user_id uuid := auth.uid();
BEGIN
  IF current_user_id IS NULL THEN
    RETURN false;
  END IF;

  PERFORM pg_advisory_xact_lock(574839201::bigint);

  IF EXISTS (
    SELECT 1 FROM public.user_roles WHERE role = 'SUPER_ADMIN'::public.app_role
  ) THEN
    RETURN EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = current_user_id AND role = 'SUPER_ADMIN'::public.app_role
    );
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (current_user_id, 'SUPER_ADMIN'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.bootstrap_first_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bootstrap_first_admin() TO authenticated;