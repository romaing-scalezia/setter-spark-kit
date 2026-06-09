CREATE TABLE public.unipile_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  account_id text NOT NULL,
  status text NOT NULL DEFAULT 'connected',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.unipile_accounts TO authenticated;
GRANT ALL ON public.unipile_accounts TO service_role;

ALTER TABLE public.unipile_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own unipile account"
  ON public.unipile_accounts
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS unipile_chat_id text;

CREATE INDEX IF NOT EXISTS idx_leads_unipile_chat_id
  ON public.leads (unipile_chat_id)
  WHERE unipile_chat_id IS NOT NULL;