import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/AppLayout';
import { KpiCard } from '@/components/KpiCard';
import { ConversionRates, MiniFunnel } from '@/components/ConversionRates';
import { FunnelChart } from '@/components/FunnelChart';
import { DateRangeFilter, getDefaultDateRange, type DateRange } from '@/components/DateRangeFilter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  BarChart3, MessageSquare, PhoneCall, CalendarCheck, Clock, XCircle, Ban,
  Search, Users, User, DollarSign, TrendingUp, Video, PenLine, Loader2,
} from 'lucide-react';
import { isWithinInterval } from 'date-fns';
import type { Lead, LeadStatus } from '@/lib/constants';
import { STATUS_CONFIG, FUNNEL_STATUSES, LOSS_REASONS, DISQUALIFICATION_REASONS, OUTREACH_TYPE_LABELS } from '@/lib/constants';

const RESPONDED_STATUSES = new Set<string>(['en_cours', 'appel_propose', 'follow_up', 'rendez_vous_booke']);
const CALL_PROPOSED_STATUSES = new Set<string>(['appel_propose', 'rendez_vous_booke']);
const RDV_BOOKED_STATUSES = new Set<string>(['rendez_vous_booke']);

function pct(num: number, den: number): string {
  if (den === 0) return '—';
  return `${Math.round((num / den) * 100)}%`;
}

type UserProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  role: string;
};

