
-- 1. Add category field to coaching_contents
ALTER TABLE public.coaching_contents
ADD COLUMN IF NOT EXISTS category text DEFAULT null;

-- 2. Create deals table for revenue tracking
CREATE TABLE public.deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  notes text
);

ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;

-- RLS for deals
CREATE POLICY "Users can view own deals" ON public.deals FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "Users can create own deals" ON public.deals FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Users can update own deals" ON public.deals FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Users can delete own deals" ON public.deals FOR DELETE USING (auth.uid() = owner_id);
CREATE POLICY "Admins can manage all deals" ON public.deals FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Coaches can view student deals" ON public.deals FOR SELECT USING (is_coach_of(auth.uid(), owner_id));

-- Add trigger for updated_at
CREATE TRIGGER update_deals_updated_at
  BEFORE UPDATE ON public.deals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Allow coaches to delete their own coaching contents
CREATE POLICY "Coaches can delete their contents" ON public.coaching_contents FOR DELETE USING (auth.uid() = created_by);
