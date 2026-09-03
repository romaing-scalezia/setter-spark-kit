-- Remplace le systeme "source = 'starterpack'" (compare en dur a 7 endroits
-- differents dans le code) par une vraie table de reference. Objectif :
-- supporter plusieurs offres avec des durees d'essai differentes sans avoir
-- a mettre a jour une comparaison de chaine a chaque nouvel endroit.
CREATE TABLE public.offers (
  slug text PRIMARY KEY,
  label text NOT NULL,
  trial_days integer NOT NULL CHECK (trial_days > 0),
  plan membership_plan NOT NULL DEFAULT 'starter',
  grants_starter_access boolean NOT NULL DEFAULT true,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;

-- Lecture ouverte aux utilisateurs connectes : AuthContext doit pouvoir
-- resoudre les droits (grants_starter_access) associes a son propre profil.
CREATE POLICY "Authenticated users can view offers" ON public.offers
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage offers" ON public.offers
  FOR ALL USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.offers (slug, label, trial_days, plan, grants_starter_access, active) VALUES
  ('starterpack-45j', 'Starterpack 6 semaines', 45, 'starter', true, true),
  ('starterpack-70j', 'Starterpack 10 semaines', 70, 'starter', true, true);

-- Relabellise l'historique : les comptes deja sur l'ancienne offre unique
-- ('starterpack', 30 jours) rejoignent la nomenclature 45j — purement
-- cosmetique, ne touche pas leur essai deja en cours ou termine.
UPDATE public.profiles SET source = 'starterpack-45j' WHERE source = 'starterpack';

-- ── Activation a l'inscription (remplace activate_starterpack_trial) ──────
CREATE OR REPLACE FUNCTION public.activate_offer_trial()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _source text;
  _offer offers%ROWTYPE;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT raw_user_meta_data->>'source' INTO _source
  FROM auth.users WHERE id = _user_id;

  IF _source IS NULL THEN
    RETURN;
  END IF;

  SELECT * INTO _offer FROM public.offers WHERE slug = _source AND active = true;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  UPDATE public.memberships SET
    plan = _offer.plan,
    status = 'trialing',
    current_period_start = now(),
    current_period_end = now() + (_offer.trial_days || ' days')::interval
  WHERE user_id = _user_id
    AND plan = 'free'
    AND status = 'active';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.activate_offer_trial() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.activate_offer_trial() TO authenticated;

DROP FUNCTION IF EXISTS public.activate_starterpack_trial();

-- ── Application manuelle d'une offre par un admin ─────────────────────────
CREATE OR REPLACE FUNCTION public.admin_apply_offer(p_user_id uuid, p_slug text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _offer offers%ROWTYPE;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO _offer FROM public.offers WHERE slug = p_slug AND active = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown or inactive offer: %', p_slug;
  END IF;

  UPDATE public.profiles SET source = p_slug WHERE id = p_user_id;

  UPDATE public.memberships SET
    plan = _offer.plan,
    status = 'trialing',
    current_period_start = now(),
    current_period_end = now() + (_offer.trial_days || ' days')::interval
  WHERE user_id = p_user_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_apply_offer(uuid, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.admin_apply_offer(uuid, text) TO authenticated;
