-- Allow users to manage their own personas and assignments so they can create multiple targets
CREATE POLICY "Users can create own personas"
ON public.personas
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update own personas"
ON public.personas
FOR UPDATE
TO authenticated
USING (auth.uid() = created_by)
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can delete own personas"
ON public.personas
FOR DELETE
TO authenticated
USING (auth.uid() = created_by);

CREATE POLICY "Users can view own created personas"
ON public.personas
FOR SELECT
TO authenticated
USING (auth.uid() = created_by);

CREATE POLICY "Users can create own persona assignments"
ON public.user_personas
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND auth.uid() = assigned_by
);

CREATE POLICY "Users can update own persona assignments"
ON public.user_personas
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own persona assignments"
ON public.user_personas
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE UNIQUE INDEX IF NOT EXISTS user_personas_user_id_persona_id_unique_idx
ON public.user_personas (user_id, persona_id);