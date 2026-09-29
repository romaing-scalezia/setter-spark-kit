import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUnipileAccount } from '@/hooks/useUnipileAccount';
import { useToast } from '@/hooks/use-toast';

const TOAST_CLASSNAME =
  'bg-primary border-primary text-white [&>div>*:first-child]:text-base [&>div>*:first-child]:font-bold [&>div>*:first-child]:text-white';

/**
 * Redirige vers les reglages LinkedIn tant que le compte n'est pas
 * status="connected" — un compte juste present (ex: bloque en "connecting"
 * sur un checkpoint jamais valide) ne suffit pas, il n'est pas fonctionnel
 * cote Unipile.
 */
export function useRequireLinkedInAccount(description: string) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { account, loading } = useUnipileAccount();

  useEffect(() => {
    if (loading) return;
    if (!account || account.status !== 'connected') {
      toast({
        title: 'LinkedIn non connecté',
        description,
        className: TOAST_CLASSNAME,
      });
      navigate('/settings?tab=linkedin', { replace: true });
    }
  }, [account, loading, navigate, toast, description]);

  return { account, loading };
}
