-- admin-list-users previously computed per-user lead counts by fetching
-- every row of public.leads (select("owner_id")) and tallying in JS. Once
-- the table crosses PostgREST's default 1000-row cap, newer leads silently
-- fall outside the result set and read as 0 for their owner. Aggregating
-- server-side avoids the cap entirely and returns one row per owner instead
-- of one row per lead.
CREATE OR REPLACE FUNCTION public.get_leads_count_by_owner()
RETURNS TABLE(owner_id uuid, lead_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT owner_id, count(*) AS lead_count
  FROM public.leads
  GROUP BY owner_id;
$$;

REVOKE EXECUTE ON FUNCTION public.get_leads_count_by_owner() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_leads_count_by_owner() TO service_role;
