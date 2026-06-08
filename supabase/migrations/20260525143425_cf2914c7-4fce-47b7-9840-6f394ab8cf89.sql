
-- 1. Add UPDATE policy for custom_reasons
CREATE POLICY "Users can update own custom reasons"
ON public.custom_reasons
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 2. Restrict user_achievements INSERT policy to authenticated role
DROP POLICY IF EXISTS "Users can insert own achievements" ON public.user_achievements;
CREATE POLICY "Users can insert own achievements"
ON public.user_achievements
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- 3. Restrict access to sensitive Stripe columns on memberships
REVOKE SELECT (stripe_subscription_id, stripe_customer_id) ON public.memberships FROM authenticated, anon;

-- 4. Revoke EXECUTE on SECURITY DEFINER helper functions from anon (callable only by authenticated)
REVOKE EXECUTE ON FUNCTION public.bootstrap_current_user(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_user_role(uuid, public.app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_debug_role_access(uuid, boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_coach_of(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_coached_user_ids(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_team_members(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_workspace_member(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_workspace_owner(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_user_streak(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_leaderboard(timestamptz, timestamptz, uuid) FROM anon;
