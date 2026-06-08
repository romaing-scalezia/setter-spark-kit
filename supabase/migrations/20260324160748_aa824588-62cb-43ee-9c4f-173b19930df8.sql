
-- 1. Create personas table
CREATE TABLE public.personas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  target_type text,
  sector text,
  company_size text,
  target_role text,
  maturity_level text,
  main_problems text,
  objectives text,
  frequent_objections text,
  recommended_approach text,
  coach_notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Create user_personas junction table
CREATE TABLE public.user_personas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  persona_id uuid NOT NULL REFERENCES public.personas(id) ON DELETE CASCADE,
  is_primary boolean NOT NULL DEFAULT false,
  assigned_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, persona_id)
);

-- 3. Enable RLS
ALTER TABLE public.personas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_personas ENABLE ROW LEVEL SECURITY;

-- 4. Personas policies
CREATE POLICY "Admins can manage all personas" ON public.personas FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Coaches can manage own personas" ON public.personas FOR ALL TO authenticated
  USING (auth.uid() = created_by) WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can view assigned personas" ON public.personas FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_personas up WHERE up.persona_id = id AND up.user_id = auth.uid()
  ));

-- 5. User_personas policies
CREATE POLICY "Admins can manage all user_personas" ON public.user_personas FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Coaches can manage student personas" ON public.user_personas FOR ALL TO authenticated
  USING (public.is_coach_of(auth.uid(), user_id)) WITH CHECK (public.is_coach_of(auth.uid(), user_id));

CREATE POLICY "Users can view own persona assignments" ON public.user_personas FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- 6. Add persona_id to coaching_contents
ALTER TABLE public.coaching_contents ADD COLUMN persona_id uuid REFERENCES public.personas(id) ON DELETE SET NULL;
