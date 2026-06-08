
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS business_type text,
  ADD COLUMN IF NOT EXISTS industry text,
  ADD COLUMN IF NOT EXISTS monthly_revenue text,
  ADD COLUMN IF NOT EXISTS prospecting_volume text,
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false;
