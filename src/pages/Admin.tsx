import { useState, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import {
  Shield, Users, Loader2, Trash2, Plus, UserPlus, Search,
  Eye, Linkedin, AlertTriangle, TrendingUp, Clock, CheckCircle2,
  Sparkles, CalendarPlus, X, BookOpen, Tag, Edit2, Gauge,
} from 'lucide-react';
import type { AppRole } from '@/lib/constants';
import { format, differenceInDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useAuth } from '@/contexts/AuthContext';

interface Membership {
  plan: string;
  status: string;
  current_period_end: string | null;
  trial_days_left: number | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  is_paid: boolean;
  mrr_cents: number;
  currency: string | null;
  interval: string | null;
  cancel_at_period_end: boolean;
}

interface EnrichedUser {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: AppRole;
  source: string | null;
  business_type: string | null;
  onboarding_completed: boolean;
  provider: string;
  providers: string[];
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  debug_role_switch_enabled: boolean;
  membership: Membership | null;
  linkedin_connected: boolean;
  has_sales_nav: boolean;
  leads_count: number;
  campaigns: { active: number; paused: number; completed: number };
  sales_nav_import: { count: number; quota: number; reset_at: string | null };
  coach_of: string[];
  coached_by: string[];
}

interface FailedJob {
  id: string;
  status: string;
  error_message: string | null;
  created_at: string;
}

const ROLE_OPTIONS: AppRole[] = ['user', 'coach', 'admin'];

const planLabel = (plan: string) => ({ free: 'Free', starter: 'Starter', pro: 'Pro', coach: 'Coach' }[plan] ?? plan);
const planStyle = (plan: string, status: string) => {
  if (status === 'trialing') return 'bg-primary/10 text-primary border-primary/20';
  if (plan === 'starter' || plan === 'pro') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  return 'bg-muted text-muted-foreground border-border';
};

const fmt = (d: string | null) => {
  if (!d) return '—';
  try { return format(new Date(d), 'dd MMM yy', { locale: fr }); } catch { return '—'; }
};

const fmtFull = (d: string | null) => {
  if (!d) return '—';
  try { return format(new Date(d), 'dd MMM yyyy HH:mm', { locale: fr }); } catch { return '—'; }
};

export default function AdminPage() {
  const { session, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [planFilter, setPlanFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [linkedinFilter, setLinkedinFilter] = useState('all');
  const [selectedUser, setSelectedUser] = useState<EnrichedUser | null>(null);
  const [deleteUser, setDeleteUser] = useState<EnrichedUser | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<AppRole>('user');
  const [extendDays, setExtendDays] = useState('14');
  const [quotaInput, setQuotaInput] = useState('');
  const [extendingUser, setExtendingUser] = useState<EnrichedUser | null>(null);
  const [selectedCoach, setSelectedCoach] = useState('');
  const [selectedStudent, setSelectedStudent] = useState('');

  // ─── Contenu global state ──────────────────────────────────────────────────
  const [contentTitle, setContentTitle] = useState('');
  const [contentBody, setContentBody] = useState('');
  const [contentType, setContentType] = useState<'script' | 'objection' | 'recommendation' | 'coach_note'>('script');
  const [contentCategory, setContentCategory] = useState('');
  const [editingContent, setEditingContent] = useState<string | null>(null);
  const [personaName, setPersonaName] = useState('');
  const [personaDesc, setPersonaDesc] = useState('');

  const callEdge = async (fn: string, body: object) => {
    const { data, error } = await supabase.functions.invoke(fn, { body });
    if (error) throw new Error(error.message || 'Erreur');
    return data;
  };

  // ─── Queries ───────────────────────────────────────────────────────────────
  const { data: adminData, isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => callEdge('admin-list-users', {}),
  });
  const users: EnrichedUser[] = adminData?.users ?? [];
  const failedJobs: FailedJob[] = adminData?.system?.failed_jobs ?? [];

  const { data: assignments = [] } = useQuery({
    queryKey: ['admin-assignments'],
    queryFn: async () => {
      const { data, error } = await supabase.from('coach_assignments').select('*');
      if (error) throw error;
      return data || [];
    },
  });

  // ─── KPIs ──────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const total = users.length;
    const trialing = users.filter(u => u.membership?.status === 'trialing').length;
    // Exclut le compte de l'admin qui consulte la page : son propre abonnement
    // (perso ou de test) ne doit pas gonfler le nombre de vrais clients payants.
    const revenueUsers = users.filter(u => u.id !== user?.id);
    const paid = revenueUsers.filter(u => u.membership?.is_paid).length;
    // mrr_cents comes straight from the live Stripe subscription amount (Admin edge function),
    // annual plans already normalized to a monthly-equivalent amount.
    const mrr = Math.round(revenueUsers.reduce((sum, u) => sum + (u.membership?.mrr_cents ?? 0), 0)) / 100;
    const linkedinOk = users.filter(u => u.linkedin_connected).length;
    const starterpack = users.filter(u => u.source === 'starterpack').length;
    const newThisWeek = users.filter(u => {
      try { return differenceInDays(new Date(), new Date(u.created_at)) <= 7; } catch { return false; }
    }).length;
    return { total, trialing, paid, mrr, linkedinOk, starterpack, newThisWeek };
  }, [users, user?.id]);

  // ─── Filtered users ────────────────────────────────────────────────────────
  const filtered = useMemo(() => users.filter(u => {
    const q = search.toLowerCase();
    if (q && !u.full_name?.toLowerCase().includes(q) && !u.email?.toLowerCase().includes(q)) return false;
    if (roleFilter !== 'all' && u.role !== roleFilter) return false;
    if (planFilter !== 'all') {
      if (planFilter === 'trialing' && u.membership?.status !== 'trialing') return false;
      if (planFilter !== 'trialing' && u.membership?.plan !== planFilter) return false;
    }
    if (sourceFilter !== 'all' && (sourceFilter === 'starterpack' ? u.source !== 'starterpack' : u.source === 'starterpack')) return false;
    if (linkedinFilter === 'yes' && !u.linkedin_connected) return false;
    if (linkedinFilter === 'no' && u.linkedin_connected) return false;
    return true;
  }), [users, search, roleFilter, planFilter, sourceFilter, linkedinFilter]);

  const getName = (id: string) => {
    const u = users.find(u => u.id === id);
    return u?.full_name || u?.email || id.slice(0, 8);
  };

  // ─── Mutations ─────────────────────────────────────────────────────────────
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    queryClient.invalidateQueries({ queryKey: ['admin-assignments'] });
  };

  const updateRole = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: AppRole }) =>
      supabase.rpc('set_user_role', { _target_user_id: userId, _role: role }).then(({ error }) => { if (error) throw error; }),
    onSuccess: () => { invalidate(); toast({ title: 'Rôle mis à jour' }); },
    onError: (e: Error) => toast({ variant: 'destructive', title: 'Erreur', description: e.message }),
  });

  const forceStarterpack = useMutation({
    mutationFn: (userId: string) =>
      (supabase as any).from('profiles').update({ source: 'starterpack' }).eq('id', userId)
        .then(({ error }: any) => { if (error) throw error; }),
    onSuccess: () => { invalidate(); toast({ title: 'Source mise à jour → starterpack' }); },
    onError: (e: Error) => toast({ variant: 'destructive', title: 'Erreur', description: e.message }),
  });

  const extendTrial = useMutation({
    mutationFn: async ({ userId, days }: { userId: string; days: number }) => {
      const { data: mem, error: fetchErr } = await (supabase as any)
        .from('memberships').select('current_period_start, current_period_end').eq('user_id', userId).maybeSingle();
      if (fetchErr) throw fetchErr;
      const base = mem?.current_period_end ? new Date(mem.current_period_end) : new Date();
      if (base < new Date()) base.setTime(new Date().getTime());
      base.setDate(base.getDate() + days);
      const updatePayload: Record<string, string> = { status: 'trialing', current_period_end: base.toISOString() };
      if (!mem?.current_period_start) updatePayload.current_period_start = new Date().toISOString();
      const { error } = await (supabase as any)
        .from('memberships')
        .update(updatePayload)
        .eq('user_id', userId);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast({ title: `Essai étendu de ${extendDays} jours` }); setExtendingUser(null); },
    onError: (e: Error) => toast({ variant: 'destructive', title: 'Erreur', description: e.message }),
  });

  const setQuotaOverride = useMutation({
    mutationFn: async ({ userId, quota }: { userId: string; quota: number | null }) => {
      const { error } = await (supabase as any)
        .from('memberships')
        .update({ prospects_import_quota_override: quota })
        .eq('user_id', userId);
      if (error) throw error;
    },
    onSuccess: (_data, { quota }) => {
      invalidate();
      setQuotaInput('');
      toast({ title: quota === null ? 'Quota Sales Nav réinitialisé (retour au plan)' : `Quota Sales Nav fixé à ${quota}` });
    },
    onError: (e: Error) => toast({ variant: 'destructive', title: 'Erreur', description: e.message }),
  });

  const deleteUserMut = useMutation({
    mutationFn: (userId: string) => callEdge('admin-delete-user', { user_id: userId }),
    onSuccess: () => { invalidate(); toast({ title: 'Utilisateur supprimé' }); setDeleteUser(null); setSelectedUser(null); },
    onError: (e: Error) => toast({ variant: 'destructive', title: 'Erreur', description: e.message }),
  });

  const createUser = useMutation({
    mutationFn: () => callEdge('admin-create-user', { email: newEmail, password: newPassword, full_name: newName, role: newRole }),
    onSuccess: () => {
      invalidate(); toast({ title: 'Utilisateur créé' });
      setCreateOpen(false); setNewName(''); setNewEmail(''); setNewPassword(''); setNewRole('user');
    },
    onError: (e: Error) => toast({ variant: 'destructive', title: 'Erreur', description: e.message }),
  });

  const addAssignment = useMutation({
    mutationFn: ({ coachId, studentId }: { coachId: string; studentId: string }) =>
      supabase.from('coach_assignments').insert({ coach_id: coachId, user_id: studentId })
        .then(({ error }) => { if (error) throw error; }),
    onSuccess: () => { invalidate(); toast({ title: 'Assignation ajoutée' }); setSelectedStudent(''); },
    onError: (e: Error) => toast({ variant: 'destructive', title: 'Erreur', description: e.message }),
  });

  const removeAssignment = useMutation({
    mutationFn: (id: string) => supabase.from('coach_assignments').delete().eq('id', id)
      .then(({ error }) => { if (error) throw error; }),
    onSuccess: () => { invalidate(); toast({ title: 'Assignation supprimée' }); },
    onError: (e: Error) => toast({ variant: 'destructive', title: 'Erreur', description: e.message }),
  });

  const coaches = users.filter(u => u.role === 'coach' || u.role === 'admin');
  const students = users.filter(u => u.role === 'user');

  // ─── Contenu global queries + mutations ───────────────────────────────────
  const { data: globalContents = [], isLoading: contentsLoading } = useQuery({
    queryKey: ['admin-global-contents'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('coaching_contents')
        .select('*')
        .eq('is_global', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: allPersonas = [], isLoading: personasLoading } = useQuery({
    queryKey: ['admin-personas'],
    queryFn: async () => {
      const { data, error } = await supabase.from('personas').select('*').order('name');
      if (error) throw error;
      return data || [];
    },
  });

  const invalidateContent = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-global-contents'] });
    queryClient.invalidateQueries({ queryKey: ['admin-personas'] });
  };

  const upsertContent = useMutation({
    mutationFn: async () => {
      if (editingContent) {
        const { error } = await supabase.from('coaching_contents').update({
          title: contentTitle, body: contentBody, type: contentType, category: contentCategory || null,
        }).eq('id', editingContent);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('coaching_contents').insert({
          title: contentTitle, body: contentBody, type: contentType,
          category: contentCategory || null, is_global: true, created_by: user?.id,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      invalidateContent();
      toast({ title: editingContent ? 'Contenu mis à jour' : 'Contenu créé' });
      setContentTitle(''); setContentBody(''); setContentCategory(''); setEditingContent(null);
    },
    onError: (e: Error) => toast({ variant: 'destructive', title: 'Erreur', description: e.message }),
  });

  const deleteContent = useMutation({
    mutationFn: (id: string) => supabase.from('coaching_contents').delete().eq('id', id).then(({ error }) => { if (error) throw error; }),
    onSuccess: () => { invalidateContent(); toast({ title: 'Contenu supprimé' }); },
    onError: (e: Error) => toast({ variant: 'destructive', title: 'Erreur', description: e.message }),
  });

  const createPersona = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('personas').insert({
        name: personaName, description: personaDesc || null, created_by: user?.id ?? '',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateContent();
      toast({ title: 'Persona créé' });
      setPersonaName(''); setPersonaDesc('');
    },
    onError: (e: Error) => toast({ variant: 'destructive', title: 'Erreur', description: e.message }),
  });

  const deletePersona = useMutation({
    mutationFn: (id: string) => supabase.from('personas').delete().eq('id', id).then(({ error }) => { if (error) throw error; }),
    onSuccess: () => { invalidateContent(); toast({ title: 'Persona supprimé' }); },
    onError: (e: Error) => toast({ variant: 'destructive', title: 'Erreur', description: e.message }),
  });

  const checkSalesNav = useMutation({
    mutationFn: async () => {
      const { data: { session: s } } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke('check-sales-nav', {
        headers: s ? { Authorization: `Bearer ${s.access_token}` } : undefined,
      });
      if (error) throw error;
      return data as { checked: number; updated: number; errors: number };
    },
    onSuccess: (data) => {
      toast({ title: `Sales Nav vérifié — ${data.updated}/${data.checked} mis à jour${data.errors > 0 ? ` (${data.errors} erreurs)` : ''}` });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (e: Error) => toast({ variant: 'destructive', title: 'Erreur check-sales-nav', description: e.message }),
  });

  const CONTENT_TYPE_LABELS: Record<string, string> = {
    script: 'Script', objection: 'Objection', recommendation: 'Reco', coach_note: 'Note coach',
  };
  const CONTENT_TYPE_STYLES: Record<string, string> = {
    script: 'bg-primary/10 text-primary border-primary/20',
    objection: 'bg-orange-50 text-orange-700 border-orange-200',
    recommendation: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    coach_note: 'bg-muted text-muted-foreground border-border',
  };

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 space-y-6" data-testid="page-admin">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-md bg-primary/10 p-2"><Shield className="h-5 w-5 text-primary" /></div>
            <h1 className="text-2xl font-bold text-foreground">Administration</h1>
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><UserPlus className="h-4 w-4 mr-1.5" /> Créer un utilisateur</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Créer un utilisateur</DialogTitle>
                <DialogDescription>Compte manuel avec email et mot de passe.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2"><Label>Nom complet</Label><Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Jean Dupont" /></div>
                <div className="space-y-2"><Label>Email</Label><Input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="jean@exemple.com" /></div>
                <div className="space-y-2"><Label>Mot de passe</Label><Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="••••••••" /></div>
                <div className="space-y-2">
                  <Label>Rôle</Label>
                  <Select value={newRole} onValueChange={v => setNewRole(v as AppRole)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{ROLE_OPTIONS.map(r => <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <Button className="w-full" onClick={() => createUser.mutate()} disabled={createUser.isPending || !newName || !newEmail || !newPassword}>
                  {createUser.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Créer le compte
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* KPIs */}
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 lg:grid-cols-7">
          {[
            { label: 'Utilisateurs', value: kpis.total, icon: Users, color: 'text-foreground' },
            { label: 'MRR', value: `${kpis.mrr.toLocaleString('fr-FR')} €`, icon: TrendingUp, color: 'text-emerald-600' },
            { label: 'Payants', value: kpis.paid, icon: CheckCircle2, color: 'text-emerald-600' },
            { label: 'En essai', value: kpis.trialing, icon: Clock, color: 'text-primary' },
            { label: 'LinkedIn ✓', value: kpis.linkedinOk, icon: Linkedin, color: 'text-[#0A66C2]' },
            { label: 'Starterpack', value: kpis.starterpack, icon: Sparkles, color: 'text-primary' },
            { label: 'Cette semaine', value: `+${kpis.newThisWeek}`, icon: CalendarPlus, color: 'text-muted-foreground' },
          ].map(({ label, value, icon: Icon, color }) => (
            <Card key={label}>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <Icon className={`h-3.5 w-3.5 ${color}`} />
                </div>
                <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="users">
          <TabsList>
            <TabsTrigger value="users">Utilisateurs</TabsTrigger>
            <TabsTrigger value="assignments">Assignations coaches</TabsTrigger>
            <TabsTrigger value="health" className="flex items-center gap-1.5">
              Santé système
              {failedJobs.length > 0 && (
                <span className="rounded-full bg-destructive text-white text-[10px] font-bold px-1.5 py-0.5 leading-none">{failedJobs.length}</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="content">Contenu global</TabsTrigger>
          </TabsList>

          {/* ── Utilisateurs ───────────────────────────────────────── */}
          <TabsContent value="users" className="mt-4 space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap gap-2">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Nom ou email..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
              </div>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-[130px]"><SelectValue placeholder="Rôle" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous rôles</SelectItem>
                  {ROLE_OPTIONS.map(r => <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={planFilter} onValueChange={setPlanFilter}>
                <SelectTrigger className="w-[140px]"><SelectValue placeholder="Plan" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous plans</SelectItem>
                  <SelectItem value="trialing">En essai</SelectItem>
                  <SelectItem value="free">Free</SelectItem>
                  <SelectItem value="starter">Starter</SelectItem>
                  <SelectItem value="pro">Pro</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sourceFilter} onValueChange={setSourceFilter}>
                <SelectTrigger className="w-[150px]"><SelectValue placeholder="Source" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes sources</SelectItem>
                  <SelectItem value="starterpack">Starterpack</SelectItem>
                  <SelectItem value="organic">Organic</SelectItem>
                </SelectContent>
              </Select>
              <Select value={linkedinFilter} onValueChange={setLinkedinFilter}>
                <SelectTrigger className="w-[150px]"><SelectValue placeholder="LinkedIn" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="yes">LinkedIn connecté</SelectItem>
                  <SelectItem value="no">LinkedIn non connecté</SelectItem>
                </SelectContent>
              </Select>
              {(search || roleFilter !== 'all' || planFilter !== 'all' || sourceFilter !== 'all' || linkedinFilter !== 'all') && (
                <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setRoleFilter('all'); setPlanFilter('all'); setSourceFilter('all'); setLinkedinFilter('all'); }}>
                  <X className="h-4 w-4 mr-1" /> Réinitialiser
                </Button>
              )}
            </div>

            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {filtered.length} utilisateur{filtered.length !== 1 ? 's' : ''}
                  {filtered.length !== users.length && ` sur ${users.length}`}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Utilisateur</TableHead>
                          <TableHead>Rôle</TableHead>
                          <TableHead>Plan</TableHead>
                          <TableHead>Source</TableHead>
                          <TableHead>LinkedIn</TableHead>
                          <TableHead>Sales Nav</TableHead>
                          <TableHead className="text-right">Leads</TableHead>
                          <TableHead>Inscription</TableHead>
                          <TableHead>Dernière co.</TableHead>
                          <TableHead className="w-[80px]" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filtered.map(u => (
                          <TableRow key={u.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium text-foreground text-sm">{u.full_name || '—'}</p>
                                <p className="text-xs text-muted-foreground">{u.email}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Select value={u.role} onValueChange={v => updateRole.mutate({ userId: u.id, role: v as AppRole })}>
                                <SelectTrigger className="w-[90px] h-7 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>{ROLE_OPTIONS.map(r => <SelectItem key={r} value={r} className="capitalize text-xs">{r}</SelectItem>)}</SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${planStyle(u.membership?.plan ?? 'free', u.membership?.status ?? '')}`}>
                                  {u.membership?.status === 'trialing' ? `Essai · J-${u.membership.trial_days_left ?? '?'}` : planLabel(u.membership?.plan ?? 'free')}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              {u.source === 'starterpack'
                                ? <span className="inline-flex items-center gap-1 text-[10px] font-medium text-primary"><Sparkles className="h-3 w-3" /> Starterpack</span>
                                : <span className="text-xs text-muted-foreground">—</span>}
                            </TableCell>
                            <TableCell>
                              {u.linkedin_connected
                                ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                : <X className="h-4 w-4 text-muted-foreground/40" />}
                            </TableCell>
                            <TableCell>
                              {u.has_sales_nav
                                ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                : <X className="h-4 w-4 text-muted-foreground/40" />}
                            </TableCell>
                            <TableCell className="text-right text-sm font-medium">{u.leads_count}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{fmt(u.created_at)}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{fmt(u.last_sign_in_at)}</TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedUser(u)}><Eye className="h-3.5 w-3.5" /></Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDeleteUser(u)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                        {filtered.length === 0 && (
                          <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground text-sm">Aucun utilisateur trouvé</TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Assignations ───────────────────────────────────────── */}
          <TabsContent value="assignments" className="mt-4 space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Ajouter une assignation</CardTitle></CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Select value={selectedCoach} onValueChange={setSelectedCoach}>
                    <SelectTrigger className="w-full sm:w-[220px]"><SelectValue placeholder="Sélectionner un coach" /></SelectTrigger>
                    <SelectContent>{coaches.map(c => <SelectItem key={c.id} value={c.id}>{c.full_name || c.email}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={selectedStudent} onValueChange={setSelectedStudent}>
                    <SelectTrigger className="w-full sm:w-[220px]"><SelectValue placeholder="Sélectionner un élève" /></SelectTrigger>
                    <SelectContent>{students.map(s => <SelectItem key={s.id} value={s.id}>{s.full_name || s.email}</SelectItem>)}</SelectContent>
                  </Select>
                  <Button onClick={() => {
                    if (!selectedCoach || !selectedStudent) return;
                    if (assignments.some((a: any) => a.coach_id === selectedCoach && a.user_id === selectedStudent)) {
                      toast({ variant: 'destructive', title: 'Déjà assigné' }); return;
                    }
                    addAssignment.mutate({ coachId: selectedCoach, studentId: selectedStudent });
                  }} disabled={!selectedCoach || !selectedStudent || addAssignment.isPending}>
                    <Plus className="h-4 w-4 mr-1" /> Assigner
                  </Button>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Assignations ({assignments.length})</CardTitle></CardHeader>
              <CardContent>
                {assignments.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Aucune assignation</p>
                ) : (
                  <Table>
                    <TableHeader><TableRow><TableHead>Coach</TableHead><TableHead>Élève</TableHead><TableHead className="w-[60px]" /></TableRow></TableHeader>
                    <TableBody>
                      {assignments.map((a: any) => (
                        <TableRow key={a.id}>
                          <TableCell className="font-medium">{getName(a.coach_id)}</TableCell>
                          <TableCell>{getName(a.user_id)}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeAssignment.mutate(a.id)}>
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Santé système ──────────────────────────────────────── */}
          <TabsContent value="health" className="mt-4 space-y-4">
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => checkSalesNav.mutate()} disabled={checkSalesNav.isPending} className="gap-2">
                {checkSalesNav.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Linkedin className="h-4 w-4 text-[#0A66C2]" />}
                Vérifier Sales Nav (tous les comptes)
              </Button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Card className={failedJobs.length > 0 ? 'border-destructive/40' : 'border-emerald-200'}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <AlertTriangle className={`h-4 w-4 ${failedJobs.length > 0 ? 'text-destructive' : 'text-emerald-500'}`} />
                    Jobs campagne en erreur
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {failedJobs.length === 0 ? (
                    <p className="text-sm text-emerald-600 font-medium">Aucune erreur 🎉</p>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {failedJobs.map(j => (
                        <div key={j.id} className="rounded-md border border-destructive/20 bg-destructive/5 p-2.5">
                          <p className="text-xs font-medium text-destructive">{j.error_message || 'Erreur inconnue'}</p>
                          <p className="text-[10px] text-muted-foreground mt-1">{fmtFull(j.created_at)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Linkedin className="h-4 w-4 text-[#0A66C2]" />
                    LinkedIn non connecté
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {(() => {
                    const notConnected = users.filter(u => !u.linkedin_connected && u.role === 'user');
                    return notConnected.length === 0 ? (
                      <p className="text-sm text-emerald-600 font-medium">Tous connectés 🎉</p>
                    ) : (
                      <div className="space-y-1.5 max-h-64 overflow-y-auto">
                        {notConnected.map(u => (
                          <div key={u.id} className="flex items-center justify-between text-sm">
                            <span className="text-foreground">{u.full_name || u.email}</span>
                            <span className="text-xs text-muted-foreground">{fmt(u.last_sign_in_at)}</span>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          {/* ── Contenu global ─────────────────────────────────────── */}
          <TabsContent value="content" className="mt-4 space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Form */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-primary" />
                    {editingContent ? 'Modifier le contenu' : 'Ajouter un contenu global'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Titre</Label>
                    <Input value={contentTitle} onChange={e => setContentTitle(e.target.value)} placeholder="Ex : Script de prise de contact" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Type</Label>
                      <Select value={contentType} onValueChange={v => setContentType(v as typeof contentType)}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(CONTENT_TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Catégorie (optionnel)</Label>
                      <Input value={contentCategory} onChange={e => setContentCategory(e.target.value)} placeholder="Ex : Closing" className="h-8 text-xs" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Contenu</Label>
                    <Textarea value={contentBody} onChange={e => setContentBody(e.target.value)} placeholder="Entrez le contenu..." rows={5} className="text-sm resize-none" />
                  </div>
                  <div className="flex gap-2">
                    <Button className="flex-1" onClick={() => upsertContent.mutate()} disabled={upsertContent.isPending || !contentTitle || !contentBody}>
                      {upsertContent.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                      {editingContent ? 'Enregistrer' : <><Plus className="h-3.5 w-3.5 mr-1.5" /> Créer</>}
                    </Button>
                    {editingContent && (
                      <Button variant="ghost" onClick={() => { setEditingContent(null); setContentTitle(''); setContentBody(''); setContentCategory(''); }}>
                        Annuler
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Personas */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Tag className="h-4 w-4 text-primary" />
                    Personas ({allPersonas.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex gap-2">
                    <Input value={personaName} onChange={e => setPersonaName(e.target.value)} placeholder="Nom du persona" className="text-sm" />
                    <Input value={personaDesc} onChange={e => setPersonaDesc(e.target.value)} placeholder="Description courte" className="text-sm" />
                    <Button size="sm" onClick={() => createPersona.mutate()} disabled={!personaName || createPersona.isPending}>
                      {createPersona.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                  {personasLoading ? (
                    <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                  ) : (
                    <div className="space-y-1.5 max-h-64 overflow-y-auto">
                      {allPersonas.map((p: any) => (
                        <div key={p.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                          <div>
                            <p className="text-sm font-medium">{p.name}</p>
                            {p.description && <p className="text-xs text-muted-foreground">{p.description}</p>}
                          </div>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deletePersona.mutate(p.id)}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      ))}
                      {allPersonas.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Aucun persona</p>}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Liste contenus */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Contenus globaux ({globalContents.length})</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {contentsLoading ? (
                  <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                ) : globalContents.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Aucun contenu global</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Titre</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Catégorie</TableHead>
                          <TableHead>Créé le</TableHead>
                          <TableHead className="w-[80px]" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {globalContents.map((c: any) => (
                          <TableRow key={c.id}>
                            <TableCell>
                              <p className="font-medium text-sm">{c.title}</p>
                              <p className="text-xs text-muted-foreground line-clamp-1">{c.body}</p>
                            </TableCell>
                            <TableCell>
                              <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${CONTENT_TYPE_STYLES[c.type] ?? ''}`}>
                                {CONTENT_TYPE_LABELS[c.type] ?? c.type}
                              </span>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">{c.category || '—'}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{fmt(c.created_at)}</TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                                  setEditingContent(c.id);
                                  setContentTitle(c.title);
                                  setContentBody(c.body);
                                  setContentType(c.type);
                                  setContentCategory(c.category ?? '');
                                }}>
                                  <Edit2 className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteContent.mutate(c.id)}>
                                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Fiche utilisateur ────────────────────────────────────────────── */}
      <Sheet open={!!selectedUser} onOpenChange={open => !open && setSelectedUser(null)}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          {selectedUser && (
            <>
              <SheetHeader>
                <SheetTitle>{selectedUser.full_name || selectedUser.email}</SheetTitle>
                <SheetDescription>{selectedUser.email}</SheetDescription>
              </SheetHeader>
              <div className="mt-6 space-y-5">
                {/* Infos clés */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Rôle', value: selectedUser.role },
                    { label: 'Source', value: selectedUser.source || 'organic' },
                    { label: 'Plan', value: selectedUser.membership ? `${planLabel(selectedUser.membership.plan)} · ${selectedUser.membership.status}` : '—' },
                    { label: 'Essai restant', value: selectedUser.membership?.trial_days_left != null ? `${selectedUser.membership.trial_days_left} jours` : '—' },
                    { label: 'Leads', value: String(selectedUser.leads_count) },
                    { label: 'LinkedIn', value: selectedUser.linkedin_connected ? 'Connecté' : 'Non connecté' },
                    { label: 'Sales Nav', value: selectedUser.has_sales_nav ? 'Oui' : 'Non' },
                    { label: 'Campagnes', value: `${selectedUser.campaigns.active} active · ${selectedUser.campaigns.paused} pause · ${selectedUser.campaigns.completed} terminée` },
                    { label: 'Import Sales Nav', value: selectedUser.sales_nav_import.quota > 0 ? `${selectedUser.sales_nav_import.count} / ${selectedUser.sales_nav_import.quota} ce mois` : `${selectedUser.sales_nav_import.count} importés` },
                    { label: 'Onboarding', value: selectedUser.onboarding_completed ? 'Complété' : 'En cours' },
                    { label: 'Inscription', value: fmt(selectedUser.created_at) },
                    { label: 'Dernière co.', value: fmt(selectedUser.last_sign_in_at) },
                    { label: 'Email confirmé', value: selectedUser.email_confirmed_at ? 'Oui' : 'Non' },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className="text-sm font-medium mt-0.5">{value}</p>
                    </div>
                  ))}
                </div>

                <Separator />

                {/* Actions */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Actions</p>

                  {/* Étendre essai */}
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      value={extendDays}
                      onChange={e => setExtendDays(e.target.value)}
                      className="w-20 h-8 text-sm"
                      min="1"
                    />
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => extendTrial.mutate({ userId: selectedUser.id, days: parseInt(extendDays) })} disabled={extendTrial.isPending}>
                      {extendTrial.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                      <CalendarPlus className="h-3.5 w-3.5 mr-1.5" /> Étendre l'essai (jours)
                    </Button>
                  </div>

                  {/* Quota Sales Nav personnalisé */}
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      value={quotaInput}
                      onChange={e => setQuotaInput(e.target.value)}
                      placeholder={`Actuel : ${selectedUser.sales_nav_import.quota}`}
                      className="w-24 h-8 text-sm"
                      min="0"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => quotaInput !== '' && setQuotaOverride.mutate({ userId: selectedUser.id, quota: parseInt(quotaInput) })}
                      disabled={setQuotaOverride.isPending || quotaInput === ''}
                    >
                      {setQuotaOverride.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                      <Gauge className="h-3.5 w-3.5 mr-1.5" /> Fixer quota Sales Nav
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setQuotaOverride.mutate({ userId: selectedUser.id, quota: null })}
                      disabled={setQuotaOverride.isPending}
                      title="Réinitialiser au quota du plan"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  {/* Forcer starterpack */}
                  {selectedUser.source !== 'starterpack' && (
                    <Button size="sm" variant="outline" className="w-full" onClick={() => forceStarterpack.mutate(selectedUser.id)} disabled={forceStarterpack.isPending}>
                      {forceStarterpack.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                      <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Passer en Starterpack
                    </Button>
                  )}

                  {/* Changer rôle */}
                  <div className="flex gap-2 items-center">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">Changer rôle</span>
                    <Select value={selectedUser.role} onValueChange={v => updateRole.mutate({ userId: selectedUser.id, role: v as AppRole })}>
                      <SelectTrigger className="h-8 text-xs flex-1"><SelectValue /></SelectTrigger>
                      <SelectContent>{ROLE_OPTIONS.map(r => <SelectItem key={r} value={r} className="capitalize text-xs">{r}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>

                <Separator />

                {/* Stripe */}
                {selectedUser.membership?.stripe_customer_id && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Stripe</p>
                    <a
                      href={`https://dashboard.stripe.com/customers/${selectedUser.membership.stripe_customer_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline"
                    >
                      Voir dans Stripe Dashboard →
                    </a>
                  </div>
                )}

                <Separator />

                <Button variant="destructive" className="w-full" onClick={() => { setSelectedUser(null); setDeleteUser(selectedUser); }}>
                  <Trash2 className="h-4 w-4 mr-2" /> Supprimer cet utilisateur
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* ── Confirmation suppression ─────────────────────────────────────── */}
      <AlertDialog open={!!deleteUser} onOpenChange={open => !open && setDeleteUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer l'utilisateur ?</AlertDialogTitle>
            <AlertDialogDescription>
              Suppression définitive de <strong>{deleteUser?.full_name || deleteUser?.email}</strong>. Toutes ses données seront perdues.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteUser && deleteUserMut.mutate(deleteUser.id)}
              disabled={deleteUserMut.isPending}
            >
              {deleteUserMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Supprimer définitivement
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Dialog étendre essai (depuis table) ─────────────────────────── */}
      <Dialog open={!!extendingUser} onOpenChange={open => !open && setExtendingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Étendre l'essai</DialogTitle>
            <DialogDescription>{extendingUser?.full_name || extendingUser?.email}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Nombre de jours à ajouter</Label>
              <Input type="number" value={extendDays} onChange={e => setExtendDays(e.target.value)} min="1" />
            </div>
            <Button className="w-full" onClick={() => extendingUser && extendTrial.mutate({ userId: extendingUser.id, days: parseInt(extendDays) })} disabled={extendTrial.isPending}>
              {extendTrial.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmer
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
