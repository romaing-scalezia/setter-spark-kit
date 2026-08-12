-- New task type: "Résultat du RDV" — kept in its own migration since
-- ALTER TYPE ... ADD VALUE cannot be referenced by other statements in the
-- same transaction as the one that adds it.
ALTER TYPE public.task_type ADD VALUE 'rdv_result';
