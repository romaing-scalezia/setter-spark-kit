
-- 1. Workspaces (explicit teams)
CREATE TABLE IF NOT EXISTS public.workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  owner_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

-- 2. Workspace members
CREATE TABLE IF NOT EXISTS public.workspace_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id)
);

ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

-- 3. Helpers (security definer to avoid recursive RLS)
CREATE OR REPLACE FUNCTION public.is_workspace_member(_workspace_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = _workspace_id AND user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_workspace_owner(_workspace_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspaces
    WHERE id = _workspace_id AND owner_id = _user_id
  );
$$;

-- 4. Redefine get_team_members: explicit workspace membership ONLY
CREATE OR REPLACE FUNCTION public.get_team_members(_user_id uuid)
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _user_id
  UNION
  SELECT wm2.user_id
  FROM public.workspace_members wm1
  JOIN public.workspace_members wm2 ON wm2.workspace_id = wm1.workspace_id
  WHERE wm1.user_id = _user_id
    AND wm2.user_id <> _user_id;
$$;

-- 5. RLS for workspaces
DROP POLICY IF EXISTS "Admins manage all workspaces" ON public.workspaces;
CREATE POLICY "Admins manage all workspaces" ON public.workspaces
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Users create own workspaces" ON public.workspaces;
CREATE POLICY "Users create own workspaces" ON public.workspaces
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Owners update own workspace" ON public.workspaces;
CREATE POLICY "Owners update own workspace" ON public.workspaces
  FOR UPDATE TO authenticated
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Owners delete own workspace" ON public.workspaces;
CREATE POLICY "Owners delete own workspace" ON public.workspaces
  FOR DELETE TO authenticated
  USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Members view workspace" ON public.workspaces;
CREATE POLICY "Members view workspace" ON public.workspaces
  FOR SELECT TO authenticated
  USING (auth.uid() = owner_id OR public.is_workspace_member(id, auth.uid()));

-- 6. RLS for workspace_members
DROP POLICY IF EXISTS "Admins manage all workspace members" ON public.workspace_members;
CREATE POLICY "Admins manage all workspace members" ON public.workspace_members
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Owner manages members" ON public.workspace_members;
CREATE POLICY "Owner manages members" ON public.workspace_members
  FOR ALL TO authenticated
  USING (public.is_workspace_owner(workspace_id, auth.uid()))
  WITH CHECK (public.is_workspace_owner(workspace_id, auth.uid()));

DROP POLICY IF EXISTS "Members view co-members" ON public.workspace_members;
CREATE POLICY "Members view co-members" ON public.workspace_members
  FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()));

DROP POLICY IF EXISTS "Users leave workspace" ON public.workspace_members;
CREATE POLICY "Users leave workspace" ON public.workspace_members
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
