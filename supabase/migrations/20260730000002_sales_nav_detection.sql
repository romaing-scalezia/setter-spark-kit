-- ============================================================
-- Sales Navigator detection
-- has_sales_nav: set on LinkedIn connect + checked weekly
-- ============================================================

-- ── 1. Add columns to profiles ───────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS has_sales_nav boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sales_nav_checked_at timestamptz;

-- ── 2. Weekly cron — re-check Sales Nav for all connected users
-- Runs every Monday at 08:00 UTC
-- The actual API call is done by the check-sales-nav Edge Function
SELECT cron.schedule(
  'check-sales-nav-weekly',
  '0 8 * * 1',
  $$
    SELECT net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/check-sales-nav',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key')
      ),
      body := '{}'::jsonb
    );
  $$
);
