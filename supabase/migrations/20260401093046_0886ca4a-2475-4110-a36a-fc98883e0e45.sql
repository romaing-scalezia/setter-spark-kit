
-- Create membership plan enum
CREATE TYPE public.membership_plan AS ENUM ('free', 'starter', 'pro', 'coach');

-- Create membership status enum
CREATE TYPE public.membership_status AS ENUM ('active', 'trialing', 'canceled', 'past_due', 'incomplete');

-- Create memberships table
CREATE TABLE public.memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  plan membership_plan NOT NULL DEFAULT 'free',
  status membership_status NOT NULL DEFAULT 'active',
  current_period_start timestamptz,
  current_period_end timestamptz,
  stripe_customer_id text,
  stripe_subscription_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;

-- Users can view own membership
CREATE POLICY "Users can view own membership"
ON public.memberships FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Admins can view all memberships
CREATE POLICY "Admins can view all memberships"
ON public.memberships FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Service role inserts/updates via webhook (no user-facing insert/update policies needed)

-- Auto-create free membership on user creation
CREATE OR REPLACE FUNCTION public.handle_new_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.memberships (user_id, plan, status)
  VALUES (NEW.id, 'free', 'active')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_profile_created_membership
AFTER INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_membership();

-- Updated_at trigger
CREATE TRIGGER update_memberships_updated_at
BEFORE UPDATE ON public.memberships
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
