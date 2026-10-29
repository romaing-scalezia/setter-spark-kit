-- Nouveau type de tache pour les prospects issus d'une campagne scenario A
-- (visite + invitation, sans message automatise) qui acceptent la demande
-- de connexion : rien n'etant envoye automatiquement, l'utilisateur doit
-- demarrer lui-meme la conversation. Distinct de "conversation_followup"
-- (relancer une conversation deja entamee), qui ne s'applique pas ici
-- puisqu'aucun message n'a encore ete envoye.
ALTER TYPE public.task_type ADD VALUE IF NOT EXISTS 'start_conversation';
