-- check-sales-nav-weekly a échoué à chaque exécution depuis sa création :
-- current_setting('app.supabase_url') / app.service_role_key n'ont jamais
-- été définis en base. On reprend le pattern déjà utilisé par
-- campaign-runner-every-1min (URL + JWT service_role en dur).
SELECT cron.unschedule('check-sales-nav-weekly');

SELECT cron.schedule(
  'check-sales-nav-weekly',
  '0 8 * * 1',
  $$
    SELECT net.http_post(
      url := 'https://dapknmdmwnkwkboszynv.supabase.co/functions/v1/check-sales-nav',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRhcGtubWRtd25rd2tib3N6eW52Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTA4OTUwMCwiZXhwIjoyMDk2NjY1NTAwfQ.jpbQh3wtchRYeR2Smo6DRZgX3ZOrz17z51TwA5_SOm4'
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 30000
    );
  $$
);
