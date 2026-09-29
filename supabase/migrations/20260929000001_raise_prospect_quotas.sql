-- Remonte les quotas d'import Sales Nav par defaut (plaintes utilisateurs sur
-- les 400/mois free/starter, trop bas pour un usage normal).
CREATE OR REPLACE FUNCTION public.get_prospect_quota(p_plan membership_plan)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN CASE p_plan
    WHEN 'free'    THEN 2500
    WHEN 'starter' THEN 2500
    WHEN 'pro'     THEN 5000
    WHEN 'coach'   THEN 0     -- coaches n'importent pas de prospects
    ELSE 0
  END;
END;
$$;
