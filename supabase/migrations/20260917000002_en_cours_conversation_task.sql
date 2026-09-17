-- Le statut "en_cours" ne generait aucune task de relance automatique,
-- contrairement a "conversation_engagee" qui en cree une (conversation_followup).
-- On aligne le comportement : meme trigger, meme task_type.
CREATE OR REPLACE FUNCTION public.handle_lead_status_task()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  UPDATE public.tasks
  SET status = 'cancelled', updated_at = now()
  WHERE lead_id = NEW.id
    AND status = 'pending'
    AND source = 'auto'
    AND task_type IN ('conversation_followup', 'booking_followup', 'rdv_result');

  IF NEW.status IN ('conversation_engagee', 'en_cours') THEN
    INSERT INTO public.tasks (lead_id, user_id, task_type, priority, due_date, source)
    VALUES (NEW.id, NEW.owner_id, 'conversation_followup', 'medium', public.snap_to_business_day(CURRENT_DATE + 2), 'auto')
    ON CONFLICT (lead_id, task_type) WHERE status = 'pending' AND source = 'auto' DO NOTHING;

  ELSIF NEW.status = 'appel_propose' THEN
    INSERT INTO public.tasks (lead_id, user_id, task_type, priority, due_date, source)
    VALUES (NEW.id, NEW.owner_id, 'booking_followup', 'high', public.add_business_days(CURRENT_DATE, 1), 'auto')
    ON CONFLICT (lead_id, task_type) WHERE status = 'pending' AND source = 'auto' DO NOTHING;

  ELSIF NEW.status = 'rendez_vous_booke' AND NEW.date_rdv IS NOT NULL THEN
    INSERT INTO public.tasks (lead_id, user_id, task_type, priority, due_date, source)
    VALUES (NEW.id, NEW.owner_id, 'rdv_result', 'high', NEW.date_rdv + 1, 'auto')
    ON CONFLICT (lead_id, task_type) WHERE status = 'pending' AND source = 'auto' DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- Backfill : leads deja en_cours aujourd'hui sans task de relance pending.
-- Due immediatement (CURRENT_DATE) puisque ces leads sont deja "en cours"
-- depuis un temps indetermine.
INSERT INTO public.tasks (lead_id, user_id, task_type, priority, due_date, source)
SELECT l.id, l.owner_id, 'conversation_followup', 'medium', CURRENT_DATE, 'auto'
FROM public.leads l
WHERE l.status = 'en_cours'
  AND NOT EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.lead_id = l.id AND t.status = 'pending' AND t.task_type = 'conversation_followup'
  );
