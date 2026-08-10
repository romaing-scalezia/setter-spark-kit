-- Permet aux coaches de gérer leurs propres assignments (s'assigner des élèves eux-mêmes)
CREATE POLICY "Coaches can manage own assignments" ON public.coach_assignments
  FOR ALL USING (
    auth.uid() = coach_id
    AND public.has_role(auth.uid(), 'coach')
  )
  WITH CHECK (
    auth.uid() = coach_id
    AND public.has_role(auth.uid(), 'coach')
  );

-- RPC : retourne les users (role=user) sans coach assigné, accessible aux coaches
CREATE OR REPLACE FUNCTION public.get_unassigned_users()
RETURNS TABLE(id uuid, full_name text, email text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.full_name, p.email
  FROM profiles p
  JOIN user_roles ur ON ur.user_id = p.id AND ur.role = 'user'
  WHERE NOT EXISTS (
    SELECT 1 FROM coach_assignments ca WHERE ca.user_id = p.id
  )
  ORDER BY p.full_name;
$$;

GRANT EXECUTE ON FUNCTION public.get_unassigned_users() TO authenticated;
