-- Scheduled meeting date, distinct from meeting_booked_at (which records WHEN the
-- lead was moved to "rendez_vous_booke", not the date of the meeting itself).
-- Required (enforced client-side via a modal) before a lead can move to that status.
ALTER TABLE public.leads ADD COLUMN date_rdv date;
