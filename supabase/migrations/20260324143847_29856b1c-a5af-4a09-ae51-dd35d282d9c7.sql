
-- Add student status to coach_assignments
ALTER TABLE public.coach_assignments
ADD COLUMN IF NOT EXISTS student_status text NOT NULL DEFAULT 'active';
