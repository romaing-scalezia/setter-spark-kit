-- Fix: restrict coach UPDATE on leads to coach_notes column only.
-- Previously the policy allowed UPDATE on the entire row (frontend-only restriction).

DROP POLICY IF EXISTS "Coaches can update coach_notes on their students leads" ON public.leads;

CREATE POLICY "Coaches can update coach_notes on their students leads"
ON public.leads
FOR UPDATE
TO authenticated
USING (public.is_coach_of(auth.uid(), owner_id))
WITH CHECK (public.is_coach_of(auth.uid(), owner_id));

-- Column-level security via a trigger: reject any coach UPDATE that touches columns other than coach_notes.
CREATE OR REPLACE FUNCTION public.restrict_coach_lead_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only apply restriction to coaches (not admins or the lead owner)
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  IF auth.uid() = OLD.owner_id THEN
    RETURN NEW;
  END IF;

  -- Coach path: only coach_notes may change
  IF (
    NEW.status                    IS DISTINCT FROM OLD.status                    OR
    NEW.first_name                IS DISTINCT FROM OLD.first_name                OR
    NEW.last_name                 IS DISTINCT FROM OLD.last_name                 OR
    NEW.linkedin_url              IS DISTINCT FROM OLD.linkedin_url              OR
    NEW.company_name              IS DISTINCT FROM OLD.company_name              OR
    NEW.job_title                 IS DISTINCT FROM OLD.job_title                 OR
    NEW.source_type               IS DISTINCT FROM OLD.source_type               OR
    NEW.campaign_tag              IS DISTINCT FROM OLD.campaign_tag              OR
    NEW.outreach_type             IS DISTINCT FROM OLD.outreach_type             OR
    NEW.notes                     IS DISTINCT FROM OLD.notes                     OR
    NEW.follow_up_date            IS DISTINCT FROM OLD.follow_up_date            OR
    NEW.loss_reason               IS DISTINCT FROM OLD.loss_reason               OR
    NEW.disqualification_reason   IS DISTINCT FROM OLD.disqualification_reason   OR
    NEW.custom_tags               IS DISTINCT FROM OLD.custom_tags               OR
    NEW.conversation_started_at   IS DISTINCT FROM OLD.conversation_started_at   OR
    NEW.first_response_at         IS DISTINCT FROM OLD.first_response_at         OR
    NEW.call_proposed_at          IS DISTINCT FROM OLD.call_proposed_at          OR
    NEW.meeting_booked_at         IS DISTINCT FROM OLD.meeting_booked_at         OR
    NEW.closed_lost_at            IS DISTINCT FROM OLD.closed_lost_at            OR
    NEW.unqualified_at            IS DISTINCT FROM OLD.unqualified_at            OR
    NEW.persona_id                IS DISTINCT FROM OLD.persona_id                OR
    NEW.setter_id                 IS DISTINCT FROM OLD.setter_id
  ) THEN
    RAISE EXCEPTION 'Coaches can only update the coach_notes field on a lead';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS restrict_coach_lead_update_trigger ON public.leads;
CREATE TRIGGER restrict_coach_lead_update_trigger
  BEFORE UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.restrict_coach_lead_update();
