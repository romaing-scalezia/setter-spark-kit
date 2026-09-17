-- handle_manual_followup_task() n'agissait que si leads.status = 'follow_up',
-- alors que LeadDetailDrawer.tsx modifie follow_up_date sans jamais changer
-- le statut ("Status is intentionally NOT updated — preserves funnel
-- analytics"). Consequence : reporter la date de relance sur un lead dont
-- le statut n'est pas exactement 'follow_up' (ex: rendez_vous_booke,
-- en_cours...) ne creait/mettait a jour aucune tache — la relance
-- disparaissait silencieusement de /follow-ups (Toutes/Aujourd'hui/Semaine).
--
-- Fix : la tache se cree/rafraichit des que follow_up_date est renseignee,
-- quel que soit le statut du lead — sauf sur un lead definitivement ferme
-- (ferme_perdu/non_qualifie/ferme_gagne), auquel cas on annule aussi toute
-- tache manual_followup deja en attente (elle n'a plus lieu d'etre).
CREATE OR REPLACE FUNCTION public.handle_manual_followup_task()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _prio public.task_priority;
BEGIN
  IF NEW.status IN ('ferme_perdu', 'non_qualifie', 'ferme_gagne') THEN
    UPDATE public.tasks
    SET status = 'cancelled', updated_at = now()
    WHERE lead_id = NEW.id AND status = 'pending' AND task_type = 'manual_followup';
    RETURN NEW;
  END IF;

  IF NEW.follow_up_date IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW.follow_up_date IS NOT DISTINCT FROM OLD.follow_up_date
     AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  _prio := CASE
    WHEN COALESCE(NEW.follow_up_level, 0) >= 3 THEN 'urgent'::public.task_priority
    WHEN COALESCE(NEW.follow_up_level, 0) = 2 THEN 'high'::public.task_priority
    ELSE 'medium'::public.task_priority
  END;

  UPDATE public.tasks
  SET status = 'cancelled', updated_at = now()
  WHERE lead_id = NEW.id AND status = 'pending' AND task_type = 'manual_followup';

  INSERT INTO public.tasks (lead_id, user_id, task_type, priority, due_date, source)
  VALUES (NEW.id, NEW.owner_id, 'manual_followup', _prio, NEW.follow_up_date, 'manual');

  RETURN NEW;
END;
$$;

-- Rattrapage retroactif : cree la tache manquante pour les leads deja
-- affectes (follow_up_date renseignee, statut actif, aucune tache en attente).
INSERT INTO public.tasks (lead_id, user_id, task_type, priority, due_date, source)
SELECT
  l.id, l.owner_id, 'manual_followup',
  CASE
    WHEN COALESCE(l.follow_up_level, 0) >= 3 THEN 'urgent'::public.task_priority
    WHEN COALESCE(l.follow_up_level, 0) = 2 THEN 'high'::public.task_priority
    ELSE 'medium'::public.task_priority
  END,
  l.follow_up_date, 'manual'
FROM public.leads l
WHERE l.follow_up_date IS NOT NULL
  AND l.status NOT IN ('ferme_perdu', 'non_qualifie', 'ferme_gagne')
  AND NOT EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.lead_id = l.id AND t.status = 'pending' AND t.task_type = 'manual_followup'
  );
