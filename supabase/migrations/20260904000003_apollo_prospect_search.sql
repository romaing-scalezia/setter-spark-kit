-- Recherche de prospects via Apollo (mode test, admin uniquement — pas de
-- contrat de partenariat Apollo pour l'instant, pas de rollout utilisateurs).
CREATE TABLE public.prospect_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.prospect_list_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id uuid NOT NULL REFERENCES public.prospect_lists(id) ON DELETE CASCADE,
  apollo_id text,
  linkedin_url text NOT NULL,
  first_name text,
  last_name text,
  company_name text,
  job_title text,
  email text,
  added_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_prospect_list_items_list_id ON public.prospect_list_items(list_id);

ALTER TABLE public.prospect_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospect_list_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own prospect lists" ON public.prospect_lists
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage items in own lists" ON public.prospect_list_items
  FOR ALL USING (EXISTS (
    SELECT 1 FROM public.prospect_lists l WHERE l.id = list_id AND l.user_id = auth.uid()
  )) WITH CHECK (EXISTS (
    SELECT 1 FROM public.prospect_lists l WHERE l.id = list_id AND l.user_id = auth.uid()
  ));

-- Suivi (approximatif) des credits Apollo consommes — feature mono-utilisateur
-- en mode test, pas besoin d'un systeme de quota complet type Sales Nav.
-- Apollo ne renvoie pas le cout exact par appel : on compte les appels
-- d'enrichissement (1-9 credits reels chacun) et on bloque par prudence des
-- qu'on approche du solde reel, a verifier ponctuellement dans le dashboard Apollo.
CREATE TABLE public.apollo_usage (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  enrichments_used integer NOT NULL DEFAULT 0,
  -- Conservateur : un appel coute 1 a 9 credits reels selon ce qui est trouve
  -- (email vs telephone). 40 appels meme au pire cas (9) resterait sous 84,
  -- mais verifie ponctuellement ton solde reel dans le dashboard Apollo.
  safety_cap integer NOT NULL DEFAULT 40,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.apollo_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own apollo usage" ON public.apollo_usage
  FOR SELECT USING (auth.uid() = user_id);
