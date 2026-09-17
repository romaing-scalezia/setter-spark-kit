import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/AppLayout';
import { TaskCard, type EnrichedTask } from '@/components/TaskCard';
import { LeadDetailDrawer } from '@/components/LeadDetailDrawer';
import { TaskActionDialogs } from '@/components/TaskActionDialogs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ListTodo, Loader2 } from 'lucide-react';
import { useTaskActions } from '@/hooks/useTaskActions';
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
  isWithinInterval,
  endOfWeek,
} from 'date-fns';

type Bucket = 'all' | 'overdue' | 'today' | 'week';

export default function FollowUps() {
  const { user } = useAuth();
  const actions = useTaskActions();
  const { completeMutation, rdvPostponeMutation } = actions;

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
      const effectivePriority = computeEffectivePriority(t, (lead as any)?.follow_up_level);
      return { ...t, lead, effectivePriority };
    });
  }, [tasks, leadMap]);

  const visible = useMemo(() => {
    const now = startOfDay(new Date());
    return enriched.filter((t) => {
      // Une tache snoozee reste visible (badge "Snoozee jusqu'au X" sur la
      // carte) — son due_date (aligne sur snoozed_until au moment du report)
      // la place naturellement dans le bon onglet (Aujourd'hui/Semaine) une
      // fois la date de report arrivee.
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

  // Counters (independent of filters)
  const counts = useMemo(() => {
    const now = startOfDay(new Date());
    return {
      all: enriched.length,
      overdue: enriched.filter((t) => {
        const d = new Date(t.due_date);
        return isPast(d) && !isToday(d);
      }).length,
      today: enriched.filter((t) => isToday(new Date(t.due_date))).length,
      week: enriched.filter((t) =>
        isWithinInterval(new Date(t.due_date), { start: now, end: endOfWeek(now, { weekStartsOn: 1 }) })
      ).length,
    };
  }, [enriched]);

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
                    onComplete={(task, completedAt) => completeMutation.mutate({ task, completedAt })}
                    onSnooze={(task) => {
                      setSnoozeTask(task);
                      setSnoozeDate(undefined);
                    }}
                    onOpenLead={(task) => task.lead && setOpenLead(task.lead)}
                    onRdvWon={(task) => setRdvWonTask(task)}
                    onRdvLost={(task) => setRdvLostTask(task)}
                    onRdvPostpone={(task) => rdvPostponeMutation.mutate(task)}
                    isUpdating={completeMutation.isPending && completeMutation.variables?.task.id === t.id}
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

      <TaskActionDialogs
        actions={actions}
        snoozeTask={snoozeTask}
        setSnoozeTask={setSnoozeTask}
        snoozeDate={snoozeDate}
        setSnoozeDate={setSnoozeDate}
        rdvWonTask={rdvWonTask}
        setRdvWonTask={setRdvWonTask}
        rdvLostTask={rdvLostTask}
        setRdvLostTask={setRdvLostTask}
      />
    </AppLayout>
  );
}
