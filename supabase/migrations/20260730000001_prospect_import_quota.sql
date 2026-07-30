-- ============================================================
-- Prospect import quota system
-- Tracks API-based imports (Sales Nav, programmatic search)
-- CSV imports are never counted
-- ============================================================

-- ── 1. Add quota columns to memberships ──────────────────────
ALTER TABLE public.memberships
  ADD COLUMN IF NOT EXISTS prospects_imported_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS prospects_imported_reset_at timestamptz NOT NULL DEFAULT now();

-- ── 2. Quota limits per plan ─────────────────────────────────
-- Returns the monthly prospect import quota for a given plan
CREATE OR REPLACE FUNCTION public.get_prospect_quota(p_plan membership_plan)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN CASE p_plan
    WHEN 'free'    THEN 400
    WHEN 'starter' THEN 400
    WHEN 'pro'     THEN 2000  -- à ajuster
    WHEN 'coach'   THEN 0     -- coaches n'importent pas de prospects
    ELSE 0
  END;
END;
$$;

-- ── 3. Increment prospect import counter ─────────────────────
-- Call this after a successful API import
-- Returns error if quota exceeded, new count if ok
CREATE OR REPLACE FUNCTION public.increment_prospect_imports(
  p_user_id uuid,
  p_count integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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

  _quota := get_prospect_quota(_membership.plan);
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

-- ── 4. Monthly reset cron (pg_cron) ──────────────────────────
-- Runs on the 1st of each month at 00:00 UTC
SELECT cron.schedule(
  'reset-prospect-import-quotas',
  '0 0 1 * *',
  $$
    UPDATE public.memberships
    SET
      prospects_imported_count = 0,
      prospects_imported_reset_at = now(),
      updated_at = now()
    WHERE prospects_imported_count > 0;
  $$
);
