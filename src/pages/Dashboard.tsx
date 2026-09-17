import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { KpiCard } from '@/components/KpiCard';
import { ConversionRates } from '@/components/ConversionRates';
import { DateRangeFilter, getDefaultDateRange, type DateRange } from '@/components/DateRangeFilter';
import { CreateLeadModal } from '@/components/CreateLeadModal';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  MessageSquare, Reply, PhoneCall, CalendarCheck,
  DollarSign, Plus, Info, ArrowRight, Target,
} from 'lucide-react';
import { isWithinInterval, startOfWeek, endOfWeek, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useGamification } from '@/hooks/useGamification';
import { ScoreCard } from '@/components/gamification/ScoreCard';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Lead, LeadStatus } from '@/lib/constants';
import { SCORE_WEIGHTS_LABELS } from '@/lib/constants';
import { getHotOpportunities, TEMPERATURE_CONFIG } from '@/lib/leadScoring';
import { SetterBreakdownCard } from '@/components/SetterBreakdownCard';
import { useTeammates } from '@/hooks/useTeammates';
import { formatDistanceToNow } from 'date-fns';
import { TaskCard, type EnrichedTask } from '@/components/TaskCard';
import { TaskActionDialogs } from '@/components/TaskActionDialogs';
import { LeadDetailDrawer } from '@/components/LeadDetailDrawer';
import { useTaskActions } from '@/hooks/useTaskActions';
import { computeEffectivePriority, sortByPriority, type Task } from '@/lib/tasks';

