-- New lead status: "Fermé Gagné" (closed won) — a lead that signed as a client.
-- Kept in its own migration: ALTER TYPE ... ADD VALUE cannot be referenced by
-- other statements in the same transaction as the one that adds it.
ALTER TYPE public.lead_status ADD VALUE 'ferme_gagne';