export default function AdminAnalytics() {
  const [dateRange, setDateRange] = useState<DateRange>(getDefaultDateRange);
  const [viewMode, setViewMode] = useState<'global' | 'individual'>('global');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userSearch, setUserSearch] = useState('');
  const [outreachFilter, setOutreachFilter] = useState('all');

  // Fetch all profiles (admin RLS allows)
  const { data: profiles = [], isLoading: profilesLoading } = useQuery({
    queryKey: ['admin-analytics-profiles'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, full_name, email, avatar_url, role');
      return (data || []) as UserProfile[];
    },
  });

  // Fetch all leads (admin RLS allows)
  const { data: allLeads = [], isLoading: leadsLoading } = useQuery({
    queryKey: ['admin-analytics-leads'],
    queryFn: async () => {
      const { data } = await supabase.from('leads').select('*');
      return (data || []) as Lead[];
    },
  });

  // Fetch all deals
  const { data: allDeals = [] } = useQuery({
    queryKey: ['admin-analytics-deals'],
    queryFn: async () => {
      const { data } = await supabase.from('deals').select('*');
      return (data || []) as any[];
    },
  });

  const userProfiles = useMemo(
    () => profiles.filter((p) => p.role === 'user'),
    [profiles]
  );

  const filteredUserList = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return userProfiles;
    return userProfiles.filter((p) =>
      [p.full_name, p.email].some((f) => f?.toLowerCase().includes(q))
    );
  }, [userProfiles, userSearch]);

  const selectedProfile = useMemo(
    () => profiles.find((p) => p.id === selectedUserId) || null,
    [profiles, selectedUserId]
  );

  // Filter leads by selected user (or all) and outreach
  const scopedLeads = useMemo(() => {
    let leads = viewMode === 'individual' && selectedUserId
      ? allLeads.filter((l) => l.owner_id === selectedUserId)
      : allLeads;
    if (outreachFilter !== 'all') {
      leads = leads.filter((l) => l.outreach_type === outreachFilter);
    }
    return leads;
  }, [allLeads, viewMode, selectedUserId, outreachFilter]);

  const scopedDeals = useMemo(() => {
    const leadIds = new Set(scopedLeads.map((l) => l.id));
    return allDeals.filter((d: any) => leadIds.has(d.lead_id));
  }, [allDeals, scopedLeads]);

  const inPeriod = (value?: string | null) => {
    if (!value) return false;
    try { return isWithinInterval(new Date(value), dateRange); } catch { return false; }
  };

  // KPIs
  const contactedCount = scopedLeads.filter((l) => inPeriod(l.conversation_started_at || l.created_at)).length;
  const respondedCount = scopedLeads.filter((l) => RESPONDED_STATUSES.has(l.status) && inPeriod(l.conversation_started_at || l.created_at)).length;
  const callProposedCount = scopedLeads.filter((l) => CALL_PROPOSED_STATUSES.has(l.status) && inPeriod(l.conversation_started_at || l.created_at)).length;
  const rdvBookedCount = scopedLeads.filter((l) => RDV_BOOKED_STATUSES.has(l.status) && inPeriod(l.conversation_started_at || l.created_at)).length;
  const closedWonCount = scopedLeads.filter((l) => l.status === 'ferme_gagne' && inPeriod(l.conversation_started_at || l.created_at)).length;
  const followUpCount = scopedLeads.filter((l) => l.status === 'follow_up').length;
  const lostCount = scopedLeads.filter((l) => l.status === 'ferme_perdu' && inPeriod(l.closed_lost_at || l.created_at)).length;
  const unqualifiedCount = scopedLeads.filter((l) => l.status === 'non_qualifie' && inPeriod(l.unqualified_at || l.created_at)).length;
  const totalRevenue = scopedDeals.filter((d: any) => d.status === 'won').reduce((s: number, d: any) => s + Number(d.amount), 0);
  const totalClients = scopedDeals.filter((d: any) => d.status === 'won').length;

  // Funnel data
  const funnelData = useMemo(() => {
    const counts = {} as Record<LeadStatus, number>;
    for (const s of Object.keys(STATUS_CONFIG) as LeadStatus[]) counts[s] = 0;
    for (const l of scopedLeads) counts[l.status] = (counts[l.status] || 0) + 1;
    return counts;
  }, [scopedLeads]);

  // Loss reasons
  const lossReasonStats = useMemo(() => {
    const map = new Map<string, number>();
    for (const l of scopedLeads) {
      if (l.status === 'ferme_perdu' && l.loss_reason) {
        map.set(l.loss_reason, (map.get(l.loss_reason) || 0) + 1);
      }
    }
    return Array.from(map.entries())
      .map(([reason, count]) => ({ reason, label: LOSS_REASONS[reason as keyof typeof LOSS_REASONS] || reason, count }))
      .sort((a, b) => b.count - a.count);
  }, [scopedLeads]);

  // Disqualification reasons
  const disqualReasonStats = useMemo(() => {
    const map = new Map<string, number>();
    for (const l of scopedLeads) {
      if (l.status === 'non_qualifie' && l.disqualification_reason) {
        map.set(l.disqualification_reason, (map.get(l.disqualification_reason) || 0) + 1);
      }
    }
    return Array.from(map.entries())
      .map(([reason, count]) => ({ reason, label: DISQUALIFICATION_REASONS[reason as keyof typeof DISQUALIFICATION_REASONS] || reason, count }))
      .sort((a, b) => b.count - a.count);
  }, [scopedLeads]);

  // Outreach stats
  const outreachStats = useMemo(() => {
    const types = ['message_texte', 'video', 'vocal'] as const;
    return types.map((type) => {
      const subset = scopedLeads.filter((l) => l.outreach_type === type);
      const contacted = subset.filter((l) => inPeriod(l.conversation_started_at || l.created_at)).length;
      const responded = subset.filter((l) => RESPONDED_STATUSES.has(l.status) && inPeriod(l.conversation_started_at || l.created_at)).length;
      const rdv = subset.filter((l) => RDV_BOOKED_STATUSES.has(l.status) && inPeriod(l.conversation_started_at || l.created_at)).length;
      return { type, label: OUTREACH_TYPE_LABELS[type], contacted, responded, rdv, respRate: pct(responded, contacted), bookingRate: pct(rdv, contacted) };
    }).filter((s) => s.contacted > 0);
  }, [scopedLeads, dateRange]);

  // Ranking table (global mode only)
  const ranking = useMemo(() => {
    if (viewMode !== 'global') return [];
    const userLeadsMap = new Map<string, Lead[]>();
    for (const l of allLeads) {
      if (!userLeadsMap.has(l.owner_id)) userLeadsMap.set(l.owner_id, []);
      userLeadsMap.get(l.owner_id)!.push(l);
    }
    return userProfiles.map((p) => {
      const leads = userLeadsMap.get(p.id) || [];
      let filteredLeads = outreachFilter !== 'all' ? leads.filter((l) => l.outreach_type === outreachFilter) : leads;
      const contacted = filteredLeads.filter((l) => inPeriod(l.conversation_started_at || l.created_at)).length;
      const responded = filteredLeads.filter((l) => RESPONDED_STATUSES.has(l.status) && inPeriod(l.conversation_started_at || l.created_at)).length;
      const calls = filteredLeads.filter((l) => CALL_PROPOSED_STATUSES.has(l.status) && inPeriod(l.conversation_started_at || l.created_at)).length;
      const rdv = filteredLeads.filter((l) => RDV_BOOKED_STATUSES.has(l.status) && inPeriod(l.conversation_started_at || l.created_at)).length;
      const score = contacted * 1 + responded * 3 + calls * 5 + rdv * 10;
      return { ...p, contacted, responded, calls, rdv, score };
    })
      .filter((u) => u.contacted > 0 || u.responded > 0)
      .sort((a, b) => b.score - a.score);
  }, [allLeads, userProfiles, viewMode, dateRange, outreachFilter]);

  const isLoading = profilesLoading || leadsLoading;

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="rounded-md bg-primary/10 p-2">
            <BarChart3 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Analytics Admin</h1>
            <p className="text-sm text-muted-foreground">
              {viewMode === 'global'
                ? 'Vue globale de tous les utilisateurs'
                : selectedProfile
                  ? `Stats de ${selectedProfile.full_name || selectedProfile.email}`
                  : 'Sélectionnez un utilisateur'}
            </p>
          </div>
        </div>

        {/* View mode toggle + Filters */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)} className="w-auto">
              <TabsList>
                <TabsTrigger value="global" className="gap-1.5">
                  <Users className="h-3.5 w-3.5" /> Global
                </TabsTrigger>
                <TabsTrigger value="individual" className="gap-1.5">
                  <User className="h-3.5 w-3.5" /> Individuel
                </TabsTrigger>
              </TabsList>
            </Tabs>
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

          {/* User search for individual mode */}
          {viewMode === 'individual' && (
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher un utilisateur par nom ou email..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {filteredUserList.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-2">Aucun utilisateur trouvé</p>
                  )}
                  {filteredUserList.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedUserId(p.id)}
                      className={`w-full flex items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                        selectedUserId === p.id
                          ? 'bg-primary/10 text-primary font-medium'
                          : 'hover:bg-muted/50 text-foreground'
                      }`}
                    >
                      <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="truncate font-medium">{p.full_name || '—'}</p>
                        <p className="truncate text-xs text-muted-foreground">{p.email}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : viewMode === 'individual' && !selectedUserId ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <User className="h-12 w-12 mb-3 opacity-40" />
            <p className="text-lg font-medium">Sélectionnez un utilisateur</p>
            <p className="text-sm">Recherchez et cliquez sur un utilisateur ci-dessus pour voir ses stats</p>
          </div>
        ) : (
          <>
            {/* KPI Cards */}
            <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
              <KpiCard title="Conversations" value={contactedCount} icon={<MessageSquare className="h-4 w-4" />} />
              <KpiCard title="Réponses" value={respondedCount} icon={<PhoneCall className="h-4 w-4" />} />
              <KpiCard title="Appels proposés" value={callProposedCount} icon={<PhoneCall className="h-4 w-4" />} />
              <KpiCard title="RDV bookés" value={rdvBookedCount} icon={<CalendarCheck className="h-4 w-4" />} />
            </div>
            <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
              <KpiCard title="Follow-ups actifs" value={followUpCount} icon={<Clock className="h-4 w-4" />} />
              <KpiCard title="Perdus" value={lostCount} icon={<XCircle className="h-4 w-4" />} />
              <KpiCard title="Non qualifiés" value={unqualifiedCount} icon={<Ban className="h-4 w-4" />} />
              <KpiCard title="CA total" value={`${totalRevenue.toLocaleString('fr-FR')} €`} subtitle={`${totalClients} client${totalClients !== 1 ? 's' : ''}`} icon={<DollarSign className="h-4 w-4" />} />
            </div>

            {/* Conversion Rates + Funnel */}
            <div className="grid gap-4 lg:grid-cols-2">
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
                    closedWon={closedWonCount}
                  />
                  <MiniFunnel
                    conversations={contactedCount}
                    responses={respondedCount}
                    callsProposed={callProposedCount}
                    meetingsBooked={rdvBookedCount}
                    closedWon={closedWonCount}
                  />
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Funnel global</CardTitle>
                </CardHeader>
                <CardContent>
                  <FunnelChart data={funnelData} />
                </CardContent>
              </Card>
            </div>

            {/* Outreach comparison */}
            {outreachStats.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Video className="h-4 w-4 text-primary" />
                    Performance par format d'approche
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 sm:grid-cols-3">
                    {outreachStats.map((s) => (
                      <div key={s.type} className="rounded-lg border p-3 space-y-2">
                        <p className="text-sm font-medium text-foreground">{s.label}</p>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div><span className="text-muted-foreground">Conversations</span><p className="font-medium text-foreground">{s.contacted}</p></div>
                          <div><span className="text-muted-foreground">Réponses</span><p className="font-medium text-foreground">{s.responded}</p></div>
                          <div><span className="text-muted-foreground">RDV</span><p className="font-medium text-foreground">{s.rdv}</p></div>
                        </div>
                        <div className="flex gap-3 pt-1 border-t text-xs">
                          <div><span className="text-muted-foreground">Taux rép.</span><p className="font-semibold text-primary">{s.respRate}</p></div>
                          <div><span className="text-muted-foreground">Taux booking</span><p className="font-semibold text-primary">{s.bookingRate}</p></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Loss + Disqualification Reasons */}
            <div className="grid gap-4 lg:grid-cols-2">
              {lossReasonStats.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <XCircle className="h-4 w-4 text-destructive" /> Raisons de perte
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {lossReasonStats.map((r) => (
                        <div key={r.reason} className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">{r.label}</span>
                          <Badge variant="secondary">{r.count}</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
              {disqualReasonStats.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Ban className="h-4 w-4 text-muted-foreground" /> Raisons de disqualification
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {disqualReasonStats.map((r) => (
                        <div key={r.reason} className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">{r.label}</span>
                          <Badge variant="secondary">{r.count}</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Ranking table (global mode) */}
            {viewMode === 'global' && ranking.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" /> Classement des utilisateurs
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">#</TableHead>
                        <TableHead>Utilisateur</TableHead>
                        <TableHead className="text-right">Conversations</TableHead>
                        <TableHead className="text-right">Réponses</TableHead>
                        <TableHead className="text-right">Appels</TableHead>
                        <TableHead className="text-right">RDV</TableHead>
                        <TableHead className="text-right">Taux rép.</TableHead>
                        <TableHead className="text-right">Score</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ranking.map((u, i) => (
                        <TableRow
                          key={u.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => {
                            setViewMode('individual');
                            setSelectedUserId(u.id);
                          }}
                        >
                          <TableCell className="font-medium text-muted-foreground">{i + 1}</TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium text-foreground">{u.full_name || '—'}</p>
                              <p className="text-xs text-muted-foreground">{u.email}</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">{u.contacted}</TableCell>
                          <TableCell className="text-right">{u.responded}</TableCell>
                          <TableCell className="text-right">{u.calls}</TableCell>
                          <TableCell className="text-right">{u.rdv}</TableCell>
                          <TableCell className="text-right">{pct(u.responded, u.contacted)}</TableCell>
                          <TableCell className="text-right font-bold text-primary">{u.score}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
