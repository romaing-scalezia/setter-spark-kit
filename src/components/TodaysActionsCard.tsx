import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TaskCard, type EnrichedTask } from '@/components/TaskCard';
import { LeadDetailDrawer } from '@/components/LeadDetailDrawer';
import { useToast } from '@/hooks/use-toast';
import { ListTodo, ArrowRight } from 'lucide-react';
import { computeEffectivePriority, sortByPriority, type Task } from '@/lib/tasks';
import type { Lead } from '@/lib/constants';
import { startOfDay, isPast, isToday, isThisWeek } from 'date-fns';
import { useState } from 'react';

const MAX_VISIBLE = 6;

export function TodaysActionsCard() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [openLead, setOpenLead] = useState<Lead | null>(null);

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
    </>
  );
}
