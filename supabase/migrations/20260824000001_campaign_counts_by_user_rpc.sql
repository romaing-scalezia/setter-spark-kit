-- Aggregated server-side (GROUP BY user_id, status) instead of fetching every
-- campaign row client-side: avoids PostgREST's default 1000-row cap silently
-- truncating the result once the table grows past it (see get_leads_count_by_owner).
CREATE OR REPLACE FUNCTION public.get_campaign_counts_by_user()
RETURNS TABLE(user_id uuid, status text, campaign_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT user_id, status::text, count(*) AS campaign_count
  FROM public.campaigns
  GROUP BY user_id, status;
$$;

REVOKE EXECUTE ON FUNCTION public.get_campaign_counts_by_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_campaign_counts_by_user() TO service_role;
