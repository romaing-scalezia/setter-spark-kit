import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate, Link } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { KpiCard } from '@/components/KpiCard';
import { ConversionRates, MiniFunnel } from '@/components/ConversionRates';
import { DateRangeFilter, getDefaultDateRange, type DateRange } from '@/components/DateRangeFilter';
import { CreateLeadModal } from '@/components/CreateLeadModal';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  MessageSquare, PhoneCall, CalendarCheck, Clock,
  AlertTriangle, DollarSign, Plus, Info, ArrowRight, Target, Video, PenLine
} from 'lucide-react';
import { isWithinInterval } from 'date-fns';
import { useGamification } from '@/hooks/useGamification';
import { ScoreCard } from '@/components/gamification/ScoreCard';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Lead, LeadStatus, OutreachType } from '@/lib/constants';
import { SCORE_WEIGHTS_LABELS, OUTREACH_TYPE_LABELS } from '@/lib/constants';
import { getPriorityActions, getUserAlerts, PRIORITY_CONFIG, type UserAlert } from '@/lib/leadScoring';
import { TodaysActionsCard } from '@/components/TodaysActionsCard';
import { SetterBreakdownCard } from '@/components/SetterBreakdownCard';
import { useTeammates } from '@/hooks/useTeammates';
import type { Persona } from '@/pages/Personas';

