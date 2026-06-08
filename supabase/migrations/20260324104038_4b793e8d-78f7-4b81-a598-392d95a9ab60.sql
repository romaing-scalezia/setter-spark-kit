
-- ENUMS MÉTIER
CREATE TYPE public.loss_reason_type AS ENUM (
  'pas_interesse', 'pas_le_bon_timing', 'pas_de_budget',
  'ne_repond_plus', 'deja_accompagne', 'objection_non_levee', 'autre'
);

CREATE TYPE public.disqualification_reason_type AS ENUM (
  'hors_icp', 'activite_non_pertinente', 'trop_debutant',
  'trop_avance', 'pas_decideur', 'mauvaise_cible', 'autre'
);

CREATE TYPE public.outreach_type_enum AS ENUM (
  'message_texte', 'video', 'vocal', 'autre'
);

CREATE TYPE public.source_type_enum AS ENUM (
  'manuel', 'campagne', 'inbound', 'referral', 'autre'
);

-- CONVERTIR LES COLONNES
ALTER TABLE public.leads
  ALTER COLUMN loss_reason TYPE loss_reason_type
    USING CASE WHEN loss_reason IS NOT NULL THEN loss_reason::loss_reason_type ELSE NULL END;

ALTER TABLE public.leads
  ALTER COLUMN disqualification_reason TYPE disqualification_reason_type
    USING CASE WHEN disqualification_reason IS NOT NULL THEN disqualification_reason::disqualification_reason_type ELSE NULL END;

ALTER TABLE public.leads
  ALTER COLUMN outreach_type TYPE outreach_type_enum
    USING CASE WHEN outreach_type IS NOT NULL THEN outreach_type::outreach_type_enum ELSE NULL END;

-- source_type: drop default, convert, re-add default
ALTER TABLE public.leads ALTER COLUMN source_type DROP DEFAULT;
ALTER TABLE public.leads
  ALTER COLUMN source_type TYPE source_type_enum
    USING CASE WHEN source_type IS NOT NULL THEN source_type::source_type_enum ELSE NULL END;
ALTER TABLE public.leads ALTER COLUMN source_type SET DEFAULT 'manuel'::source_type_enum;

-- CHECK CONSTRAINT
ALTER TABLE public.leads
  ADD CONSTRAINT chk_follow_up_date
    CHECK (status != 'follow_up' OR follow_up_date IS NOT NULL);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_leads_campaign_tag ON public.leads(campaign_tag);
CREATE INDEX IF NOT EXISTS idx_leads_loss_reason ON public.leads(loss_reason);
CREATE INDEX IF NOT EXISTS idx_leads_disqualification_reason ON public.leads(disqualification_reason);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON public.leads(created_at);
CREATE INDEX IF NOT EXISTS idx_lead_events_user_created ON public.lead_events(user_id, created_at);
