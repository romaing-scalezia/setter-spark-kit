-- =========================================================
-- SECURITY HARDENING MIGRATION
-- =========================================================

-- ----- 1. MEMBERSHIPS -----
-- Memberships are auto-created via handle_new_membership() trigger (server-side, security definer).
-- Lock down: only authenticated users see their own; only admins manage. No client writes.
DROP POLICY IF EXISTS "Users can view own membership" ON public.memberships;
DROP POLICY IF EXISTS "Admins can view all memberships" ON public.memberships;

CREATE POLICY "Users can view own membership"
  ON public.memberships
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage memberships"
  ON public.memberships
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Ensure trigger exists to auto-create membership for new users (server-side)
DROP TRIGGER IF EXISTS on_auth_user_created_membership ON auth.users;
CREATE TRIGGER on_auth_user_created_membership
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_membership();

-- ----- 2. COACHING CONTENTS -----
-- Restrict all policies to authenticated role (no anon).
DROP POLICY IF EXISTS "Admins can manage all contents" ON public.coaching_contents;
DROP POLICY IF EXISTS "Admins can view all contents" ON public.coaching_contents;
DROP POLICY IF EXISTS "Coaches can create contents" ON public.coaching_contents;
DROP POLICY IF EXISTS "Coaches can delete their contents" ON public.coaching_contents;
DROP POLICY IF EXISTS "Coaches can update their contents" ON public.coaching_contents;
DROP POLICY IF EXISTS "Coaches can view contents of their students" ON public.coaching_contents;
DROP POLICY IF EXISTS "Coaches can view contents they created" ON public.coaching_contents;
DROP POLICY IF EXISTS "Users can create own contents" ON public.coaching_contents;
DROP POLICY IF EXISTS "Users can view contents targeted to them" ON public.coaching_contents;
DROP POLICY IF EXISTS "Users can view global contents" ON public.coaching_contents;
DROP POLICY IF EXISTS "Users can view own contents" ON public.coaching_contents;

CREATE POLICY "Admins manage all contents"
  ON public.coaching_contents FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Coaches create contents"
  ON public.coaching_contents FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'coach'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Coaches update own contents"
  ON public.coaching_contents FOR UPDATE TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Coaches delete own contents"
  ON public.coaching_contents FOR DELETE TO authenticated
  USING (auth.uid() = created_by);

CREATE POLICY "Coaches view student contents"
  ON public.coaching_contents FOR SELECT TO authenticated
  USING (target_user_id IS NOT NULL AND public.is_coach_of(auth.uid(), target_user_id));

CREATE POLICY "Coaches view own created contents"
  ON public.coaching_contents FOR SELECT TO authenticated
  USING (auth.uid() = created_by);

CREATE POLICY "Users create own contents"
  ON public.coaching_contents FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id AND target_user_id IS NULL);

CREATE POLICY "Users view contents targeted to them"
  ON public.coaching_contents FOR SELECT TO authenticated
  USING (auth.uid() = target_user_id);

CREATE POLICY "Authenticated users view global contents"
  ON public.coaching_contents FOR SELECT TO authenticated
  USING (is_global = true);

CREATE POLICY "Users view own contents"
  ON public.coaching_contents FOR SELECT TO authenticated
  USING (auth.uid() = owner_id);

-- ----- 3. USER ROLES -----
-- Lock policies to authenticated only. UNIQUE(user_id) already exists.
-- Keep "Users can create own default role" (only allows role='user' for own id) so signup flow works
-- alongside the handle_new_user trigger (which is the primary mechanism, server-side).
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;

CREATE POLICY "Admins manage roles"
  ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins view all roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users view own roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Ensure the handle_new_user trigger exists (server-side default role assignment)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();