-- Suite de 20260901000001 : plan repassait a 'free' pour les essais
-- expires, mais status restait 'trialing' pour toujours (rien ne le fait
-- jamais evoluer). Consequence visible : le badge admin ("Essai · J-X")
-- se base sur status, pas sur plan, et le calcul des jours restants est
-- plafonne a 0 -> ces comptes affichaient "Essai · J-0" indefiniment,
-- des semaines apres expiration reelle.
-- Aucun impact sur l'acces : TrialGuard bloque deja ces comptes de la
-- meme maniere (canAccess ne distingue pas 'trialing expire' de
-- 'canceled'), seul l'affichage change.
CREATE OR REPLACE FUNCTION public.normalize_expired_membership_plans()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.memberships
  SET plan = 'free',
      status = 'canceled'
  WHERE status <> 'active'
    AND status <> 'canceled'
    AND current_period_end < now()
    AND stripe_subscription_id IS NULL;
$$;

-- Applique immediatement aux comptes deja bascules sur 'free' par la
-- migration precedente (leur status etait reste 'trialing').
SELECT public.normalize_expired_membership_plans();
