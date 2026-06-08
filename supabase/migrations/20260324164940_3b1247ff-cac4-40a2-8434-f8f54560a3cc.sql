
-- 1. Create script_categories table for dynamic categories
CREATE TABLE public.script_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL,
  owner_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.script_categories ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can view categories
CREATE POLICY "Authenticated users can view categories"
  ON public.script_categories FOR SELECT TO authenticated
  USING (true);

-- Owner can manage own categories
CREATE POLICY "Users can manage own categories"
  ON public.script_categories FOR ALL TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- Admins can manage all
CREATE POLICY "Admins can manage all categories"
  ON public.script_categories FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 2. Add persona_id to leads table
ALTER TABLE public.leads ADD COLUMN persona_id uuid REFERENCES public.personas(id) ON DELETE SET NULL;
