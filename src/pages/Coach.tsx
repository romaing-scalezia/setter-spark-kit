import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/AppLayout';
import { KpiCard } from '@/components/KpiCard';
import { FunnelChart } from '@/components/FunnelChart';
import { StatusBadge } from '@/components/StatusBadge';
import { DateRangeFilter, getDefaultDateRange, type DateRange } from '@/components/DateRangeFilter';
import { PersonaDetailView, type Persona, type UserPersona } from '@/pages/Personas';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Users, ArrowLeft, MessageSquare, PhoneCall, CalendarCheck, AlertTriangle,
  Clock, Search, TrendingDown, TrendingUp, Plus, DollarSign
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate, useParams } from 'react-router-dom';
import { format, isBefore, isWithinInterval, startOfDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import type { Lead, LeadStatus, Profile, CoachingContent, ContentType } from '@/lib/constants';
import { STATUS_CONFIG, LOSS_REASONS, DISQUALIFICATION_REASONS, CONTENT_TYPE_LABELS, type LossReason, type DisqualificationReason } from '@/lib/constants';
import { getCoachStudentAlerts, type CoachStudentAlert, type CoachAlertSeverity } from '@/lib/leadScoring';

// ─── Coach Dashboard (top-level) ─────────────────────────
function CoachDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [dateRange, setDateRange] = useState<DateRange>(getDefaultDateRange);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('active');
  const [assignOpen, setAssignOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: assignments = [] } = useQuery({
    queryKey: ['coach-assignments', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('coach_assignments').select('*').eq('coach_id', user!.id);
      return data || [];
    },
    enabled: !!user,
  });

  const updateStudentStatus = useMutation({
    mutationFn: async ({ assignmentId, status }: { assignmentId: string; status: string }) => {
      const { error } = await supabase.from('coach_assignments').update({ student_status: status }).eq('id', assignmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coach-assignments'] });
      toast({ title: 'Statut élève mis à jour' });
    },
    onError: (err: any) => toast({ variant: 'destructive', title: 'Erreur', description: err.message }),
  });

  const { data: unassignedUsers = [] } = useQuery({
    queryKey: ['unassigned-users'],
    queryFn: async () => {
      const { data } = await (supabase as any).rpc('get_unassigned_users');
      return (data || []) as { id: string; full_name: string | null; email: string | null }[];
    },
    enabled: assignOpen,
  });

  const assignStudent = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await (supabase as any).from('coach_assignments').insert({
        coach_id: user!.id,
        user_id: userId,
        student_status: 'active',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coach-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['unassigned-users'] });
      toast({ title: 'Élève assigné avec succès' });
    },
    onError: (err: any) => toast({ variant: 'destructive', title: 'Erreur', description: err.message }),
  });

  const filteredAssignments = assignments.filter((a) =>
    statusFilter === 'all' ? true : (a as any).student_status === statusFilter
  );
  const studentIds = filteredAssignments.map((a) => a.user_id);

  const { data: profiles = [] } = useQuery({
    queryKey: ['coach-student-profiles', studentIds],
    queryFn: async () => {
      if (studentIds.length === 0) return [];
      const { data } = await supabase.from('profiles').select('*').in('id', studentIds);
      return (data || []) as Profile[];
    },
    enabled: studentIds.length > 0,
  });

  const { data: allLeads = [] } = useQuery({
    queryKey: ['coach-all-leads', studentIds],
    queryFn: async () => {
      if (studentIds.length === 0) return [];
      const { data } = await supabase.from('leads').select('*').in('owner_id', studentIds);
      return (data || []) as Lead[];
    },
    enabled: studentIds.length > 0,
  });

  const { data: allDeals = [] } = useQuery({
    queryKey: ['coach-all-deals', studentIds],
    queryFn: async () => {
      if (studentIds.length === 0) return [];
      const { data } = await supabase.from('deals').select('*').in('owner_id', studentIds);
      return (data || []) as any[];
    },
    enabled: studentIds.length > 0,
  });

  const { data: allUserPersonas = [] } = useQuery({
    queryKey: ['coach-all-user-personas', studentIds],
    queryFn: async () => {
      if (studentIds.length === 0) return [];
      const { data } = await supabase.from('user_personas').select('*').in('user_id', studentIds).eq('is_primary', true);
      return (data || []) as UserPersona[];
    },
    enabled: studentIds.length > 0,
  });

  const primaryPersonaIds = [...new Set(allUserPersonas.map((up) => up.persona_id))];
  const { data: allPersonas = [] } = useQuery({
    queryKey: ['coach-personas', primaryPersonaIds],
    queryFn: async () => {
      if (primaryPersonaIds.length === 0) return [];
      const { data } = await supabase.from('personas').select('*').in('id', primaryPersonaIds);
      return (data || []) as Persona[];
    },
    enabled: primaryPersonaIds.length > 0,
  });

  const inPeriod = (value?: string | null) => {
    if (!value) return false;
    try { return isWithinInterval(new Date(value), dateRange); } catch { return false; }
  };

  const totalContacted = allLeads.filter((l) => inPeriod(l.conversation_started_at || l.created_at)).length;
  const totalResponses = allLeads.filter((l) => inPeriod(l.first_response_at)).length;
  const totalCalls = allLeads.filter((l) => inPeriod(l.call_proposed_at)).length;
  const totalRdv = allLeads.filter((l) => inPeriod(l.meeting_booked_at)).length;
  const responseRate = totalContacted > 0 ? Math.round((totalResponses / totalContacted) * 100) : 0;
  const totalCA = allDeals.filter((d) => d.status === 'won' && inPeriod(d.created_at)).reduce((s, d) => s + Number(d.amount), 0);

  const funnelData: Record<LeadStatus, number> = {
    conversation_engagee: totalContacted,
    en_cours: totalResponses,
    appel_propose: totalCalls,
    follow_up: allLeads.filter((l) => l.status === 'follow_up' && l.follow_up_date && inPeriod(l.follow_up_date)).length,
    rendez_vous_booke: totalRdv,
    ferme_perdu: allLeads.filter((l) => inPeriod(l.closed_lost_at)).length,
    non_qualifie: allLeads.filter((l) => inPeriod(l.unqualified_at)).length,
  };

  const studentStats = useMemo(() => {
    return profiles.map((p) => {
      const leads = allLeads.filter((l) => l.owner_id === p.id);
      const contacted = leads.filter((l) => inPeriod(l.conversation_started_at || l.created_at)).length;
      const responded = leads.filter((l) => inPeriod(l.first_response_at)).length;
      const calls = leads.filter((l) => inPeriod(l.call_proposed_at)).length;
      const rdv = leads.filter((l) => inPeriod(l.meeting_booked_at)).length;
      const lost = leads.filter((l) => inPeriod(l.closed_lost_at)).length;
      const unqualified = leads.filter((l) => inPeriod(l.unqualified_at)).length;
      const followUpOverdue = leads.filter(
        (l) => l.status === 'follow_up' && l.follow_up_date && isBefore(new Date(l.follow_up_date), startOfDay(new Date()))
      ).length;
      const respRate = contacted > 0 ? Math.round((responded / contacted) * 100) : 0;
      const bookRate = calls > 0 ? Math.round((rdv / calls) * 100) : 0;
      const studentDeals = allDeals.filter((d) => d.owner_id === p.id && d.status === 'won');
      const ca = studentDeals.reduce((s, d) => s + Number(d.amount), 0);

      const coachAlerts = getCoachStudentAlerts({
        contacted, respRate, calls, rdv, bookRate, followUpOverdue,
        lost, unqualified, totalLeads: leads.length,
      });

      const assignment = assignments.find((a) => a.user_id === p.id);
      const studentStatus = (assignment as any)?.student_status || 'active';
      const userPersona = allUserPersonas.find((up) => up.user_id === p.id);
      const personaName = userPersona ? allPersonas.find((pp) => pp.id === userPersona.persona_id)?.name || null : null;

      return { ...p, contacted, responded, calls, rdv, respRate, bookRate, followUpOverdue, coachAlerts, studentStatus, ca, personaName };
    });
  }, [profiles, allLeads, dateRange, assignments, allDeals, allUserPersonas, allPersonas]);

  const visibleStudents = studentStats.filter((s) => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (s.full_name || '').toLowerCase().includes(q) || (s.email || '').toLowerCase().includes(q);
  });

  const sortedStudents = [...visibleStudents].sort((a, b) => {
    if (a.coachAlerts.length > 0 && b.coachAlerts.length === 0) return -1;
    if (a.coachAlerts.length === 0 && b.coachAlerts.length > 0) return 1;
    return b.rdv - a.rdv || b.contacted - a.contacted;
  });

  const alertCount = studentStats.filter((s) => s.coachAlerts.length > 0).length;
  const highAlertCount = studentStats.filter((s) => s.coachAlerts.some((a) => a.severity === 'high')).length;

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="rounded-md bg-primary/10 p-2"><Users className="h-5 w-5 text-primary" /></div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tableau de bord Coach</h1>
          <p className="text-sm text-muted-foreground">{profiles.length} élève{profiles.length > 1 ? 's' : ''} assigné{profiles.length > 1 ? 's' : ''}</p>
        </div>
      </div>

      <DateRangeFilter value={dateRange} onChange={setDateRange} />

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-7">
        <KpiCard title="Élèves" value={profiles.length} icon={<Users className="h-4 w-4" />} />
        <KpiCard title="Conversations" value={totalContacted} icon={<MessageSquare className="h-4 w-4" />} />
        <KpiCard title="Taux réponse" value={`${responseRate}%`} subtitle={`${totalResponses} rép.`} icon={<PhoneCall className="h-4 w-4" />} />
        <KpiCard title="Appels" value={totalCalls} icon={<PhoneCall className="h-4 w-4" />} />
        <KpiCard title="RDV" value={totalRdv} icon={<CalendarCheck className="h-4 w-4" />} />
        <KpiCard title="Alertes" value={alertCount} icon={<AlertTriangle className="h-4 w-4" />} />
        <KpiCard title="CA période" value={`${totalCA.toLocaleString('fr-FR')}€`} icon={<DollarSign className="h-4 w-4" />} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Funnel global élèves</CardTitle></CardHeader>
          <CardContent><FunnelChart data={funnelData} /></CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            Élèves à surveiller
          </CardTitle></CardHeader>
          <CardContent>
            {alertCount === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Aucune alerte 🎉</p>
            ) : (
              <div className="space-y-3">
                {sortedStudents.filter((s) => s.coachAlerts.length > 0).slice(0, 5).map((s) => {
                  const maxSev = s.coachAlerts[0]?.severity || 'low';
                  const borderColor = maxSev === 'high' ? 'border-destructive/30 bg-destructive/5 hover:bg-destructive/10' : maxSev === 'medium' ? 'border-amber-300/50 bg-amber-50/50 hover:bg-amber-50' : 'border-border hover:bg-muted/50';
                  return (
                  <div
                    key={s.id}
                    className={`flex items-center justify-between rounded-md border p-3 cursor-pointer transition-colors ${borderColor}`}
                    onClick={() => navigate(`/coach/students/${s.id}`)}
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">{s.full_name || s.email}</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {s.coachAlerts.map((a) => (
                          <span key={a.key} className={`text-xs rounded px-1.5 py-0.5 ${
                            a.severity === 'high' ? 'bg-destructive/10 text-destructive' :
                            a.severity === 'medium' ? 'bg-amber-100 text-amber-800' :
                            'bg-muted text-muted-foreground'
                          }`}>{a.label}</span>
                        ))}
                      </div>
                    </div>
                    <TrendingDown className={`h-4 w-4 shrink-0 ${s.coachAlerts[0]?.severity === 'high' ? 'text-destructive' : 'text-amber-500'}`} />
                  </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <CardTitle className="text-base">Mes élèves</CardTitle>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setAssignOpen(true)}>
                <Plus className="h-4 w-4 mr-1" /> Assigner un élève
              </Button>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Rechercher..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9 w-[200px]" />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Actifs</SelectItem>
                  <SelectItem value="paused">En pause</SelectItem>
                  <SelectItem value="former">Anciens</SelectItem>
                  <SelectItem value="all">Tous</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {profiles.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Aucun élève assigné.</p>
          ) : sortedStudents.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Aucun résultat</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Élève</TableHead>
                  <TableHead className="text-center">Conv.</TableHead>
                  <TableHead className="text-center">Rép. %</TableHead>
                  <TableHead className="text-center">Appels</TableHead>
                  <TableHead className="text-center">RDV</TableHead>
                  <TableHead className="text-center hidden sm:table-cell">CA</TableHead>
                   <TableHead className="text-center hidden sm:table-cell">FU retard</TableHead>
                   <TableHead className="hidden lg:table-cell">Cible</TableHead>
                   <TableHead className="text-center">Statut</TableHead>
                 </TableRow>
               </TableHeader>
               <TableBody>
                 {sortedStudents.map((s) => (
                   <TableRow key={s.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/coach/students/${s.id}`)}>
                     <TableCell>
                       <div className="flex items-center gap-2">
                         {s.coachAlerts.length > 0 && <span className={`h-2 w-2 rounded-full shrink-0 ${s.coachAlerts[0]?.severity === 'high' ? 'bg-destructive' : 'bg-amber-500'}`} />}
                         <span className="font-medium">{s.full_name || s.email}</span>
                       </div>
                     </TableCell>
                    <TableCell className="text-center">{s.contacted}</TableCell>
                    <TableCell className="text-center">
                      <span className={s.respRate < 20 && s.contacted >= 5 ? 'text-destructive font-medium' : ''}>{s.respRate}%</span>
                    </TableCell>
                    <TableCell className="text-center">{s.calls}</TableCell>
                    <TableCell className="text-center font-medium">{s.rdv}</TableCell>
                    <TableCell className="text-center hidden sm:table-cell">{s.ca > 0 ? `${s.ca.toLocaleString('fr-FR')}€` : '—'}</TableCell>
                     <TableCell className="text-center hidden sm:table-cell">
                       {s.followUpOverdue > 0 ? <span className="text-destructive font-medium">{s.followUpOverdue}</span> : '0'}
                     </TableCell>
                     <TableCell className="hidden lg:table-cell">
                       {s.personaName ? <Badge variant="outline" className="text-xs">{s.personaName}</Badge> : <span className="text-xs text-muted-foreground">—</span>}
                     </TableCell>
                     <TableCell className="text-center">
                       <Select
                         value={s.studentStatus}
                         onValueChange={(val) => {
                           const assignment = assignments.find((a) => a.user_id === s.id);
                           if (assignment) updateStudentStatus.mutate({ assignmentId: assignment.id, status: val });
                         }}
                       >
                         <SelectTrigger className="h-7 w-[100px] text-xs" onClick={(e) => e.stopPropagation()}>
                           <SelectValue />
                         </SelectTrigger>
                         <SelectContent>
                           <SelectItem value="active">Actif</SelectItem>
                           <SelectItem value="paused">En pause</SelectItem>
                           <SelectItem value="former">Ancien</SelectItem>
                         </SelectContent>
                       </Select>
                     </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Modal assignation élève */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assigner un élève</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {unassignedUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Aucun utilisateur disponible</p>
            ) : (
              unassignedUsers.map((u) => (
                <div key={u.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
                  <div>
                    <p className="text-sm font-medium">{u.full_name || '—'}</p>
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                  </div>
                  <Button
                    size="sm"
                    disabled={assignStudent.isPending}
                    onClick={() => assignStudent.mutate(u.id)}
                  >
                    Assigner
                  </Button>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Student Drilldown ───────────────────────────────────
function CoachStudentDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dateRange, setDateRange] = useState<DateRange>(getDefaultDateRange);
  const [createContentOpen, setCreateContentOpen] = useState(false);
  const [formType, setFormType] = useState<ContentType>('script');
  const [formTitle, setFormTitle] = useState('');
  const [formBody, setFormBody] = useState('');
  const [formGlobal, setFormGlobal] = useState(false);

  const { data: assignment } = useQuery({
    queryKey: ['student-assignment', user?.id, id],
    queryFn: async () => {
      const { data } = await supabase.from('coach_assignments').select('*').eq('coach_id', user!.id).eq('user_id', id!).maybeSingle();
      return data;
    },
    enabled: !!user && !!id,
  });

  const updateStudentStatus = useMutation({
    mutationFn: async (status: string) => {
      if (!assignment) return;
      const { error } = await supabase.from('coach_assignments').update({ student_status: status }).eq('id', assignment.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-assignment'] });
      queryClient.invalidateQueries({ queryKey: ['coach-assignments'] });
      toast({ title: 'Statut élève mis à jour' });
    },
    onError: (err: any) => toast({ variant: 'destructive', title: 'Erreur', description: err.message }),
  });

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['student-profile', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', id!).single();
      if (error) throw error;
      return data as Profile;
    },
    enabled: !!id,
  });

  const { data: leads = [] } = useQuery({
    queryKey: ['student-leads', id],
    queryFn: async () => {
      const { data } = await supabase.from('leads').select('*').eq('owner_id', id!).order('created_at', { ascending: false });
      return (data || []) as Lead[];
    },
    enabled: !!id,
  });

  const { data: deals = [] } = useQuery({
    queryKey: ['student-deals', id],
    queryFn: async () => {
      const { data } = await supabase.from('deals').select('*').eq('owner_id', id!);
      return (data || []) as any[];
    },
    enabled: !!id,
  });

  const { data: contents = [] } = useQuery({
    queryKey: ['student-contents', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('coaching_contents')
        .select('*')
        .or(`target_user_id.eq.${id},and(created_by.eq.${user!.id},target_user_id.is.null),is_global.eq.true`)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as CoachingContent[];
    },
    enabled: !!id && !!user,
  });

  const { data: studentPersonas = [] } = useQuery({
    queryKey: ['student-personas', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('user_personas').select('*').eq('user_id', id!);
      if (error) throw error;
      return (data || []) as UserPersona[];
    },
    enabled: !!id,
  });

  const personaIds = studentPersonas.map((sp) => sp.persona_id);
  const { data: personasList = [] } = useQuery({
    queryKey: ['student-personas-details', personaIds],
    queryFn: async () => {
      if (personaIds.length === 0) return [];
      const { data, error } = await supabase.from('personas').select('*').in('id', personaIds);
      if (error) throw error;
      return (data || []) as Persona[];
    },
    enabled: personaIds.length > 0,
  });

  const createContent = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('coaching_contents').insert({
        type: formType,
        title: formTitle,
        body: formBody,
        is_global: formGlobal,
        target_user_id: formGlobal ? null : id,
        owner_id: user!.id,
        created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-contents'] });
      setCreateContentOpen(false);
      setFormTitle('');
      setFormBody('');
      toast({ title: 'Contenu créé' });
    },
    onError: (err: any) => {
      toast({ variant: 'destructive', title: 'Erreur', description: err.message });
    },
  });

  const inPeriod = (value?: string | null) => {
    if (!value) return false;
    try { return isWithinInterval(new Date(value), dateRange); } catch { return false; }
  };

  if (profileLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const periodLeads = leads.filter((l) => inPeriod(l.conversation_started_at || l.created_at));
  const respondedCount = leads.filter((l) => inPeriod(l.first_response_at)).length;
  const callsCount = leads.filter((l) => inPeriod(l.call_proposed_at)).length;
  const rdvCount = leads.filter((l) => inPeriod(l.meeting_booked_at)).length;
  const lostLeads = leads.filter((l) => inPeriod(l.closed_lost_at));
  const unqualifiedLeads = leads.filter((l) => inPeriod(l.unqualified_at));
  const responseRate = periodLeads.length > 0 ? Math.round(respondedCount / periodLeads.length * 100) : 0;
  const bookingRate = callsCount > 0 ? Math.round(rdvCount / callsCount * 100) : 0;
  const studentCA = deals.filter((d) => d.status === 'won').reduce((s, d) => s + Number(d.amount), 0);

  const followUps = leads.filter((l) => l.status === 'follow_up' && l.follow_up_date);
  const overdueFollowUps = followUps.filter((l) => isBefore(new Date(l.follow_up_date!), startOfDay(new Date())));

  const funnelData: Record<LeadStatus, number> = {
    conversation_engagee: periodLeads.length,
    en_cours: respondedCount,
    appel_propose: callsCount,
    follow_up: leads.filter((l) => l.status === 'follow_up' && l.follow_up_date && inPeriod(l.follow_up_date)).length,
    rendez_vous_booke: rdvCount,
    ferme_perdu: lostLeads.length,
    non_qualifie: unqualifiedLeads.length,
  };

  const lossReasons = lostLeads.reduce((acc, l) => {
    const label = l.reason_detail || (l.loss_reason ? LOSS_REASONS[l.loss_reason as LossReason] : 'Non renseignée');
    acc[label] = (acc[label] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const disqualReasons = unqualifiedLeads.reduce((acc, l) => {
    const label = l.reason_detail || (l.disqualification_reason ? DISQUALIFICATION_REASONS[l.disqualification_reason as DisqualificationReason] : 'Non renseignée');
    acc[label] = (acc[label] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const assignedContents = contents.filter((c) => c.target_user_id === id);
  const globalContents = contents.filter((c) => c.is_global);

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/coach')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">{profile?.full_name || 'Élève'}</h1>
          <p className="text-sm text-muted-foreground">{profile?.email}</p>
        </div>
        {assignment && (
          <Select value={(assignment as any).student_status || 'active'} onValueChange={(val) => updateStudentStatus.mutate(val)}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Actif</SelectItem>
              <SelectItem value="paused">En pause</SelectItem>
              <SelectItem value="former">Ancien</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>

      <DateRangeFilter value={dateRange} onChange={setDateRange} />

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-7">
        <KpiCard title="Conversations" value={periodLeads.length} icon={<MessageSquare className="h-4 w-4" />} />
        <KpiCard title="Taux réponse" value={`${responseRate}%`} icon={<PhoneCall className="h-4 w-4" />} />
        <KpiCard title="Appels" value={callsCount} icon={<PhoneCall className="h-4 w-4" />} />
        <KpiCard title="RDV" value={rdvCount} icon={<CalendarCheck className="h-4 w-4" />} />
        <KpiCard title="Taux booking" value={`${bookingRate}%`} icon={<TrendingUp className="h-4 w-4" />} />
        <KpiCard title="FU retard" value={overdueFollowUps.length} icon={<Clock className="h-4 w-4" />} />
        <KpiCard title="CA" value={`${studentCA.toLocaleString('fr-FR')}€`} icon={<DollarSign className="h-4 w-4" />} />
      </div>

      <Tabs defaultValue="leads">
        <TabsList className="flex-wrap">
          <TabsTrigger value="leads">Leads ({leads.length})</TabsTrigger>
          <TabsTrigger value="funnel">Funnel</TabsTrigger>
          <TabsTrigger value="pertes">Pertes</TabsTrigger>
          <TabsTrigger value="followups">Follow-ups ({followUps.length})</TabsTrigger>
          <TabsTrigger value="coaching">Coaching ({contents.length})</TabsTrigger>
          <TabsTrigger value="persona">Cible</TabsTrigger>
        </TabsList>

        <TabsContent value="leads" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              {leads.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Aucun lead</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nom</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead className="hidden sm:table-cell">Entreprise</TableHead>
                      <TableHead className="hidden sm:table-cell">Relance</TableHead>
                      <TableHead className="hidden sm:table-cell">Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leads.map((lead) => (
                      <TableRow key={lead.id}>
                        <TableCell className="font-medium">{lead.first_name} {lead.last_name}</TableCell>
                        <TableCell><StatusBadge status={lead.status} /></TableCell>
                        <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">{lead.company_name || '—'}</TableCell>
                        <TableCell className="hidden sm:table-cell text-xs">
                          {lead.follow_up_date && lead.status === 'follow_up' && (
                            <span className={isBefore(new Date(lead.follow_up_date), startOfDay(new Date())) ? 'text-destructive font-medium' : 'text-muted-foreground'}>
                              {format(new Date(lead.follow_up_date), 'dd/MM', { locale: fr })}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">{format(new Date(lead.created_at), 'dd/MM/yy')}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="funnel" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Funnel (période)</CardTitle></CardHeader>
            <CardContent><FunnelChart data={funnelData} /></CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pertes" className="mt-4 space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Raisons de perte ({lostLeads.length})</CardTitle></CardHeader>
            <CardContent>
              {Object.keys(lossReasons).length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune perte</p>
              ) : (
                <div className="space-y-2">
                  {Object.entries(lossReasons).sort((a, b) => b[1] - a[1]).map(([reason, count]) => (
                    <div key={reason} className="flex items-center justify-between rounded-md border p-3">
                      <span className="text-sm">{reason}</span>
                      <span className="font-medium text-sm">{count}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Disqualifications ({unqualifiedLeads.length})</CardTitle></CardHeader>
            <CardContent>
              {Object.keys(disqualReasons).length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune disqualification</p>
              ) : (
                <div className="space-y-2">
                  {Object.entries(disqualReasons).sort((a, b) => b[1] - a[1]).map(([reason, count]) => (
                    <div key={reason} className="flex items-center justify-between rounded-md border p-3">
                      <span className="text-sm">{reason}</span>
                      <span className="font-medium text-sm">{count}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="followups" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              {followUps.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Aucun follow-up</p>
              ) : (
                <div className="space-y-2">
                  {followUps.sort((a, b) => new Date(a.follow_up_date!).getTime() - new Date(b.follow_up_date!).getTime()).map((lead) => {
                    const d = new Date(lead.follow_up_date!);
                    const overdue = isBefore(d, startOfDay(new Date()));
                    return (
                      <div key={lead.id} className="flex items-center justify-between rounded-md border p-3">
                        <div>
                          <p className="text-sm font-medium">{lead.first_name} {lead.last_name}</p>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {format(d, 'dd MMMM yyyy', { locale: fr })}
                          </div>
                        </div>
                        {overdue && <span className="text-xs font-medium text-destructive">En retard</span>}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="coaching" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setCreateContentOpen(true)} size="sm">
              <Plus className="h-4 w-4 mr-1" /> Ajouter du contenu
            </Button>
          </div>

          {assignedContents.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Contenu personnalisé ({assignedContents.length})</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {assignedContents.map((c) => (
                  <div key={c.id} className="rounded-md border p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="secondary" className="text-xs">{CONTENT_TYPE_LABELS[c.type]}</Badge>
                    </div>
                    <p className="text-sm font-medium">{c.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{c.body}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {globalContents.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Contenu global ({globalContents.length})</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {globalContents.map((c) => (
                  <div key={c.id} className="rounded-md border p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="secondary" className="text-xs">{CONTENT_TYPE_LABELS[c.type]}</Badge>
                      <Badge variant="outline" className="text-xs">Global</Badge>
                    </div>
                    <p className="text-sm font-medium">{c.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{c.body}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {assignedContents.length === 0 && globalContents.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">Aucun contenu de coaching</p>
          )}
        </TabsContent>

        <TabsContent value="persona" className="mt-4 space-y-4">
          {personasList.length === 0 ? (
            <Card>
              <CardContent className="py-8">
                <p className="text-sm text-muted-foreground text-center">Aucune cible assignée à cet élève</p>
                <p className="text-xs text-muted-foreground text-center mt-1">
                  Allez dans <span className="font-medium">Personas</span> pour créer et assigner une cible.
                </p>
              </CardContent>
            </Card>
          ) : (
            personasList.map((persona) => {
              const up = studentPersonas.find((sp) => sp.persona_id === persona.id);
              return (
                <Card key={persona.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base">{persona.name}</CardTitle>
                      {up?.is_primary && <Badge variant="default" className="text-xs">Principale</Badge>}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <PersonaDetailView persona={persona} />
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>
      </Tabs>

      {/* Create content modal */}
      <Dialog open={createContentOpen} onOpenChange={setCreateContentOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Ajouter du contenu pour {profile?.full_name || 'cet élève'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={formType} onValueChange={(v) => setFormType(v as ContentType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CONTENT_TYPE_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Titre</Label>
              <Input value={formTitle} onChange={(e) => setFormTitle(e.target.value)} placeholder="Ex: Script premier message" />
            </div>
            <div className="space-y-2">
              <Label>Contenu</Label>
              <Textarea value={formBody} onChange={(e) => setFormBody(e.target.value)} rows={6} />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="global-content" checked={formGlobal} onChange={(e) => setFormGlobal(e.target.checked)} className="rounded" />
              <Label htmlFor="global-content" className="text-sm">Rendre global (visible par tous les élèves)</Label>
            </div>
            <Button onClick={() => createContent.mutate()} disabled={!formTitle || !formBody || createContent.isPending} className="w-full">
              Créer
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function CoachPage() {
  return (
    <AppLayout>
      <CoachDashboard />
    </AppLayout>
  );
}

export function CoachStudentPage() {
  return (
    <AppLayout>
      <CoachStudentDetail />
    </AppLayout>
  );
}
