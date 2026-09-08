import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { parseFunctionErrorBody } from '@/lib/functionsError';
import { useAuth } from '@/contexts/AuthContext';
import type { CampaignStatus } from './useCampaigns';

// unipile-proxy renvoie { error: "Unipile error", details: <reponse brute Unipile> }
// sur un echec — Unipile decrit l'erreur dans details.detail/details.title, pas
// dans un champ "message" (cf. LinkedInConnectDialog.tsx pour le meme pattern).
async function unipileErrorMessage(error: unknown, fallback: string): Promise<string> {
  const body = await parseFunctionErrorBody(error) as { error?: string; details?: { detail?: string; title?: string } } | null;
  return body?.details?.detail ?? body?.details?.title ?? body?.error ?? fallback;
}

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
  provider_id: string | null;
  status: string | null;
  invited_at: string | null;
  accepted_at: string | null;
  messaged_1_at: string | null;
  messaged_2_at: string | null;
  messaged_3_at: string | null;
  replied_at: string | null;
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
  const { user } = useAuth();

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
          .select('id, linkedin_url, first_name, last_name, company_name, provider_id, status, invited_at, accepted_at, messaged_1_at, messaged_2_at, messaged_3_at, replied_at, error_message')
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

  const deleteLeads = useMutation({
    mutationFn: async (leadIds: string[]) => {
      if (!leadIds.length) return;
      // campaign_jobs.campaign_lead_id est ON DELETE CASCADE — supprime aussi
      // les jobs en attente pour ces prospects, pas de nettoyage manuel requis.
      const { error } = await (supabase as any)
        .from('campaign_leads')
        .delete()
        .in('id', leadIds);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['campaign-detail', id] }),
  });

  const sendManualMessage = useMutation({
    mutationFn: async ({ lead, accountId, text }: { lead: CampaignLead; accountId: string; text: string }) => {
      if (!user) throw new Error('Non authentifié');
      if (!lead.provider_id) throw new Error('provider_id manquant pour ce lead');

      const { data, error } = await supabase.functions.invoke('unipile-proxy', {
        body: { action: 'start_conversation', account_id: accountId, attendee_provider_id: lead.provider_id, text },
      });
      if (error) throw new Error(await unipileErrorMessage(error, error.message));

      const chatId: string | null = (data as any)?.id ?? (data as any)?.chat_id ?? null;
      const now = new Date().toISOString();

      const { error: updateError } = await (supabase as any)
        .from('campaign_leads')
        .update({ messaged_1_at: now })
        .eq('id', lead.id);
      if (updateError) throw updateError;

      // Cree/met a jour le lead CRM correspondant, meme logique que
      // campaign-runner pour le premier message automatise (message_1).
      const { data: existingLead } = await (supabase as any)
        .from('leads')
        .select('id, unipile_chat_id')
        .eq('owner_id', user.id)
        .eq('linkedin_url', lead.linkedin_url)
        .maybeSingle();

      let leadId: string | undefined = existingLead?.id;
      if (!leadId) {
        const { data: newLead, error: leadInsertError } = await (supabase as any).from('leads').insert({
          owner_id:                user.id,
          first_name:              lead.first_name,
          last_name:               lead.last_name,
          company_name:            lead.company_name,
          linkedin_url:            lead.linkedin_url,
          status:                  'conversation_engagee',
          outreach_type:           'message_texte',
          conversation_started_at: now,
          ...(chatId ? { unipile_chat_id: chatId } : {}),
        }).select('id').single();
        if (leadInsertError) throw leadInsertError;
        leadId = newLead?.id;
      } else if (chatId && !existingLead?.unipile_chat_id) {
        const { error: chatIdError } = await (supabase as any).from('leads').update({ unipile_chat_id: chatId }).eq('id', leadId);
        if (chatIdError) throw chatIdError;
      }

      if (leadId) {
        const { error: eventError } = await (supabase as any).from('lead_events').insert({
          lead_id:    leadId,
          user_id:    user.id,
          event_type: 'status_changed',
          new_value:  'conversation_engagee',
        });
        if (eventError) throw eventError;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['campaign-detail', id] }),
  });

  return { detail: query.data, isLoading: query.isLoading, toggleStatus, deleteLeads, sendManualMessage };
}
