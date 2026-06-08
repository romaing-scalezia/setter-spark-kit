ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS role public.app_role NOT NULL DEFAULT 'user'::app_role,
ADD COLUMN IF NOT EXISTS debug_role_switch_enabled boolean NOT NULL DEFAULT false;

INSERT INTO public.user_roles (user_id, role)
SELECT p.id, COALESCE(p.role, 'user'::app_role)
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.id
);

UPDATE public.profiles p
SET role = COALESCE(
  (SELECT ur.role FROM public.user_roles ur WHERE ur.user_id = p.id LIMIT 1),
  'user'::app_role
);

CREATE OR REPLACE FUNCTION public.bootstrap_current_user(_full_name text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _email text := COALESCE(auth.jwt() ->> 'email', '');
  _name text := COALESCE(
    NULLIF(_full_name, ''),
    auth.jwt() -> 'user_metadata' ->> 'full_name',
    auth.jwt() ->> 'full_name',
    ''
  );
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (_user_id, NULLIF(_email, ''), NULLIF(_name, ''), 'user'::app_role)
  ON CONFLICT (id) DO UPDATE
  SET email = COALESCE(EXCLUDED.email, public.profiles.email),
      full_name = COALESCE(NULLIF(public.profiles.full_name, ''), EXCLUDED.full_name);

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, 'user'::app_role)
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.profiles p
  SET role = ur.role
  FROM public.user_roles ur
  WHERE p.id = _user_id AND ur.user_id = _user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_user_role(_target_user_id uuid, _role public.app_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _self_debug_enabled boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT COALESCE(debug_role_switch_enabled, false)
  INTO _self_debug_enabled
  FROM public.profiles
  WHERE id = auth.uid();

  IF NOT public.has_role(auth.uid(), 'admin'::app_role)
     AND NOT (auth.uid() = _target_user_id AND _self_debug_enabled) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_target_user_id, _role)
  ON CONFLICT (user_id)
  DO UPDATE SET role = EXCLUDED.role;

  UPDATE public.profiles
  SET role = _role
  WHERE id = _target_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_debug_role_access(_target_user_id uuid, _enabled boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.profiles
  SET debug_role_switch_enabled = _enabled
  WHERE id = _target_user_id;
END;
$$;

DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
CREATE POLICY "Admins can update all profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));