export default function Dashboard() {
  const { user, profile, activeRole } = useAuth();
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
  const [outreachFilter, setOutreachFilter] = useState('all');

  const { data: leads = [] } = useQuery({
    queryKey: ['dashboard-leads', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('leads').select('*').eq('owner_id', user!.id);
      return (data || []) as Lead[];
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

  const handleCreateLead = async (data: { first_name: string; last_name: string; linkedin_url: string; persona_id: string | null; outreach_type: string | null; setter_id?: string | null }) => {
    const { data: lead, error } = await supabase.from('leads').insert({
      owner_id: user!.id,
      setter_id: data.setter_id || user!.id,
      first_name: data.first_name,
      last_name: data.last_name,
      linkedin_url: data.linkedin_url || null,
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

  // Apply outreach filter to leads for all KPIs
  const filteredLeads = outreachFilter === 'all' ? leads : leads.filter((l) => l.outreach_type === outreachFilter);

  const contactedCount = filteredLeads.filter((l) => inPeriod(l.conversation_started_at || l.created_at)).length;
  const respondedCount = filteredLeads.filter((l) => RESPONDED_STATUSES.has(l.status) && inPeriod(l.conversation_started_at || l.created_at)).length;
  const callProposedCount = filteredLeads.filter((l) => CALL_PROPOSED_STATUSES.has(l.status) && inPeriod(l.conversation_started_at || l.created_at)).length;
  const rdvBookedCount = filteredLeads.filter((l) => RDV_BOOKED_STATUSES.has(l.status) && inPeriod(l.conversation_started_at || l.created_at)).length;
  const overdueFollowUps = filteredLeads.filter((l) => l.status === 'follow_up' && l.follow_up_date && new Date(l.follow_up_date) < new Date()).length;

  // Filter deals based on outreach-filtered leads
  const filteredLeadIds = useMemo(() => new Set(filteredLeads.map((l) => l.id)), [filteredLeads]);
  const filteredDeals = useMemo(() => deals.filter((d: any) => filteredLeadIds.has(d.lead_id)), [deals, filteredLeadIds]);
  const totalRevenue = filteredDeals.filter((d: any) => d.status === 'won').reduce((s: number, d: any) => s + Number(d.amount), 0);
  const rdvLeads = filteredLeads.filter((l) => l.status === 'rendez_vous_booke' && !deals.find((d: any) => d.lead_id === l.id));

  // Outreach comparison analytics (uses filteredLeads so it respects the active filter)
  const outreachComparison = useMemo(() => {
    const calcStats = (subset: Lead[]) => {
      const contacted = subset.filter((l) => inPeriod(l.conversation_started_at || l.created_at)).length;
      const responded = subset.filter((l) => RESPONDED_STATUSES.has(l.status) && inPeriod(l.conversation_started_at || l.created_at)).length;
      const calls = subset.filter((l) => CALL_PROPOSED_STATUSES.has(l.status) && inPeriod(l.conversation_started_at || l.created_at)).length;
      const rdv = subset.filter((l) => RDV_BOOKED_STATUSES.has(l.status) && inPeriod(l.conversation_started_at || l.created_at)).length;
      return {
        contacted,
        responded,
        calls,
        rdv,
        respRate: contacted > 0 ? Math.round((responded / contacted) * 100) : 0,
        bookingRate: contacted > 0 ? Math.round((rdv / contacted) * 100) : 0,
      };
    };
    // When a specific outreach filter is active, show only that type; otherwise show all types
    if (outreachFilter !== 'all') {
      return {
        [outreachFilter]: calcStats(filteredLeads),
      } as Record<string, ReturnType<typeof calcStats>>;
    }
    return {
      message_texte: calcStats(filteredLeads.filter((l) => l.outreach_type === 'message_texte')),
      video: calcStats(filteredLeads.filter((l) => l.outreach_type === 'video')),
      vocal: calcStats(filteredLeads.filter((l) => l.outreach_type === 'vocal')),
    } as Record<string, ReturnType<typeof calcStats>>;
  }, [filteredLeads, dateRange, outreachFilter]);

  const priorityActions = useMemo(() => getPriorityActions(filteredLeads), [filteredLeads]);
  const userAlerts = useMemo(() => getUserAlerts(filteredLeads), [filteredLeads]);

  const personaMap = useMemo(() => {
    const map = new Map<string, typeof allPersonas[0]>();
    allPersonas.forEach((p) => map.set(p.id, p));
    return map;
  }, [allPersonas]);

  const personaStats = useMemo(() => {
    const personaLeads = filteredLeads.filter((l) => (l as any).persona_id);
    const grouped = new Map<string, Lead[]>();
    for (const l of personaLeads) {
      const pid = (l as any).persona_id;
      if (!grouped.has(pid)) grouped.set(pid, []);
      grouped.get(pid)!.push(l);
    }
    return Array.from(grouped.entries()).map(([pid, pLeads]) => {
      const persona = personaMap.get(pid);
      const name = persona?.name || 'Inconnu';
      const contacted = pLeads.filter((l) => inPeriod(l.conversation_started_at || l.created_at)).length;
      const responded = pLeads.filter((l) => RESPONDED_STATUSES.has(l.status) && inPeriod(l.conversation_started_at || l.created_at)).length;
      const rdv = pLeads.filter((l) => RDV_BOOKED_STATUSES.has(l.status) && inPeriod(l.conversation_started_at || l.created_at)).length;
      const respRate = contacted > 0 ? Math.round((responded / contacted) * 100) : 0;
      return { pid, name, contacted, responded, rdv, respRate, sector: persona?.sector, target_type: persona?.target_type, company_size: persona?.company_size };
    }).sort((a, b) => b.rdv - a.rdv || b.contacted - a.contacted);
  }, [filteredLeads, personaMap, dateRange]);

  // Stats by dimension
  const dimensionStats = useMemo(() => {
    const personaLeads = filteredLeads.filter((l) => (l as any).persona_id);
    const bySector = new Map<string, { contacted: number; responded: number; rdv: number }>();
    const byType = new Map<string, { contacted: number; responded: number; rdv: number }>();

    for (const l of personaLeads) {
      const persona = personaMap.get((l as any).persona_id);
      if (!persona) continue;
      const isInPeriod = inPeriod(l.conversation_started_at || l.created_at);
      const hasResp = isInPeriod && RESPONDED_STATUSES.has(l.status);
      const hasRdv = isInPeriod && RDV_BOOKED_STATUSES.has(l.status);

      for (const [key, map] of [[persona.sector, bySector], [persona.target_type, byType]] as const) {
        if (!key) continue;
        const m = map as Map<string, { contacted: number; responded: number; rdv: number }>;
        if (!m.has(key)) m.set(key, { contacted: 0, responded: 0, rdv: 0 });
        const entry = m.get(key)!;
        if (isInPeriod) entry.contacted++;
        if (hasResp) entry.responded++;
        if (hasRdv) entry.rdv++;
      }
    }

    const toArray = (m: Map<string, { contacted: number; responded: number; rdv: number }>) =>
      Array.from(m.entries()).map(([key, v]) => ({
        key,
        ...v,
        respRate: v.contacted > 0 ? Math.round((v.responded / v.contacted) * 100) : 0,
      })).sort((a, b) => b.rdv - a.rdv || b.contacted - a.contacted);

    return { bySector: toArray(bySector), byType: toArray(byType) };
  }, [filteredLeads, personaMap, dateRange]);

  if (activeRole === 'coach') return <Navigate to="/coach" replace />;

  const alertRoute = (alert: UserAlert) => {
    if (alert.key === 'overdue_followups') return '/follow-ups';
    if (alert.key === 'low_conversations') return '/leads';
    return '/leads';
  };

  const primaryPersona = myPersonas.find((p) => p.is_primary);

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 space-y-6" data-testid="page-dashboard">
        {/* Header */}
        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                Bonjour, {profile?.full_name || 'Setter'} 👋
              </h1>
              <p className="text-muted-foreground">Votre tableau de bord</p>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={() => setCreateLeadOpen(true)} size="sm" data-testid="dashboard-new-lead">
                <Plus className="mr-1 h-4 w-4" /> Nouveau lead
              </Button>
              {primaryPersona && (
                <Link to="/personas" className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 hover:bg-muted/50 transition-colors">
                  <Target className="h-4 w-4 text-primary shrink-0" />
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Cible actuelle</p>
                    <p className="text-sm font-medium text-foreground">{primaryPersona.name}</p>
                  </div>
                </Link>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <DateRangeFilter value={dateRange} onChange={setDateRange} />
            <div className="flex gap-1">
              {[
                { value: 'all', label: 'Tous', icon: null },
                { value: 'message_texte', label: 'Écrit', icon: <PenLine className="h-3 w-3" /> },
                { value: 'video', label: 'Vidéo', icon: <Video className="h-3 w-3" /> },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setOutreachFilter(opt.value)}
                  className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                    outreachFilter === opt.value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-background text-muted-foreground hover:bg-muted/50'
                  }`}
                >
                  {opt.icon}{opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4" data-testid="dashboard-kpi-grid">
          <KpiCard title="Conversations" value={contactedCount} icon={<MessageSquare className="h-4 w-4" />} />
          <KpiCard title="Réponses" value={respondedCount} icon={<PhoneCall className="h-4 w-4" />} />
          <KpiCard title="Appels proposés" value={callProposedCount} icon={<PhoneCall className="h-4 w-4" />} />
          <KpiCard title="RDV bookés" value={rdvBookedCount} icon={<CalendarCheck className="h-4 w-4" />} />
        </div>

        {/* Conversion Rates */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Taux de conversion</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ConversionRates
              conversations={contactedCount}
              responses={respondedCount}
              callsProposed={callProposedCount}
              meetingsBooked={rdvBookedCount}
            />
            <MiniFunnel
              conversations={contactedCount}
              responses={respondedCount}
              callsProposed={callProposedCount}
              meetingsBooked={rdvBookedCount}
            />
          </CardContent>
        </Card>

        {/* Outreach Format Comparison */}
        {Object.values(outreachComparison).some((d) => d.contacted > 0) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Video className="h-4 w-4 text-primary" />
                Performance par format d'approche
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-3">
                {([
                  { key: 'message_texte', label: '✍️ Écrit' },
                  { key: 'video', label: '🎥 Vidéo' },
                  { key: 'vocal', label: '🎙️ Vocal' },
                ] as const).filter(({ key }) => outreachComparison[key]?.contacted > 0).map(({ key, label }) => {
                  const data = outreachComparison[key]!;
                  return (
                    <div key={key} className="rounded-lg border p-3 space-y-2">
                      <p className="text-sm font-medium text-foreground">{label}</p>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div><span className="text-muted-foreground">Conversations</span><p className="font-medium text-foreground">{data.contacted}</p></div>
                        <div><span className="text-muted-foreground">Réponses</span><p className="font-medium text-foreground">{data.responded}</p></div>
                        <div><span className="text-muted-foreground">Appels</span><p className="font-medium text-foreground">{data.calls}</p></div>
                        <div><span className="text-muted-foreground">RDV</span><p className="font-medium text-foreground">{data.rdv}</p></div>
                      </div>
                      <div className="flex gap-3 pt-1 border-t text-xs">
                        <div>
                          <span className="text-muted-foreground">Taux rép.</span>
                          <p className="font-semibold text-foreground">{data.respRate}%</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Taux booking</span>
                          <p className="font-semibold text-foreground">{data.bookingRate}%</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {userAlerts.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                Alertes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {userAlerts.map((alert) => (
                <Link
                  key={alert.key}
                  to={alertRoute(alert)}
                  className={`flex items-center justify-between rounded-md border p-3 transition-colors hover:bg-muted/50 ${
                    alert.severity === 'high' ? 'border-destructive/30 bg-destructive/5' :
                    alert.severity === 'medium' ? 'border-amber-300/50 bg-amber-50/50' :
                    'border-border'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                      alert.severity === 'high' ? 'bg-destructive' :
                      alert.severity === 'medium' ? 'bg-amber-500' : 'bg-muted-foreground'
                    }`} />
                    <div>
                      <p className="text-sm font-medium text-foreground">{alert.title}</p>
                      <p className="text-xs text-muted-foreground">{alert.description}</p>
                    </div>
                  </div>
                  <span className="text-xs text-primary font-medium shrink-0 ml-2">{alert.action} →</span>
                </Link>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Today's Actions (smart task engine) */}
        <TodaysActionsCard />

        {/* Per-setter breakdown (team accounts only) */}
        {isTeam && (
          <SetterBreakdownCard leads={filteredLeads} teammates={teammates} inPeriod={inPeriod} />
        )}

        {/* Priority Actions */}
        {priorityActions.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                Actions prioritaires
                <Badge variant="secondary" className="text-xs ml-1">{priorityActions.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {priorityActions.slice(0, 8).map((pa, i) => (
                <Link
                  key={`${pa.lead.id}-${i}`}
                  to="/leads"
                  className={`flex items-center justify-between rounded-md border p-3 transition-colors hover:bg-muted/50 ${PRIORITY_CONFIG[pa.level].className}`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`h-2 w-2 rounded-full shrink-0 ${PRIORITY_CONFIG[pa.level].dotClassName}`} />
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground">{pa.lead.first_name} {pa.lead.last_name}</p>
                        {pa.lead.company_name && <span className="text-xs text-muted-foreground">— {pa.lead.company_name}</span>}
                      </div>
                      <p className="text-xs text-muted-foreground">{pa.reason}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-medium text-primary">{pa.action}</span>
                    <ArrowRight className="h-3 w-3 text-primary" />
                  </div>
                </Link>
              ))}
              {priorityActions.length > 8 && (
                <Link to="/leads" className="block text-center text-sm text-primary hover:underline py-1">
                  Voir les {priorityActions.length - 8} autres actions →
                </Link>
              )}
            </CardContent>
          </Card>
        )}

        {/* Score + Revenue */}
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="relative">
            <Button variant="ghost" size="icon" className="absolute top-3 right-3 z-10 h-7 w-7" onClick={() => setScoreInfoOpen(true)}>
              <Info className="h-4 w-4 text-muted-foreground" />
            </Button>
            <ScoreCard totalScore={gamification.totalScore} todayScore={gamification.todayScore} weekScore={gamification.weekScore} level={gamification.level} streak={gamification.streak} />
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-primary" />
                Chiffre d'affaires
              </CardTitle>
              {rdvLeads.length > 0 && (
                <Button size="sm" variant="outline" onClick={() => setDealOpen(true)}>
                  <Plus className="h-4 w-4 mr-1" /> Deal
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 rounded-lg bg-muted/50">
                  <p className="text-2xl font-bold text-foreground">{totalRevenue.toLocaleString('fr-FR')}€</p>
                  <p className="text-xs text-muted-foreground">CA total</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted/50">
                  <p className="text-2xl font-bold text-foreground">{filteredDeals.filter((d: any) => d.status === 'won').length}</p>
                  <p className="text-xs text-muted-foreground">Clients</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Performance par cible */}
        {personaStats.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                Performance par cible
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {personaStats.map((ps) => (
                  <div key={ps.pid} className="flex items-center justify-between rounded-md border p-3">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline">{ps.name}</Badge>
                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                        {ps.sector && <span className="text-[10px]">{ps.sector}</span>}
                        {ps.target_type && <span className="text-[10px]">· {ps.target_type}</span>}
                      </div>
                    </div>
                    <div className="flex gap-4 text-xs text-muted-foreground shrink-0">
                      <span>{ps.contacted} conv.</span>
                      <span>{ps.respRate}% rép.</span>
                      <span className="font-medium text-foreground">{ps.rdv} RDV</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats par secteur & type */}
        {(dimensionStats.bySector.length > 0 || dimensionStats.byType.length > 0) && (
          <div className="grid gap-6 lg:grid-cols-2">
            {dimensionStats.bySector.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Performance par secteur</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {dimensionStats.bySector.map((s) => (
                      <div key={s.key} className="flex items-center justify-between rounded-md border p-2.5">
                        <span className="text-sm font-medium">{s.key}</span>
                        <div className="flex gap-3 text-xs text-muted-foreground">
                          <span>{s.contacted} conv.</span>
                          <span>{s.respRate}% rép.</span>
                          <span className="font-medium text-foreground">{s.rdv} RDV</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
            {dimensionStats.byType.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Performance par type de cible</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {dimensionStats.byType.map((t) => (
                      <div key={t.key} className="flex items-center justify-between rounded-md border p-2.5">
                        <span className="text-sm font-medium">{t.key}</span>
                        <div className="flex gap-3 text-xs text-muted-foreground">
                          <span>{t.contacted} conv.</span>
                          <span>{t.respRate}% rép.</span>
                          <span className="font-medium text-foreground">{t.rdv} RDV</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
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
                <div key={label} className="flex items-center justify-between rounded-md border p-2.5">
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
              <Label>Lead (RDV booké)</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={dealLeadId}
                onChange={(e) => setDealLeadId(e.target.value)}
              >
                <option value="">Sélectionner un lead</option>
                {rdvLeads.map((l) => (
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

      <CreateLeadModal open={createLeadOpen} onOpenChange={setCreateLeadOpen} onSubmit={handleCreateLead} />
    </AppLayout>
  );
}
