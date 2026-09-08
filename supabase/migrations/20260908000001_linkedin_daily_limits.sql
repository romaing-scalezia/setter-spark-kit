-- Permet a chaque utilisateur de definir ses propres limites d'actions
-- LinkedIn quotidiennes (visites/invitations/messages), a la place des
-- constantes globales figees dans campaign-runner. Defaut 20 = comportement
-- actuel inchange pour tout le monde tant que personne n'y touche.
ALTER TABLE public.memberships
  ADD COLUMN visits_daily_limit   integer NOT NULL DEFAULT 20 CHECK (visits_daily_limit   >= 0),
  ADD COLUMN invites_daily_limit  integer NOT NULL DEFAULT 20 CHECK (invites_daily_limit  >= 0),
  ADD COLUMN messages_daily_limit integer NOT NULL DEFAULT 20 CHECK (messages_daily_limit >= 0);

-- Les users n'ont que SELECT sur memberships (RLS) — cette fonction leur
-- permet de modifier uniquement ces 3 champs sur leur propre ligne, sans
-- ouvrir d'acces UPDATE plus large sur la table (plan/status/stripe...).
CREATE OR REPLACE FUNCTION public.set_linkedin_daily_limits(
  p_visits   integer,
  p_invites  integer,
  p_messages integer
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  UPDATE public.memberships
  SET visits_daily_limit   = GREATEST(0, p_visits),
      invites_daily_limit  = GREATEST(0, p_invites),
      messages_daily_limit = GREATEST(0, p_messages),
      updated_at = now()
  WHERE user_id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.set_linkedin_daily_limits(integer, integer, integer) TO authenticated;
