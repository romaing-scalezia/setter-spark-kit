-- Permet d'accorder un quota d'import Sales Nav personnalise a un
-- utilisateur specifique, sans avoir a mentir sur son plan (qui doit
-- rester le reflet de la facturation reelle — cf. harmonisation du
-- 2026-09-01). NULL = pas de surcharge, on retombe sur le quota du plan.
ALTER TABLE public.memberships
  ADD COLUMN IF NOT EXISTS prospects_import_quota_override integer;

CREATE OR REPLACE FUNCTION public.increment_prospect_imports(
  p_user_id uuid,
  p_count integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _membership memberships%ROWTYPE;
  _quota integer;
  _new_count integer;
BEGIN
  SELECT * INTO _membership
  FROM memberships
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'membership_not_found');
  END IF;

  -- Reset counter if we're in a new month
  IF date_trunc('month', _membership.prospects_imported_reset_at) < date_trunc('month', now()) THEN
    _membership.prospects_imported_count := 0;
    _membership.prospects_imported_reset_at := now();
  END IF;

  _quota := COALESCE(_membership.prospects_import_quota_override, get_prospect_quota(_membership.plan));
  _new_count := _membership.prospects_imported_count + p_count;

  IF _new_count > _quota THEN
    RETURN jsonb_build_object(
      'error', 'quota_exceeded',
      'current', _membership.prospects_imported_count,
      'quota', _quota,
      'requested', p_count
    );
  END IF;

  UPDATE memberships SET
    prospects_imported_count = _new_count,
    prospects_imported_reset_at = CASE
      WHEN date_trunc('month', prospects_imported_reset_at) < date_trunc('month', now())
      THEN now()
      ELSE prospects_imported_reset_at
    END,
    updated_at = now()
  WHERE user_id = p_user_id;

  RETURN jsonb_build_object(
    'ok', true,
    'new_count', _new_count,
    'quota', _quota,
    'remaining', _quota - _new_count
  );
END;
$$;

-- Accorde 1000/mois a Laura Paillet.
UPDATE public.memberships
SET prospects_import_quota_override = 1000
WHERE user_id = 'cb93fb05-8a29-4c21-8bd0-9d9c9e3bad1d';
