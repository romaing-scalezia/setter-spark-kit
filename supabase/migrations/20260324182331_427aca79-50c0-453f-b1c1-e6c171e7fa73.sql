-- Allow coaches to update their own assignments (e.g. student_status)
CREATE POLICY "Coaches can update own assignments"
ON public.coach_assignments
FOR UPDATE
TO authenticated
USING (auth.uid() = coach_id)
WITH CHECK (auth.uid() = coach_id);