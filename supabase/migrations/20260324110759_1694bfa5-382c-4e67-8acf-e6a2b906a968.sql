
-- Table for user-managed custom reasons
CREATE TABLE public.custom_reasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL CHECK (type IN ('loss', 'disqualification')),
  label text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.custom_reasons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own custom reasons" ON public.custom_reasons
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own custom reasons" ON public.custom_reasons
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own custom reasons" ON public.custom_reasons
  FOR DELETE USING (auth.uid() = user_id);

-- Add reason_detail text field on leads for free-text reasons
ALTER TABLE public.leads ADD COLUMN reason_detail text;
