-- Fix the broken RLS policy on personas table for users
DROP POLICY IF EXISTS "Users can view assigned personas" ON public.personas;
CREATE POLICY "Users can view assigned personas"
ON public.personas
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_personas up
    WHERE up.persona_id = personas.id AND up.user_id = auth.uid()
  )
);