export default function Dashboard() {
  const { user, profile } = useAuth();
  const [dateRange, setDateRange] = useState<DateRange>(getDefaultDateRange);
  const { teammates, isTeam } = useTeammates();
  const gamification = useGamification();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [scoreInfoOpen, setScoreInfoOpen] = useState(false);
  const [dealOpen, setDealOpen] = useState(false);
  const [dealLeadId, setDealLeadId] = useState('');
  const [dealAmount, setDealAmount] = useState('');
  const [createLeadOpen, setCreateLeadOpen] = useState(false);
  const taskActions = useTaskActions();
  const { completeMutation, rdvPostponeMutation } = taskActions;
  const [openLead, setOpenLead] = useState<Lead | null>(null);
  const [snoozeTask, setSnoozeTask] = useState<EnrichedTask | null>(null);
  const [snoozeDate, setSnoozeDate] = useState<Date | undefined>(undefined);
  const [rdvWonTask, setRdvWonTask] = useState<EnrichedTask | null>(null);
  const [rdvLostTask, setRdvLostTask] = useState<EnrichedTask | null>(null);
  const [revenueListOpen, setRevenueListOpen] = useState(false);
  const [clientsListOpen, setClientsListOpen] = useState(false);

  const { data: leads = [] } = useQuery({
    queryKey: ['dashboard-leads', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('leads').select('*').eq('owner_id', user!.id);
      return (data || []) as Lead[];
    },
    enabled: !!user,
  });

  const { data: pendingTasks = [] } = useQuery({
    queryKey: ['dashboard-tasks', user?.id],
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

  const { data: deals = [] } = useQuery({
    queryKey: ['dashboard-deals', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('deals').select('*').eq('owner_id', user!.id);
      return (data || []) as any[];
    },
    enabled: !!user,
  });

  const { data: myPersonas = [] } = useQuery({
    queryKey: ['my-personas', user?.id],
    queryFn: async () => {
      const { data: ups } = await supabase.from('user_personas').select('*').eq('user_id', user!.id);
      if (!ups?.length) return [];
      const pIds = ups.map((u: any) => u.persona_id);
      const { data: personas } = await supabase.from('personas').select('*').in('id', pIds);
      return (personas || []).map((p: any) => ({
        ...p,
        is_primary: ups.find((u: any) => u.persona_id === p.id)?.is_primary || false,
      })) as (Persona & { is_primary: boolean })[];
    },
    enabled: !!user,
  });

  const { data: allPersonas = [] } = useQuery({
    queryKey: ['all-personas'],
    queryFn: async () => {
      const { data } = await supabase.from('personas').select('id, name, target_type, sector, company_size');
      return (data || []) as { id: string; name: string; target_type: string | null; sector: string | null; company_size: string | null }[];
    },
    enabled: !!user,
  });

  const createDeal = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('deals').insert({
        lead_id: dealLeadId,
        owner_id: user!.id,
        amount: parseFloat(dealAmount) || 0,
        status: 'won',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-deals'] });
      setDealOpen(false);
      setDealLeadId('');
      setDealAmount('');
      toast({ title: 'Deal ajouté !' });
    },
    onError: (err: any) => toast({ variant: 'destructive', title: 'Erreur', description: err.message }),
  });

  const handleCreateLead = async (data: { first_name: string; last_name: string; linkedin_url: string; company_name: string; job_title: string; created_at: string; persona_id: string | null; outreach_type: string | null; setter_id?: string | null }) => {
    const { data: lead, error } = await supabase.from('leads').insert({
      owner_id: user!.id,
      setter_id: data.setter_id || user!.id,
      first_name: data.first_name,
      last_name: data.last_name,
      linkedin_url: data.linkedin_url || null,
      company_name: data.company_name || null,
      job_title: data.job_title || null,
      created_at: data.created_at,
      persona_id: data.persona_id || null,
      outreach_type: (data.outreach_type || null) as any,
      status: 'conversation_engagee' as LeadStatus,
      conversation_started_at: new Date().toISOString(),
    } as any).select().single();
    if (error) throw error;
    await supabase.from('lead_events').insert({
      lead_id: lead.id, user_id: user!.id,
      event_type: 'lead_created', new_value: 'conversation_engagee',
    });
    queryClient.invalidateQueries({ queryKey: ['dashboard-leads'] });
    queryClient.invalidateQueries({ queryKey: ['leads'] });
    toast({ title: 'Lead créé !' });
  };

  const inPeriod = (value?: string | null) => {
    if (!value) return false;
    try { return isWithinInterval(new Date(value), dateRange); } catch { return false; }
  };

  // ── Current-state KPI logic ──
  const RESPONDED_STATUSES = new Set(['en_cours', 'appel_propose', 'follow_up', 'rendez_vous_booke']);
  const CALL_PROPOSED_STATUSES = new Set(['appel_propose', 'rendez_vous_booke']);
  const RDV_BOOKED_STATUSES = new Set(['rendez_vous_booke']);

  const filteredLeads = leads;

  const contactedCount = filteredLeads.filter((l) => inPeriod(l.conversation_started_at || l.created_at)).length;
  const respondedCount = filteredLeads.filter((l) => RESPONDED_STATUSES.has(l.status) && inPeriod(l.conversation_started_at || l.created_at)).length;
  const callProposedCount = filteredLeads.filter((l) => CALL_PROPOSED_STATUSES.has(l.status) && inPeriod(l.conversation_started_at || l.created_at)).length;
  const rdvBookedCount = filteredLeads.filter((l) => RDV_BOOKED_STATUSES.has(l.status) && inPeriod(l.conversation_started_at || l.created_at)).length;
  const closedWonCount = filteredLeads.filter((l) => l.status === 'ferme_gagne' && inPeriod(l.conversation_started_at || l.created_at)).length;
  const overdueFollowUps = filteredLeads.filter((l) => l.status === 'follow_up' && l.follow_up_date && new Date(l.follow_up_date) < new Date()).length;

  // Filter deals based on outreach-filtered leads
  const filteredLeadIds = useMemo(() => new Set(filteredLeads.map((l) => l.id)), [filteredLeads]);
  const filteredDeals = useMemo(() => deals.filter((d: any) =>
    filteredLeadIds.has(d.lead_id) && inPeriod(d.created_at)
  ), [deals, filteredLeadIds, dateRange]);
  const wonDeals = filteredDeals.filter((d: any) => d.status === 'won');
  const totalRevenue = wonDeals.reduce((s: number, d: any) => s + Number(d.amount), 0);
  const wonLeads = filteredLeads.filter((l) => l.status === 'ferme_gagne' && !deals.find((d: any) => d.lead_id === l.id));

  const leadById = useMemo(() => new Map(filteredLeads.map((l) => [l.id, l])), [filteredLeads]);
  const wonDealsWithLead = useMemo(
    () => wonDeals
      .map((d: any) => ({ ...d, lead: leadById.get(d.lead_id) }))
      .sort((a, b) => Number(b.amount) - Number(a.amount)),
    [wonDeals, leadById],
  );

  const weekLabel = useMemo(() => {
    const now = new Date();
    const start = startOfWeek(now, { weekStartsOn: 1 });
    const end = endOfWeek(now, { weekStartsOn: 1 });
    return `${format(start, 'd MMM', { locale: fr })} → ${format(end, 'd MMM', { locale: fr })}`;
  }, []);

  const enrichedTasks: EnrichedTask[] = useMemo(() => {
    return pendingTasks.map((t) => {
      const lead = leadById.get(t.lead_id) || null;
      const effectivePriority = computeEffectivePriority(t, (lead as any)?.follow_up_level);
      return { ...t, lead, effectivePriority };
    });
  }, [pendingTasks, leadById]);

  const sortedTasks = useMemo(() => sortByPriority(enrichedTasks), [enrichedTasks]);
  const mainTask = sortedTasks[0] ?? null;
  const secondaryTasks = sortedTasks.slice(1, 3);

  const hotOpportunities = useMemo(() => getHotOpportunities(filteredLeads), [filteredLeads]);

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 space-y-6" data-testid="page-dashboard">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Bonjour, {profile?.full_name || 'Setter'} 👋
            </h1>
            <p className="text-sm text-muted-foreground">Cette semaine • {weekLabel}</p>
          </div>
          <Button onClick={() => setCreateLeadOpen(true)} size="sm" data-testid="dashboard-new-lead">
            <Plus className="mr-1 h-4 w-4" /> Nouveau lead
          </Button>
        </div>

        {/* ScoreCard */}
        <div className="relative">
          <Button variant="ghost" size="icon" className="absolute top-3 right-3 z-10 h-7 w-7" onClick={() => setScoreInfoOpen(true)}>
            <Info className="h-4 w-4 text-muted-foreground" />
          </Button>
          <ScoreCard
            totalScore={gamification.totalScore}
            todayScore={gamification.todayScore}
            weekScore={gamification.weekScore}
            level={gamification.level}
            streak={gamification.streak}
          />
        </div>

        {/* Ta prochaine action */}
        {(mainTask || hotOpportunities.length > 0) && (
          <Card className="border-primary/30">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                  Ta prochaine action
                </CardTitle>
                {sortedTasks.length > 1 && (
                  <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                    {sortedTasks.length - 1} en attente
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {mainTask && (
                <TaskCard
                  task={mainTask}
                  onComplete={(task, completedAt) => completeMutation.mutate({ task, completedAt })}
                  onSnooze={(task) => { setSnoozeTask(task); setSnoozeDate(undefined); }}
                  onOpenLead={(task) => task.lead && setOpenLead(task.lead)}
                  onRdvWon={(task) => setRdvWonTask(task)}
                  onRdvLost={(task) => setRdvLostTask(task)}
                  onRdvPostpone={(task) => rdvPostponeMutation.mutate(task)}
                  isUpdating={completeMutation.isPending && completeMutation.variables?.task.id === mainTask.id}
                />
              )}

              {/* Actions secondaires */}
              {secondaryTasks.length > 0 && (
                <div className="grid gap-2 sm:grid-cols-2 pt-2 border-t">
                  {secondaryTasks.map((t) => (
                    <TaskCard
                      key={t.id}
                      task={t}
                      compact
                      onComplete={(task, completedAt) => completeMutation.mutate({ task, completedAt })}
                      onSnooze={(task) => { setSnoozeTask(task); setSnoozeDate(undefined); }}
                      onOpenLead={(task) => task.lead && setOpenLead(task.lead)}
                      onRdvWon={(task) => setRdvWonTask(task)}
                      onRdvLost={(task) => setRdvLostTask(task)}
                      onRdvPostpone={(task) => rdvPostponeMutation.mutate(task)}
                      isUpdating={completeMutation.isPending && completeMutation.variables?.task.id === t.id}
                    />
                  ))}
                </div>
              )}

              {/* Opportunites (signal informatif, pas une task) */}
              {hotOpportunities.length > 0 && (
                <div className={mainTask ? 'space-y-1.5 border-t pt-3' : 'space-y-1.5'}>
                  {hotOpportunities.map((op) => (
                    <div key={op.lead.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{TEMPERATURE_CONFIG.hot.emoji}</span>
                      <span className="font-medium text-foreground">{op.lead.first_name} {op.lead.last_name}</span>
                      <span>· {op.reason}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* KPIs */}
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted-foreground">Performance CRM</h2>
          <DateRangeFilter value={dateRange} onChange={setDateRange} triggerClassName="bg-primary text-primary-foreground border-primary hover:bg-primary/90 hover:text-primary-foreground" />
        </div>
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4" data-testid="dashboard-kpi-grid">
          <KpiCard title="Conversations" value={contactedCount} icon={<MessageSquare className="h-4 w-4" />} className="border-primary/30" />
          <KpiCard title="Réponses" value={respondedCount} icon={<Reply className="h-4 w-4" />} className="border-primary/30" />
          <KpiCard title="Appels proposés" value={callProposedCount} icon={<PhoneCall className="h-4 w-4" />} className="border-primary/30" />
          <KpiCard title="RDV bookés" value={rdvBookedCount} icon={<CalendarCheck className="h-4 w-4" />} className="border-primary/30" />
        </div>

        {/* Conversion + CA */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="border-primary/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Taux de conversion</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ConversionRates
                conversations={contactedCount}
                responses={respondedCount}
                callsProposed={callProposedCount}
                meetingsBooked={rdvBookedCount}
                closedWon={closedWonCount}
              />
            </CardContent>
          </Card>

          <Card className="border-primary/30">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-primary" />
                Chiffre d'affaires
              </CardTitle>
              {wonLeads.length > 0 && (
                <Button size="sm" variant="outline" onClick={() => setDealOpen(true)}>
                  <Plus className="h-4 w-4 mr-1" /> Deal
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setRevenueListOpen(true)}
                  className="text-center p-3 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors cursor-pointer"
                  data-testid="dashboard-revenue-total"
                >
                  <p className="text-2xl font-bold text-primary">{totalRevenue.toLocaleString('fr-FR')}€</p>
                  <p className="text-xs text-muted-foreground">CA total</p>
                </button>
                <button
                  type="button"
                  onClick={() => setClientsListOpen(true)}
                  className="text-center p-3 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors cursor-pointer"
                  data-testid="dashboard-revenue-clients"
                >
                  <p className="text-2xl font-bold text-primary">{wonDeals.length}</p>
                  <p className="text-xs text-muted-foreground">Clients</p>
                </button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Per-setter breakdown (team accounts only) */}
        {isTeam && (
          <SetterBreakdownCard leads={filteredLeads} teammates={teammates} inPeriod={inPeriod} />
        )}

      </div>

      {/* Score explanation modal */}
      <Dialog open={scoreInfoOpen} onOpenChange={setScoreInfoOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Comment fonctionne le Setting Score ?</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Chaque action métier vous rapporte des points :</p>
            <div className="space-y-2">
              {SCORE_WEIGHTS_LABELS.map(({ label, points }) => (
                <div key={label} className="flex items-center justify-between rounded-md border border-primary/30 p-2.5">
                  <span className="text-sm">{label}</span>
                  <Badge variant="secondary" className="text-xs font-semibold">+{points} pts</Badge>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Le score récompense les bonnes actions métier : qualité, régularité et performance.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Deal modal */}
      <Dialog open={dealOpen} onOpenChange={setDealOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Ajouter un deal</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Lead (Fermé gagné)</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={dealLeadId}
                onChange={(e) => setDealLeadId(e.target.value)}
              >
                <option value="">Sélectionner un lead</option>
                {wonLeads.map((l) => (
                  <option key={l.id} value={l.id}>{l.first_name} {l.last_name}{l.company_name ? ` — ${l.company_name}` : ''}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Montant (€)</Label>
              <Input type="number" value={dealAmount} onChange={(e) => setDealAmount(e.target.value)} placeholder="0" />
            </div>
            <Button onClick={() => createDeal.mutate()} disabled={!dealLeadId || !dealAmount || createDeal.isPending} className="w-full">
              Ajouter
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Revenue breakdown modal */}
      <Dialog open={revenueListOpen} onOpenChange={setRevenueListOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Chiffre d'affaires — {totalRevenue.toLocaleString('fr-FR')}€</DialogTitle>
          </DialogHeader>
          {wonDealsWithLead.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Aucun deal sur cette période.</p>
          ) : (
            <div className="space-y-1 max-h-80 overflow-y-auto">
              {wonDealsWithLead.map((d: any) => (
                <div key={d.id} className="flex items-center justify-between rounded-md border p-2.5 text-sm">
                  <span className="truncate">{d.lead ? `${d.lead.first_name} ${d.lead.last_name}` : 'Lead supprimé'}</span>
                  <span className="font-semibold text-primary shrink-0 ml-2">{Number(d.amount).toLocaleString('fr-FR')}€</span>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Clients (closed-won) list modal */}
      <Dialog open={clientsListOpen} onOpenChange={setClientsListOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Clients — {wonDeals.length}</DialogTitle>
          </DialogHeader>
          {wonDealsWithLead.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Aucun client sur cette période.</p>
          ) : (
            <div className="space-y-1 max-h-80 overflow-y-auto">
              {wonDealsWithLead.map((d: any) => (
                <div key={d.id} className="flex items-center justify-between rounded-md border p-2.5 text-sm">
                  <span className="truncate">{d.lead ? `${d.lead.first_name} ${d.lead.last_name}` : 'Lead supprimé'}</span>
                  <Badge variant="secondary" className="shrink-0 ml-2">Fermé gagné</Badge>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <CreateLeadModal open={createLeadOpen} onOpenChange={setCreateLeadOpen} onSubmit={handleCreateLead} />

      <LeadDetailDrawer
        lead={openLead}
        open={!!openLead}
        onOpenChange={(o) => !o && setOpenLead(null)}
      />

      <TaskActionDialogs
        actions={taskActions}
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
