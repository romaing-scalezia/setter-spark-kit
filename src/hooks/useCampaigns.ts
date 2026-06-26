import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type CampaignStatus = 'draft' | 'active' | 'paused' | 'completed';
export type ScenarioType = 'A' | 'B' | 'C';

export interface Campaign {
  id: string;
  name: string;
  status: CampaignStatus;
  scenario_type: ScenarioType;
  persona_id: string | null;
  persona_name: string | null;
  created_at: string;
  total_leads: number;
  done_leads: number;
}

export function useCampaigns() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['campaigns', user?.id],
    queryFn: async (): Promise<Campaign[]> => {
      if (!user) return [];

      const { data: rows, error } = await (supabase as any)
        .from('campaigns')
        .select('id, name, status, scenario_type, persona_id, created_at, campaign_leads(id, status)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const personaIds: string[] = [
        ...new Set((rows || []).map((r: any) => r.persona_id).filter(Boolean)),
      ];
      const personaMap = new Map<string, string>();
      if (personaIds.length > 0) {
        const { data: personas } = await supabase
          .from('personas')
          .select('id, name')
          .in('id', personaIds);
        (personas || []).forEach((p: any) => personaMap.set(p.id, p.name));
      }

      return (rows || []).map((r: any) => {
        const leads: any[] = r.campaign_leads ?? [];
        return {
          id: r.id,
          name: r.name,
          status: r.status as CampaignStatus,
          scenario_type: r.scenario_type as ScenarioType,
          persona_id: r.persona_id ?? null,
          persona_name: r.persona_id ? (personaMap.get(r.persona_id) ?? null) : null,
          created_at: r.created_at,
          total_leads: leads.length,
          done_leads: leads.filter((l) => l.status === 'completed').length,
        };
      });
    },
    enabled: !!user,
    staleTime: 30_000,
  });

  const toggleStatus = useMutation({
    mutationFn: async ({ id, currentStatus }: { id: string; currentStatus: CampaignStatus }) => {
      const next: CampaignStatus = currentStatus === 'active' ? 'paused' : 'active';
      const { error } = await (supabase as any)
        .from('campaigns')
        .update({ status: next })
        .eq('id', id);
      if (error) throw error;
      return next;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['campaigns', user?.id] }),
  });

  const deleteCampaign = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('campaigns')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['campaigns', user?.id] }),
  });

  return {
    campaigns: query.data ?? [],
    isLoading: query.isLoading,
    toggleStatus,
    deleteCampaign,
  };
}
