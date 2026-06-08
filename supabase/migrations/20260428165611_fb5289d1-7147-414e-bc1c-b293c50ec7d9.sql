-- 1. Enums
CREATE TYPE public.task_type AS ENUM (
  'conversation_followup',
  'booking_followup',
  'manual_followup'
);

CREATE TYPE public.task_priority AS ENUM ('low', 'medium', 'high', 'urgent');

CREATE TYPE public.task_status AS ENUM ('pending', 'completed', 'cancelled');

-- 2. Tasks table
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL,
  user_id UUID NOT NULL,
  task_type public.task_type NOT NULL,
  priority public.task_priority NOT NULL DEFAULT 'medium',
  due_date DATE NOT NULL,
  status public.task_status NOT NULL DEFAULT 'pending',
  snoozed_until DATE,
  completed_at TIMESTAMPTZ,
  source TEXT NOT NULL DEFAULT 'auto', -- 'auto' or 'manual'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tasks_user_status ON public.tasks(user_id, status);
CREATE INDEX idx_tasks_lead ON public.tasks(lead_id);
CREATE INDEX idx_tasks_due_date ON public.tasks(due_date);

-- Prevent duplicates: only one pending auto-task per (lead, type)
CREATE UNIQUE INDEX uniq_pending_auto_task_per_lead_type
  ON public.tasks(lead_id, task_type)
  WHERE status = 'pending' AND source = 'auto';

-- 3. RLS
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tasks"
  ON public.tasks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own tasks"
  ON public.tasks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tasks"
  ON public.tasks FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own tasks"
  ON public.tasks FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Coaches can view student tasks"
  ON public.tasks FOR SELECT
  USING (public.is_coach_of(auth.uid(), user_id));

CREATE POLICY "Admins can manage all tasks"
  ON public.tasks FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 4. updated_at trigger
CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Helper: add N business days
CREATE OR REPLACE FUNCTION public.add_business_days(_start DATE, _days INT)
RETURNS DATE
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  _d DATE := _start;
  _added INT := 0;
BEGIN
  WHILE _added < _days LOOP
    _d := _d + 1;
    IF EXTRACT(ISODOW FROM _d) < 6 THEN
      _added := _added + 1;
    END IF;
  END LOOP;
  RETURN _d;
END;
$$;

-- 6. Auto task creation/cancellation on lead status change
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
    VALUES (NEW.id, NEW.owner_id, 'conversation_followup', 'medium', (CURRENT_DATE + 2), 'auto')
    ON CONFLICT (lead_id, task_type) WHERE status = 'pending' AND source = 'auto' DO NOTHING;

  ELSIF NEW.status = 'appel_propose' THEN
    INSERT INTO public.tasks (lead_id, user_id, task_type, priority, due_date, source)
    VALUES (NEW.id, NEW.owner_id, 'booking_followup', 'high', public.add_business_days(CURRENT_DATE, 1), 'auto')
    ON CONFLICT (lead_id, task_type) WHERE status = 'pending' AND source = 'auto' DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_lead_status_task
  AFTER INSERT OR UPDATE OF status ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_lead_status_task();

-- 7. Sync manual follow-up date → manual task
CREATE OR REPLACE FUNCTION public.handle_manual_followup_task()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _prio public.task_priority;
BEGIN
  -- Only when status is follow_up and there is a follow_up_date set or changed
  IF NEW.status <> 'follow_up' OR NEW.follow_up_date IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW.follow_up_date IS NOT DISTINCT FROM OLD.follow_up_date
     AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  -- Priority based on follow-up level
  _prio := CASE
    WHEN COALESCE(NEW.follow_up_level, 0) >= 3 THEN 'urgent'::public.task_priority
    WHEN COALESCE(NEW.follow_up_level, 0) = 2 THEN 'high'::public.task_priority
    ELSE 'medium'::public.task_priority
  END;

  -- Cancel previous pending manual followups for this lead
  UPDATE public.tasks
  SET status = 'cancelled', updated_at = now()
  WHERE lead_id = NEW.id
    AND status = 'pending'
    AND task_type = 'manual_followup';

  INSERT INTO public.tasks (lead_id, user_id, task_type, priority, due_date, source)
  VALUES (NEW.id, NEW.owner_id, 'manual_followup', _prio, NEW.follow_up_date, 'manual');

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_lead_manual_followup_task
  AFTER INSERT OR UPDATE OF status, follow_up_date ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_manual_followup_task();