-- Allow users to update their own note events
CREATE POLICY "Users can update own note events"
ON public.lead_events
FOR UPDATE
USING (auth.uid() = user_id AND event_type IN ('note_added', 'coach_note_added'))
WITH CHECK (auth.uid() = user_id AND event_type IN ('note_added', 'coach_note_added'));

-- Allow users to delete their own note events
CREATE POLICY "Users can delete own note events"
ON public.lead_events
FOR DELETE
USING (auth.uid() = user_id AND event_type IN ('note_added', 'coach_note_added'));

-- Allow admins to update all lead events
CREATE POLICY "Admins can update all lead events"
ON public.lead_events
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete all lead events
CREATE POLICY "Admins can delete all lead events"
ON public.lead_events
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));