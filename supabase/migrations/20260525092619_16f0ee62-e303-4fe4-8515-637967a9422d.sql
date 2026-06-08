
-- 1. Add setter_id to leads
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS setter_id uuid;

-- Backfill
UPDATE public.leads SET setter_id = owner_id WHERE setter_id IS NULL;

ALTER TABLE public.leads
  ALTER COLUMN setter_id SET NOT NULL;

ALTER TABLE public.leads
  ALTER COLUMN setter_id SET DEFAULT auth.uid();

CREATE INDEX IF NOT EXISTS idx_leads_setter_id ON public.leads(setter_id);

-- 2. Helper: get_team_members(_user_id)
-- Returns the user themselves + any co-students of their coach(es).
CREATE OR REPLACE FUNCTION public.get_team_members(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _user_id
  UNION
  SELECT ca2.user_id
  FROM public.coach_assignments ca1
  JOIN public.coach_assignments ca2 ON ca2.coach_id = ca1.coach_id
  WHERE ca1.user_id = _user_id
    AND ca2.user_id <> _user_id;
$$;

REVOKE EXECUTE ON FUNCTION public.get_team_members(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_team_members(uuid) TO authenticated;

-- 3. Validation trigger: setter must be allowed
CREATE OR REPLACE FUNCTION public.validate_lead_setter()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.setter_id IS NULL THEN
    NEW.setter_id := NEW.owner_id;
  END IF;

  -- Admins bypass
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  -- Owner themselves is always allowed
  IF NEW.setter_id = NEW.owner_id THEN
    RETURN NEW;
  END IF;

  -- Setter must be a teammate of the owner OR the owner's coach
  IF EXISTS (
    SELECT 1 FROM public.get_team_members(NEW.owner_id) gm
    WHERE gm = NEW.setter_id
  ) OR EXISTS (
    SELECT 1 FROM public.coach_assignments ca
    WHERE ca.user_id = NEW.owner_id AND ca.coach_id = NEW.setter_id
  ) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Setter % is not part of the owner team', NEW.setter_id;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_lead_setter ON public.leads;
CREATE TRIGGER trg_validate_lead_setter
BEFORE INSERT OR UPDATE OF setter_id, owner_id ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.validate_lead_setter();
