-- Passe le trial starterpack de 14 à 30 jours
CREATE OR REPLACE FUNCTION public.handle_new_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _source text;
BEGIN
  SELECT raw_user_meta_data->>'source'
  INTO _source
  FROM auth.users
  WHERE id = NEW.id;

  IF _source = 'starterpack' THEN
    INSERT INTO public.memberships (user_id, plan, status, current_period_start, current_period_end)
    VALUES (NEW.id, 'starter', 'trialing', now(), now() + interval '30 days')
    ON CONFLICT (user_id) DO NOTHING;
  ELSE
    INSERT INTO public.memberships (user_id, plan, status)
    VALUES (NEW.id, 'free', 'active')
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.activate_starterpack_trial()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _source text;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT raw_user_meta_data->>'source'
  INTO _source
  FROM auth.users
  WHERE id = _user_id;

  IF _source = 'starterpack' THEN
    UPDATE public.memberships
    SET
      plan = 'starter',
      status = 'trialing',
      current_period_start = now(),
      current_period_end = now() + interval '30 days'
    WHERE user_id = _user_id
      AND plan = 'free'
      AND status = 'active';
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.activate_starterpack_trial() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.activate_starterpack_trial() TO authenticated;
