-- Auto follow-up tasks created after a status change to 'conversation_engagee'
-- were due CURRENT_DATE + 2 calendar days, which can land on a Saturday or
-- Sunday. Snap that date forward to the following Monday so auto reminders
-- always fall on a business day.
CREATE OR REPLACE FUNCTION public.snap_to_business_day(_date DATE)
RETURNS DATE
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE EXTRACT(ISODOW FROM _date)
    WHEN 6 THEN _date + 2  -- Saturday -> Monday
    WHEN 7 THEN _date + 1  -- Sunday -> Monday
    ELSE _date
  END;
$$;

CREATE OR REPLACE FUNCTION public.handle_lead_status_task()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only react when status actually changes (or on insert)
  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  -- Cancel any pending auto-tasks that are no longer relevant for this lead
  -- (a status change makes prior auto-tasks obsolete)
  UPDATE public.tasks
  SET status = 'cancelled', updated_at = now()
  WHERE lead_id = NEW.id
    AND status = 'pending'
    AND source = 'auto'
    AND task_type IN ('conversation_followup', 'booking_followup');

  -- Create new auto-task based on the new status
  IF NEW.status = 'conversation_engagee' THEN
    INSERT INTO public.tasks (lead_id, user_id, task_type, priority, due_date, source)
    VALUES (NEW.id, NEW.owner_id, 'conversation_followup', 'medium', public.snap_to_business_day(CURRENT_DATE + 2), 'auto')
    ON CONFLICT (lead_id, task_type) WHERE status = 'pending' AND source = 'auto' DO NOTHING;

  ELSIF NEW.status = 'appel_propose' THEN
    INSERT INTO public.tasks (lead_id, user_id, task_type, priority, due_date, source)
    VALUES (NEW.id, NEW.owner_id, 'booking_followup', 'high', public.add_business_days(CURRENT_DATE, 1), 'auto')
    ON CONFLICT (lead_id, task_type) WHERE status = 'pending' AND source = 'auto' DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;
