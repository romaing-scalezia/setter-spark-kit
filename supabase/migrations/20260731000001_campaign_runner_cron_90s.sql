-- Passe le campaign-runner de 5min à 1min + round-robin par user
SELECT cron.unschedule('campaign-runner-every-5min');

SELECT cron.schedule(
  'campaign-runner-every-1min',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://dapknmdmwnkwkboszynv.supabase.co/functions/v1/campaign-runner',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRhcGtubWRtd25rd2tib3N6eW52Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTA4OTUwMCwiZXhwIjoyMDk2NjY1NTAwfQ.jpbQh3wtchRYeR2Smo6DRZgX3ZOrz17z51TwA5_SOm4'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  )
  $$
);
