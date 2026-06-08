
-- 1. Prevent privilege escalation: users cannot update the role column on their own profile
REVOKE UPDATE (role) ON public.profiles FROM authenticated, anon, public;
GRANT UPDATE (role) ON public.profiles TO service_role;

-- 2. Re-assert: anon cannot execute SECURITY DEFINER helper functions
REVOKE EXECUTE ON FUNCTION public.bootstrap_current_user(text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.set_user_role(uuid, public.app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.set_debug_role_access(uuid, boolean) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_coach_of(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_coached_user_ids(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_team_members(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_workspace_member(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_workspace_owner(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_user_streak(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_leaderboard(timestamptz, timestamptz, uuid) FROM anon, public;

GRANT EXECUTE ON FUNCTION public.bootstrap_current_user(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_user_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_debug_role_access(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_coach_of(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_coached_user_ids(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_team_members(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_workspace_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_workspace_owner(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_streak(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_leaderboard(timestamptz, timestamptz, uuid) TO authenticated;
