import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface UnipileAccount {
  id: string;
  user_id: string;
  account_id: string;
  status: string; // 'connected' | 'disconnected'
  created_at: string;
  updated_at: string;
}

export function useUnipileAccount() {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ['unipile-account', user?.id],
    queryFn: async (): Promise<UnipileAccount | null> => {
      if (!user) return null;
      const { data, error } = await (supabase.from('unipile_accounts' as any) as any)
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) throw error;
      return (data as UnipileAccount | null) ?? null;
    },
    enabled: !!user,
    staleTime: 30_000,
  });

  return {
    account: query.data ?? null,
    loading: query.isLoading,
    refetch: query.refetch,
  };
}