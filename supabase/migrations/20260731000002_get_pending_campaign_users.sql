CREATE OR REPLACE FUNCTION public.get_pending_campaign_users()
RETURNS TABLE(user_id uuid)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT user_id
  FROM campaign_jobs
  WHERE status = 'pending'
    AND execute_at <= now();
$$;
