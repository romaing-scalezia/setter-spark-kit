ALTER TABLE public.leads ADD COLUMN follow_up_level integer NOT NULL DEFAULT 0;

-- Set existing follow_up leads to level 1
UPDATE public.leads SET follow_up_level = 1 WHERE status = 'follow_up' AND follow_up_level = 0;