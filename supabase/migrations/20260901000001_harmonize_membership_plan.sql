-- Harmonisation du champ memberships.plan : il ne doit refleter que la
-- realite de facturation (starter/pro = abonnement Stripe reel actif, OU
-- essai en cours non expire). Une fois l'essai expire sans conversion,
-- l'acces est deja coupe par TrialGuard (via status/current_period_end) —
-- garder un plan "starter" affiche a ce moment-la n'a plus de sens et
-- fausse le suivi admin (badge, KPI).
CREATE OR REPLACE FUNCTION public.normalize_expired_membership_plans()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.memberships
  SET plan = 'free'
  WHERE plan <> 'free'
    AND status <> 'active'
    AND current_period_end < now()
    AND stripe_subscription_id IS NULL;
$$;

REVOKE EXECUTE ON FUNCTION public.normalize_expired_membership_plans() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.normalize_expired_membership_plans() TO service_role;

-- Nettoyage immediat de l'historique (35 comptes essai-expire concernes,
-- dont 13 encore etiquetes "starter" a ce jour).
SELECT public.normalize_expired_membership_plans();

-- Reconduit automatiquement chaque nuit pour ne plus jamais se re-desynchroniser.
SELECT cron.schedule(
  'normalize-expired-membership-plans-daily',
  '0 3 * * *',
  $$ SELECT public.normalize_expired_membership_plans(); $$
);

-- Colonne jamais lue nulle part dans le code (verifie) — pur bruit, source
-- de confusion avec current_period_end qui joue deja ce role.
ALTER TABLE public.memberships DROP COLUMN IF EXISTS trial_ends_at;
