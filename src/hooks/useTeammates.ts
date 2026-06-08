import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface Teammate {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
}

/**
 * Returns the current user's teammates (themselves + co-students of the same coach).
 * If the result has only 1 entry (themselves), the user is solo and setter UI should stay hidden.
 */
export function useTeammates() {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ['teammates', user?.id],
    queryFn: async (): Promise<Teammate[]> => {
      if (!user) return [];
      const { data: ids, error } = await supabase.rpc('get_team_members', { _user_id: user.id });
      if (error) throw error;
      const idList = (ids || []).map((row: any) => (typeof row === 'string' ? row : row?.get_team_members ?? row)).filter(Boolean);
      if (idList.length === 0) return [{ id: user.id, full_name: null, email: user.email ?? null, avatar_url: null }];

      const { data: profiles, error: pErr } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url')
        .in('id', idList);
      if (pErr) throw pErr;

      return (profiles || []) as Teammate[];
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  const teammates = query.data ?? [];
  const isTeam = teammates.length > 1;

  return { teammates, isTeam, isLoading: query.isLoading };
}

export function teammateLabel(t: Teammate | undefined | null): string {
  if (!t) return 'Inconnu';
  return t.full_name || t.email || t.id.slice(0, 8);
}
