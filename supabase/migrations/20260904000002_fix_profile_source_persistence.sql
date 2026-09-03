-- profiles.source a un DEFAULT 'organic' (ajoute hors migrations suivies, a
-- une date indeterminee). AuthContext.tsx persistait le vrai source via
-- "UPDATE profiles SET source = ... WHERE source IS NULL" — cette condition
-- ne matche jamais puisque la colonne n'est plus jamais NULL des l'insert.
-- Resultat : au moins 3 vraies inscriptions starterpack recentes (01-02
-- septembre) sont restees etiquetees "organic", perdant silencieusement
-- leur acces starter (has_starter_offer_access derive de profiles.source).
--
-- Fix a la racine : bootstrap_current_user ecrit desormais le source direct-
-- ement depuis les metadata JWT au moment de l'insert (source unique, atomique,
-- plus de course avec un update client-side conditionnel).
CREATE OR REPLACE FUNCTION public.bootstrap_current_user(_full_name text DEFAULT ''::text)
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
  _source text := auth.jwt() -> 'user_metadata' ->> 'source';
  _trial_end timestamptz := now() + interval '14 days';
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.profiles (id, email, full_name, role, source)
  VALUES (_user_id, NULLIF(_email, ''), NULLIF(_name, ''), 'user'::app_role, COALESCE(_source, 'organic'))
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

  INSERT INTO public.memberships (user_id, plan, status, current_period_end)
  VALUES (_user_id, 'free', 'trialing', _trial_end)
  ON CONFLICT (user_id) DO NOTHING;
END;
$$;

-- Repare retroactivement les profils deja crees avec le mauvais source,
-- en se basant sur la vraie valeur presente dans auth.users.
UPDATE public.profiles p
SET source = u.raw_user_meta_data->>'source'
FROM auth.users u
WHERE p.id = u.id
  AND p.source = 'organic'
  AND u.raw_user_meta_data->>'source' IS NOT NULL
  AND u.raw_user_meta_data->>'source' <> 'organic';

-- Rejoue le relabel de 20260904000001 : la reparation ci-dessus peut avoir
-- reintroduit l'ancien slug 'starterpack' depuis les metadata d'origine.
UPDATE public.profiles SET source = 'starterpack-45j' WHERE source = 'starterpack';
