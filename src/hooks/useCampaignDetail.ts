import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { CampaignStatus } from './useCampaigns';

export type ActionType = 'visit' | 'invite' | 'message';

export interface CampaignStep {
  id: string;
  step_order: number;
  action_type: ActionType;
  message_content: string | null;
  delay_days: number;
}

export interface CampaignLead {
  id: string;
  linkedin_url: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  status: string | null;
  invited_at: string | null;
  accepted_at: string | null;
  messaged_1_at: string | null;
  messaged_2_at: string | null;
  messaged_3_at: string | null;
  error_message: string | null;
}

export interface CampaignDetail {
  id: string;
  name: string;
  status: CampaignStatus;
  scenario_type: string;
  persona_id: string | null;
  persona_name: string | null;
  created_at: string;
  steps: CampaignStep[];
  leads: CampaignLead[];
  visits_done: number;
}

export function useCampaignDetail(id: string | undefined) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['campaign-detail', id],
    queryFn: async (): Promise<CampaignDetail> => {
      if (!id) throw new Error('No campaign id');

      const [campaignRes, stepsRes, leadsRes, jobsRes] = await Promise.all([
        (supabase as any)
          .from('campaigns')
          .select('id, name, status, scenario_type, persona_id, created_at')
          .eq('id', id)
          .single(),
        (supabase as any)
          .from('campaign_steps')
          .select('id, step_order, action_type, message_content, delay_days')
          .eq('campaign_id', id)
          .order('step_order', { ascending: true }),
        (supabase as any)
          .from('campaign_leads')
          .select('id, linkedin_url, first_name, last_name, company_name, status, invited_at, accepted_at, messaged_1_at, messaged_2_at, messaged_3_at, error_message')
          .eq('campaign_id', id),
        (supabase as any)
          .from('campaign_jobs')
          .select('id')
          .eq('campaign_id', id)
          .eq('action_type', 'visit')
          .eq('status', 'done'),
      ]);

      if (campaignRes.error) throw campaignRes.error;

      const campaign = campaignRes.data;
      let personaName: string | null = null;
      if (campaign.persona_id) {
        const { data: p } = await supabase
          .from('personas')
          .select('name')
          .eq('id', campaign.persona_id)
          .maybeSingle();
        if (p) personaName = (p as any).name;
      }

      return {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status as CampaignStatus,
        scenario_type: campaign.scenario_type,
        persona_id: campaign.persona_id ?? null,
        persona_name: personaName,
        created_at: campaign.created_at,
        steps: (stepsRes.data ?? []) as CampaignStep[],
        leads: (leadsRes.data ?? []) as CampaignLead[],
        visits_done: (jobsRes.data ?? []).length,
      };
    },
    enabled: !!id,
    staleTime: 30_000,
  });

  const toggleStatus = useMutation({
    mutationFn: async ({ currentStatus }: { currentStatus: CampaignStatus }) => {
      if (!id) throw new Error('No campaign id');
      const next: CampaignStatus = currentStatus === 'active' ? 'paused' : 'active';
      const { error } = await (supabase as any)
        .from('campaigns')
        .update({ status: next })
        .eq('id', id);
      if (error) throw error;
      return next;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['campaign-detail', id] }),
  });

  return { detail: query.data, isLoading: query.isLoading, toggleStatus };
}
