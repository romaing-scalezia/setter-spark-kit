-- Set current_period_start and current_period_end for free users at signup.
-- Previously the free-plan branch inserted no period dates.
CREATE OR REPLACE FUNCTION public.handle_new_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _source text;
BEGIN
  SELECT raw_user_meta_data->>'source'
  INTO _source
  FROM auth.users
  WHERE id = NEW.id;

  IF _source = 'starterpack' THEN
    INSERT INTO public.memberships (user_id, plan, status, current_period_start, current_period_end)
    VALUES (NEW.id, 'starter', 'trialing', now(), now() + interval '14 days')
    ON CONFLICT (user_id) DO NOTHING;
  ELSE
    INSERT INTO public.memberships (user_id, plan, status, current_period_start, current_period_end)
    VALUES (NEW.id, 'free', 'active', now(), now() + interval '14 days')
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;
