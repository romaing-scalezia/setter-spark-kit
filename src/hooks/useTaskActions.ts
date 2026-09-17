import { useMutation, useQueryClient } from '@tanstack/react-query';
import { addDays, format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import type { EnrichedTask } from '@/components/TaskCard';

/**
 * Task mutations shared by every page that lists tasks (Follow-ups, Dashboard).
 * Keeps a single source of truth for "traite" so completing/reportant une
 * action a un endroit se reflete partout (meme lignes de la table tasks).
 */
export function useTaskActions() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();

  const invalidateTasks = () => {
    qc.invalidateQueries({ queryKey: ['tasks'] });
    qc.invalidateQueries({ queryKey: ['dashboard-tasks'] });
  };

  const completeMutation = useMutation({
    mutationFn: async ({ task, completedAt }: { task: EnrichedTask; completedAt: Date }) => {
      const { error } = await supabase
        .from('tasks')
        .update({ status: 'completed', completed_at: completedAt.toISOString() })
        .eq('id', task.id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateTasks();
      toast({ title: 'Tâche marquée comme faite' });
    },
    onError: (e: Error) =>
      toast({ variant: 'destructive', title: 'Erreur', description: e.message }),
  });

  const snoozeMutation = useMutation({
    mutationFn: async ({ task, until }: { task: EnrichedTask; until: Date }) => {
      const { error } = await supabase
        .from('tasks')
        .update({ snoozed_until: format(until, 'yyyy-MM-dd'), due_date: format(until, 'yyyy-MM-dd') })
        .eq('id', task.id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateTasks();
      toast({ title: 'Tâche reportée' });
    },
    onError: (e: Error) =>
      toast({ variant: 'destructive', title: 'Erreur', description: e.message }),
  });

  const rdvWonMutation = useMutation({
    mutationFn: async ({ task, amount }: { task: EnrichedTask; amount: number }) => {
      if (!task.lead) throw new Error('Lead introuvable');
      const { error: dealError } = await supabase.from('deals').insert({
        lead_id: task.lead.id,
        owner_id: task.lead.owner_id,
        amount,
        status: 'won',
      });
      if (dealError) throw dealError;
      const { error: leadError } = await supabase
        .from('leads')
        .update({ status: 'ferme_gagne', last_status_change_at: new Date().toISOString() })
        .eq('id', task.lead.id);
      if (leadError) throw leadError;
      await supabase.from('lead_events').insert({
        lead_id: task.lead.id, user_id: user!.id, event_type: 'status_changed',
        old_value: task.lead.status, new_value: 'ferme_gagne',
        metadata: { amount },
      });
    },
    onSuccess: () => {
      invalidateTasks();
      qc.invalidateQueries({ queryKey: ['leads'] });
      qc.invalidateQueries({ queryKey: ['dashboard-leads'] });
      toast({ title: 'Deal gagné 🎉' });
    },
    onError: (e: Error) =>
      toast({ variant: 'destructive', title: 'Erreur', description: e.message }),
  });

  const rdvLostMutation = useMutation({
    mutationFn: async ({ task, reason, detail }: { task: EnrichedTask; reason: string; detail?: string }) => {
      if (!task.lead) throw new Error('Lead introuvable');
      const { error } = await supabase
        .from('leads')
        .update({
          status: 'ferme_perdu',
          last_status_change_at: new Date().toISOString(),
          closed_lost_at: new Date().toISOString(),
          loss_reason: reason,
          reason_detail: detail || null,
          meeting_booked_at: null,
          date_rdv: null,
        })
        .eq('id', task.lead.id);
      if (error) throw error;
      await supabase.from('lead_events').insert({
        lead_id: task.lead.id, user_id: user!.id, event_type: 'status_changed',
        old_value: task.lead.status, new_value: 'ferme_perdu',
        metadata: { loss_reason: reason, reason_detail: detail ?? null },
      });
    },
    onSuccess: () => {
      invalidateTasks();
      qc.invalidateQueries({ queryKey: ['leads'] });
      qc.invalidateQueries({ queryKey: ['dashboard-leads'] });
      qc.invalidateQueries({ queryKey: ['lead-events'] });
      toast({ title: 'Lead marqué comme perdu' });
    },
    onError: (e: Error) =>
      toast({ variant: 'destructive', title: 'Erreur', description: e.message }),
  });

  const rdvPostponeMutation = useMutation({
    mutationFn: async (task: EnrichedTask) => {
      const until = format(addDays(new Date(), 7), 'yyyy-MM-dd');
      const { error } = await supabase.from('tasks').update({ due_date: until }).eq('id', task.id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateTasks();
      toast({ title: 'Reporté à J+7' });
    },
    onError: (e: Error) =>
      toast({ variant: 'destructive', title: 'Erreur', description: e.message }),
  });

  return { completeMutation, snoozeMutation, rdvWonMutation, rdvLostMutation, rdvPostponeMutation };
}
