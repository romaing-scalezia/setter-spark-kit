-- Give every new user the same 14-day trial as the starterpack channel, instead of
-- silently defaulting non-starterpack signups (organic self-signup, admin-created users)
-- to a permanent free/active membership that never shows as a trial.
CREATE OR REPLACE FUNCTION public.handle_new_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.memberships (user_id, plan, status, current_period_start, current_period_end)
  VALUES (NEW.id, 'starter', 'trialing', now(), now() + interval '14 days')
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;
