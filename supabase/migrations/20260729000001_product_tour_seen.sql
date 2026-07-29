-- Persist product tour completion per-account so it doesn't re-appear on
-- every login (previously only tracked via a localStorage flag, which is
-- lost on tab close before the tour finishes, or on another device/browser).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS product_tour_seen boolean NOT NULL DEFAULT false;
