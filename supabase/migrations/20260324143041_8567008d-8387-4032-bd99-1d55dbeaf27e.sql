
-- Table for storing unlocked achievements/badges
CREATE TABLE public.user_achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  badge_key text NOT NULL,
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, badge_key)
);

ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own achievements" ON public.user_achievements
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own achievements" ON public.user_achievements
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all achievements" ON public.user_achievements
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Coaches can view student achievements" ON public.user_achievements
  FOR SELECT USING (public.is_coach_of(auth.uid(), user_id));

-- Leaderboard RPC: computes scores from leads data for a given period
CREATE OR REPLACE FUNCTION public.get_leaderboard(
  _from timestamptz,
  _to timestamptz,
  _coach_id uuid DEFAULT NULL
)
RETURNS TABLE(
  user_id uuid,
  full_name text,
  avatar_url text,
  conversations bigint,
  responses bigint,
  calls_proposed bigint,
  meetings_booked bigint,
  score bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id AS user_id,
    COALESCE(p.full_name, p.email, p.id::text) AS full_name,
    p.avatar_url,
    COUNT(*) FILTER (WHERE l.conversation_started_at BETWEEN _from AND _to OR (l.created_at BETWEEN _from AND _to)) AS conversations,
    COUNT(*) FILTER (WHERE l.first_response_at BETWEEN _from AND _to) AS responses,
    COUNT(*) FILTER (WHERE l.call_proposed_at BETWEEN _from AND _to) AS calls_proposed,
    COUNT(*) FILTER (WHERE l.meeting_booked_at BETWEEN _from AND _to) AS meetings_booked,
    (
      COUNT(*) FILTER (WHERE l.conversation_started_at BETWEEN _from AND _to OR (l.created_at BETWEEN _from AND _to)) * 1
      + COUNT(*) FILTER (WHERE l.first_response_at BETWEEN _from AND _to) * 3
      + COUNT(*) FILTER (WHERE l.call_proposed_at BETWEEN _from AND _to) * 5
      + COUNT(*) FILTER (WHERE l.meeting_booked_at BETWEEN _from AND _to) * 10
    ) AS score
  FROM public.profiles p
  LEFT JOIN public.leads l ON l.owner_id = p.id
  WHERE p.role = 'user'
    AND (_coach_id IS NULL OR EXISTS (
      SELECT 1 FROM public.coach_assignments ca
      WHERE ca.coach_id = _coach_id AND ca.user_id = p.id
    ))
  GROUP BY p.id, p.full_name, p.email, p.avatar_url
  ORDER BY score DESC;
$$;

-- Function to get user activity streak
CREATE OR REPLACE FUNCTION public.get_user_streak(_user_id uuid)
RETURNS TABLE(current_streak int, longest_streak int)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _dates date[];
  _current int := 0;
  _longest int := 0;
  _prev date;
  _d date;
BEGIN
  SELECT ARRAY(
    SELECT DISTINCT (conversation_started_at AT TIME ZONE 'UTC')::date
    FROM public.leads
    WHERE owner_id = _user_id AND conversation_started_at IS NOT NULL
    ORDER BY 1 DESC
  ) INTO _dates;

  IF array_length(_dates, 1) IS NULL THEN
    current_streak := 0;
    longest_streak := 0;
    RETURN NEXT;
    RETURN;
  END IF;

  _prev := NULL;
  FOR i IN 1..array_length(_dates, 1) LOOP
    _d := _dates[i];
    IF _prev IS NULL THEN
      IF _d >= CURRENT_DATE - 1 THEN
        _current := 1;
      ELSE
        _current := 0;
      END IF;
      _longest := GREATEST(_longest, _current);
    ELSE
      IF _prev - _d = 1 THEN
        IF _current > 0 OR i = 2 THEN
          _current := _current + 1;
        END IF;
      ELSE
        IF _current > _longest THEN _longest := _current; END IF;
        _current := 0;
      END IF;
    END IF;
    _prev := _d;
  END LOOP;

  _longest := GREATEST(_longest, _current);
  current_streak := _current;
  longest_streak := _longest;
  RETURN NEXT;
END;
$$;
