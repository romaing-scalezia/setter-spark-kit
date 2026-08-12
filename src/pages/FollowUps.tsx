import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/AppLayout';
import { TaskCard, type EnrichedTask } from '@/components/TaskCard';
import { LeadDetailDrawer } from '@/components/LeadDetailDrawer';
import { CloseWonModal } from '@/components/CloseWonModal';
import { ReasonModal } from '@/components/ReasonModal';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { ListTodo, Loader2 } from 'lucide-react';
import {
  computeEffectivePriority,
  sortByPriority,
  TASK_TYPE_LABELS,
  type Task,
  type TaskType,
  type TaskPriority,
} from '@/lib/tasks';
import type { Lead } from '@/lib/constants';
import {
  isToday,
  isPast,
  isThisWeek,
  startOfDay,
  format,
  isWithinInterval,
  endOfWeek,
  addDays,
} from 'date-fns';
import { cn } from '@/lib/utils';
import { fr } from 'date-fns/locale';

type Bucket = 'all' | 'overdue' | 'today' | 'week';

export default function FollowUps() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();

  const [bucket, setBucket] = useState<Bucket>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | TaskPriority>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | TaskType>('all');
  const [openLead, setOpenLead] = useState<Lead | null>(null);
  const [snoozeTask, setSnoozeTask] = useState<EnrichedTask | null>(null);
  const [snoozeDate, setSnoozeDate] = useState<Date | undefined>(undefined);
  const [rdvWonTask, setRdvWonTask] = useState<EnrichedTask | null>(null);
  const [rdvLostTask, setRdvLostTask] = useState<EnrichedTask | null>(null);

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user!.id)
        .eq('status', 'pending')
        .order('due_date', { ascending: true });
      if (error) throw error;
      return (data || []) as Task[];
    },
    enabled: !!user,
  });

  const leadIds = useMemo(() => Array.from(new Set(tasks.map((t) => t.lead_id))), [tasks]);

  const { data: leads = [] } = useQuery({
    queryKey: ['tasks-leads', leadIds],
    queryFn: async () => {
      if (!leadIds.length) return [] as Lead[];
      const { data, error } = await supabase.from('leads').select('*').in('id', leadIds);
      if (error) throw error;
      return (data || []) as Lead[];
    },
    enabled: leadIds.length > 0,
  });

  const leadMap = useMemo(() => {
    const m = new Map<string, Lead>();
    leads.forEach((l) => m.set(l.id, l));
    return m;
  }, [leads]);

  const enriched: EnrichedTask[] = useMemo(() => {
    return tasks.map((t) => {
      const lead = leadMap.get(t.lead_id) || null;
      // hide snoozed-into-the-future tasks
      const effectivePriority = computeEffectivePriority(t, (lead as any)?.follow_up_level);
      return { ...t, lead, effectivePriority };
    });
  }, [tasks, leadMap]);

  const visible = useMemo(() => {
    const now = startOfDay(new Date());
    return enriched.filter((t) => {
      // snooze: hide until snoozed_until passes
      if (t.snoozed_until && new Date(t.snoozed_until) > now) return false;
      const due = new Date(t.due_date);

      if (bucket === 'overdue' && !(isPast(due) && !isToday(due))) return false;
      if (bucket === 'today' && !isToday(due)) return false;
      if (bucket === 'week') {
        if (!isWithinInterval(due, { start: now, end: endOfWeek(now, { weekStartsOn: 1 }) })) return false;
      }
      if (priorityFilter !== 'all' && t.effectivePriority !== priorityFilter) return false;
      if (typeFilter !== 'all' && t.task_type !== typeFilter) return false;
      return true;
    });
  }, [enriched, bucket, priorityFilter, typeFilter]);

  const sorted = useMemo(() => sortByPriority(visible), [visible]);

  // Counters (independent of filters except snooze)
  const visibleAll = useMemo(() => {
    const now = startOfDay(new Date());
    return enriched.filter((t) => !t.snoozed_until || new Date(t.snoozed_until) <= now);
  }, [enriched]);
  const counts = useMemo(() => {
    const now = startOfDay(new Date());
    return {
      all: visibleAll.length,
      overdue: visibleAll.filter((t) => {
        const d = new Date(t.due_date);
        return isPast(d) && !isToday(d);
      }).length,
      today: visibleAll.filter((t) => isToday(new Date(t.due_date))).length,
      week: visibleAll.filter((t) =>
        isWithinInterval(new Date(t.due_date), { start: now, end: endOfWeek(now, { weekStartsOn: 1 }) })
      ).length,
    };
  }, [visibleAll]);

  const completeMutation = useMutation({
    mutationFn: async (task: EnrichedTask) => {
      const { error } = await supabase
        .from('tasks')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', task.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['dashboard-tasks'] });
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
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['dashboard-tasks'] });
      setSnoozeTask(null);
      setSnoozeDate(undefined);
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
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['dashboard-tasks'] });
      qc.invalidateQueries({ queryKey: ['leads'] });
      qc.invalidateQueries({ queryKey: ['dashboard-leads'] });
      setRdvWonTask(null);
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
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['dashboard-tasks'] });
      qc.invalidateQueries({ queryKey: ['leads'] });
      qc.invalidateQueries({ queryKey: ['dashboard-leads'] });
      qc.invalidateQueries({ queryKey: ['lead-events'] });
      setRdvLostTask(null);
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
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['dashboard-tasks'] });
      toast({ title: 'Reporté à J+7' });
    },
    onError: (e: Error) =>
      toast({ variant: 'destructive', title: 'Erreur', description: e.message }),
  });

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 space-y-4" data-testid="page-follow-ups">
        <div className="flex items-center gap-3">
          <div className="rounded-md bg-primary/10 p-2">
            <ListTodo className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Actions du jour</h1>
            <p className="text-sm text-muted-foreground">
              Tes prochaines actions, triées par priorité.
            </p>
          </div>
        </div>

        {/* Bucket tabs */}
        <Tabs value={bucket} onValueChange={(v) => setBucket(v as Bucket)}>
          <TabsList>
            <TabsTrigger value="all">Toutes ({counts.all})</TabsTrigger>
            <TabsTrigger value="overdue" className="text-destructive">
              En retard ({counts.overdue})
            </TabsTrigger>
            <TabsTrigger value="today">Aujourd'hui ({counts.today})</TabsTrigger>
            <TabsTrigger value="week">Cette semaine ({counts.week})</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <Select value={priorityFilter} onValueChange={(v) => setPriorityFilter(v as any)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Priorité" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes priorités</SelectItem>
              <SelectItem value="urgent">🚨 Urgent</SelectItem>
              <SelectItem value="high">🔥 High</SelectItem>
              <SelectItem value="medium">🟡 Medium</SelectItem>
              <SelectItem value="low">⚪ Low</SelectItem>
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as any)}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Type de tâche" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les types</SelectItem>
              {(Object.keys(TASK_TYPE_LABELS) as TaskType[]).map((t) => (
                <SelectItem key={t} value={t}>
                  {TASK_TYPE_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="text-base">
              {sorted.length} tâche{sorted.length !== 1 ? 's' : ''}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : sorted.length === 0 ? (
              <p className="text-muted-foreground text-center py-6" data-testid="followups-empty-state">
                🎉 Aucune action en attente. Tu es à jour !
              </p>
            ) : (
              <div className="space-y-2">
                {sorted.map((t) => (
                  <TaskCard
                    key={t.id}
                    task={t}
                    onComplete={(task) => completeMutation.mutate(task)}
                    onSnooze={(task) => {
                      setSnoozeTask(task);
                      setSnoozeDate(undefined);
                    }}
                    onOpenLead={(task) => task.lead && setOpenLead(task.lead)}
                    onRdvWon={(task) => setRdvWonTask(task)}
                    onRdvLost={(task) => setRdvLostTask(task)}
                    onRdvPostpone={(task) => rdvPostponeMutation.mutate(task)}
                    isUpdating={completeMutation.isPending && completeMutation.variables?.id === t.id}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Lead drawer */}
      <LeadDetailDrawer
        lead={openLead}
        open={!!openLead}
        onOpenChange={(o) => !o && setOpenLead(null)}
      />

      {/* Snooze dialog */}
      <Dialog open={!!snoozeTask} onOpenChange={(o) => !o && setSnoozeTask(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Reporter à...</DialogTitle>
          </DialogHeader>
          <div className="flex justify-center">
            <Calendar
              mode="single"
              selected={snoozeDate}
              onSelect={setSnoozeDate}
              disabled={(d) => d <= startOfDay(new Date())}
              className={cn('p-3 pointer-events-auto')}
              locale={fr}
            />
          </div>
          <Button
            disabled={!snoozeDate || snoozeMutation.isPending}
            onClick={() => snoozeTask && snoozeDate && snoozeMutation.mutate({ task: snoozeTask, until: snoozeDate })}
            className="w-full"
          >
            {snoozeMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Reporter
          </Button>
        </DialogContent>
      </Dialog>

      {/* RDV outcome: won / lost */}
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
    </AppLayout>
  );
}
