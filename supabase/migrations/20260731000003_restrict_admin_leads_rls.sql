-- RGPD : supprime la policy qui donnait aux admins accès aux leads de tous les users
DROP POLICY IF EXISTS "Admins can view all leads" ON public.leads;
DROP POLICY IF EXISTS "Admins can update all leads" ON public.leads;
DROP POLICY IF EXISTS "Admins can delete all leads" ON public.leads;
