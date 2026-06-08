-- Revoke EXECUTE from PUBLIC and anon on all SECURITY DEFINER helpers,
-- then grant only to authenticated.

DO $$
DECLARE
  fn record;
BEGIN
  FOR fn IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %I.%I(%s) FROM PUBLIC, anon;', fn.nspname, fn.proname, fn.args);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %I.%I(%s) TO authenticated;', fn.nspname, fn.proname, fn.args);
  END LOOP;
END$$;

-- handle_new_user / handle_new_membership are trigger functions on auth.users; they
-- must remain executable by the trigger owner. Triggers run as table owner regardless
-- of grants, but make sure service_role keeps execute for admin tooling.
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_membership() TO service_role;