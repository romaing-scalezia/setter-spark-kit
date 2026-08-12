import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TaskCard, type EnrichedTask } from '@/components/TaskCard';
import { LeadDetailDrawer } from '@/components/LeadDetailDrawer';
import { CloseWonModal } from '@/components/CloseWonModal';
import { ReasonModal } from '@/components/ReasonModal';
import { useToast } from '@/hooks/use-toast';
import { ListTodo, ArrowRight } from 'lucide-react';
import { computeEffectivePriority, sortByPriority, type Task } from '@/lib/tasks';
import type { Lead } from '@/lib/constants';
import { startOfDay, isPast, isToday, isThisWeek, addDays, format } from 'date-fns';
import { useState } from 'react';

const MAX_VISIBLE = 6;

export function TodaysActionsCard() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [openLead, setOpenLead] = useState<Lead | null>(null);
  const [rdvWonTask, setRdvWonTask] = useState<EnrichedTask | null>(null);
  const [rdvLostTask, setRdvLostTask] = useState<EnrichedTask | null>(null);

  const { data: tasks = [] } = useQuery({
    queryKey: ['dashboard-tasks', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user!.id)
        .eq('status', 'pending');
      if (error) throw error;
      return (data || []) as Task[];
    },
    enabled: !!user,
  });

  const leadIds = useMemo(() => Array.from(new Set(tasks.map((t) => t.lead_id))), [tasks]);

  const { data: leads = [] } = useQuery({
    queryKey: ['dashboard-task-leads', leadIds],
    queryFn: async () => {
      if (!leadIds.length) return [] as Lead[];
      const { data } = await supabase.from('leads').select('*').in('id', leadIds);
      return (data || []) as Lead[];
    },
    enabled: leadIds.length > 0,
  });

  const enriched: EnrichedTask[] = useMemo(() => {
    const map = new Map(leads.map((l) => [l.id, l]));
    const now = startOfDay(new Date());
    return tasks
      .filter((t) => !t.snoozed_until || new Date(t.snoozed_until) <= now)
      .filter((t) => {
        const due = new Date(t.due_date);
        // Today's actions = overdue + today + this week
        return (isPast(due) && !isToday(due)) || isToday(due) || isThisWeek(due, { weekStartsOn: 1 });
      })
      .map((t) => {
        const lead = map.get(t.lead_id) || null;
        return { ...t, lead, effectivePriority: computeEffectivePriority(t, (lead as any)?.follow_up_level) };
      });
  }, [tasks, leads]);

  const sorted = useMemo(() => sortByPriority(enriched), [enriched]);
  const visible = sorted.slice(0, MAX_VISIBLE);
  const remaining = sorted.length - visible.length;

  const completeMutation = useMutation({
    mutationFn: async (task: EnrichedTask) => {
      const { error } = await supabase
        .from('tasks')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', task.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dashboard-tasks'] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
      toast({ title: 'Tâche marquée comme faite' });
    },
    onError: (e: Error) => toast({ variant: 'destructive', title: 'Erreur', description: e.message }),
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
      qc.invalidateQueries({ queryKey: ['dashboard-tasks'] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['dashboard-leads'] });
      qc.invalidateQueries({ queryKey: ['leads'] });
      setRdvWonTask(null);
      toast({ title: 'Deal gagné 🎉' });
    },
    onError: (e: Error) => toast({ variant: 'destructive', title: 'Erreur', description: e.message }),
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
      qc.invalidateQueries({ queryKey: ['dashboard-tasks'] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['dashboard-leads'] });
      qc.invalidateQueries({ queryKey: ['leads'] });
      qc.invalidateQueries({ queryKey: ['lead-events'] });
      setRdvLostTask(null);
      toast({ title: 'Lead marqué comme perdu' });
    },
    onError: (e: Error) => toast({ variant: 'destructive', title: 'Erreur', description: e.message }),
  });

  const rdvPostponeMutation = useMutation({
    mutationFn: async (task: EnrichedTask) => {
      const until = format(addDays(new Date(), 7), 'yyyy-MM-dd');
      const { error } = await supabase.from('tasks').update({ due_date: until }).eq('id', task.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dashboard-tasks'] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
      toast({ title: 'Reporté à J+7' });
    },
    onError: (e: Error) => toast({ variant: 'destructive', title: 'Erreur', description: e.message }),
  });

  if (sorted.length === 0) return null;

  return (
    <>
      <Card data-testid="dashboard-todays-actions">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ListTodo className="h-4 w-4 text-primary" />
            Actions du jour
            <span className="text-xs text-muted-foreground font-normal">
              ({sorted.length})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {visible.map((t) => (
            <TaskCard
              key={t.id}
              task={t}
              onComplete={(task) => completeMutation.mutate(task)}
              onOpenLead={(task) => task.lead && setOpenLead(task.lead)}
              onRdvWon={(task) => setRdvWonTask(task)}
              onRdvLost={(task) => setRdvLostTask(task)}
              onRdvPostpone={(task) => rdvPostponeMutation.mutate(task)}
              isUpdating={completeMutation.isPending && completeMutation.variables?.id === t.id}
              compact
            />
          ))}
          {remaining > 0 && (
            <Link
              to="/follow-ups"
              className="flex items-center justify-center gap-1 text-sm text-primary hover:underline py-1"
            >
              Voir les {remaining} autres tâches <ArrowRight className="h-3 w-3" />
            </Link>
          )}
        </CardContent>
      </Card>

      <LeadDetailDrawer
        lead={openLead}
        open={!!openLead}
        onOpenChange={(o) => !o && setOpenLead(null)}
      />

      <CloseWonModal
        open={!!rdvWonTask}
        onOpenChange={(o) => !o && setRdvWonTask(null)}
        lead={rdvWonTask?.lead ?? null}
        onSubmit={(amount) => rdvWonTask && rdvWonMutation.mutate({ task: rdvWonTask, amount })}
        isPending={rdvWonMutation.isPending}
      />
      <ReasonModal
        open={!!rdvLostTask}
        onOpenChange={(o) => !o && setRdvLostTask(null)}
        type="loss"
        onSubmit={(reason, detail) => rdvLostTask && rdvLostMutation.mutate({ task: rdvLostTask, reason, detail })}
      />
    </>
  );
}
