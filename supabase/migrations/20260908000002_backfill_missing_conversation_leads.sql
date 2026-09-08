-- campaign-runner ecrivait outreach_type = 'message texte' (avec un espace)
-- au lieu de la vraie valeur d'enum 'message_texte' (underscore) lors de la
-- creation automatique de fiche CRM au premier message envoye. L'insertion
-- echouait donc silencieusement a chaque fois (aucune verification d'erreur
-- sur cet appel) — cette fonctionnalite n'a jamais cree la moindre fiche.
-- Corrige dans le code (campaign-runner + nouvelle fonctionnalite d'envoi
-- manuel de message). Rattrapage retroactif ci-dessous, idempotent (NOT
-- EXISTS), verifie au prealable qu'aucune des fiches manquantes n'existait
-- deja sous une autre forme (URL ou nom) avant de les creer.
WITH missing AS (
  SELECT DISTINCT ON (cl.linkedin_url)
    cl.user_id, cl.linkedin_url, cl.first_name, cl.last_name, cl.company_name, cl.messaged_1_at
  FROM public.campaign_leads cl
  WHERE cl.messaged_1_at IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.leads l WHERE l.owner_id = cl.user_id AND l.linkedin_url = cl.linkedin_url
    )
  ORDER BY cl.linkedin_url, cl.messaged_1_at
),
inserted AS (
  INSERT INTO public.leads (owner_id, first_name, last_name, company_name, linkedin_url, status, outreach_type, conversation_started_at)
  SELECT user_id, first_name, last_name, company_name, linkedin_url, 'conversation_engagee', 'message_texte', messaged_1_at
  FROM missing
  RETURNING id, owner_id
)
INSERT INTO public.lead_events (lead_id, user_id, event_type, new_value)
SELECT id, owner_id, 'status_changed', 'conversation_engagee' FROM inserted;
