import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/AppLayout';
import { KpiCard } from '@/components/KpiCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Shield, Users, MessageSquare, CalendarCheck, Loader2, Trash2, Plus, UserPlus, Search, Eye, X } from 'lucide-react';
import type { AppRole } from '@/lib/constants';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface EnrichedUser {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: AppRole;
  provider: string;
  providers: string[];
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  debug_role_switch_enabled: boolean;
  membership: { plan: string; status: string } | null;
  coach_of: string[];
  coached_by: string[];
}

const ROLE_OPTIONS: AppRole[] = ['user', 'coach', 'admin'];

const providerLabel = (p: string) => {
  if (p === 'google') return 'Google';
  if (p === 'email') return 'Email';
  return p;
};

const providerBadgeVariant = (p: string) => {
  if (p === 'google') return 'default' as const;
  return 'secondary' as const;
};

const formatDate = (d: string | null) => {
  if (!d) return '—';
  try {
    return format(new Date(d), 'dd MMM yyyy HH:mm', { locale: fr });
  } catch {
    return '—';
  }
};

export default function AdminPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [providerFilter, setProviderFilter] = useState<string>('all');
  const [selectedUser, setSelectedUser] = useState<EnrichedUser | null>(null);
  const [deleteUser, setDeleteUser] = useState<EnrichedUser | null>(null);
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<AppRole>('user');

  // Fetch enriched users from edge function
  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-list-users`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({}),
        }
      );
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Erreur');
      return body.users as EnrichedUser[];
    },
  });

  const { data: leads = [] } = useQuery({
    queryKey: ['admin-leads'],
    queryFn: async () => {
      const { data, error } = await supabase.from('leads').select('*');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: assignments = [] } = useQuery({
    queryKey: ['admin-assignments'],
    queryFn: async () => {
      const { data, error } = await supabase.from('coach_assignments').select('*');
      if (error) throw error;
      return data || [];
    },
  });

  // Mutations
  const updateRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      const { error } = await supabase.rpc('set_user_role', { _target_user_id: userId, _role: role });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast({ title: 'Rôle mis à jour' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Erreur', description: error.message });
    },
  });

  const toggleDebug = useMutation({
    mutationFn: async ({ userId, enabled }: { userId: string; enabled: boolean }) => {
      const { error } = await supabase.rpc('set_debug_role_access', { _target_user_id: userId, _enabled: enabled });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast({ title: 'Accès debug mis à jour' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Erreur', description: error.message });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-delete-user`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ user_id: userId }),
        }
      );
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Erreur');
      return body;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-assignments'] });
      toast({ title: 'Utilisateur supprimé' });
      setDeleteUser(null);
      setSelectedUser(null);
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Erreur', description: error.message });
    },
  });

  const createUser = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-create-user`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            email: newUserEmail,
            password: newUserPassword,
            full_name: newUserName,
            role: newUserRole,
          }),
        }
      );
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Erreur');
      return body;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast({ title: 'Utilisateur créé avec succès' });
      setCreateUserOpen(false);
      setNewUserName('');
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserRole('user');
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Erreur', description: error.message });
    },
  });

  const addAssignment = useMutation({
    mutationFn: async ({ coachId, studentId }: { coachId: string; studentId: string }) => {
      const { error } = await supabase.from('coach_assignments').insert({ coach_id: coachId, user_id: studentId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast({ title: 'Assignation ajoutée' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Erreur', description: error.message });
    },
  });

  const removeAssignment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('coach_assignments').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast({ title: 'Assignation supprimée' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Erreur', description: error.message });
    },
  });

  // Filters
  const filteredUsers = users.filter((u) => {
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch = !q || [
      u.full_name?.toLowerCase(),
      u.email?.toLowerCase(),
    ].some((field) => field?.includes(q));
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    const matchesProvider = providerFilter === 'all' || u.provider === providerFilter;
    return matchesSearch && matchesRole && matchesProvider;
  });

  const coaches = users.filter((u) => u.role === 'coach' || u.role === 'admin');
  const students = users.filter((u) => u.role === 'user');

  const [selectedCoach, setSelectedCoach] = useState('');
  const [selectedStudent, setSelectedStudent] = useState('');

  const getName = (id: string) => {
    const u = users.find((u) => u.id === id);
    return u?.full_name || u?.email || id.slice(0, 8);
  };

  const handleAddAssignment = () => {
    if (!selectedCoach || !selectedStudent) return;
    const exists = assignments.some((a) => a.coach_id === selectedCoach && a.user_id === selectedStudent);
    if (exists) {
      toast({ variant: 'destructive', title: 'Déjà assigné' });
      return;
    }
    addAssignment.mutate({ coachId: selectedCoach, studentId: selectedStudent });
    setSelectedStudent('');
  };

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 space-y-6" data-testid="page-admin">
        <div className="flex items-center gap-3">
          <div className="rounded-md bg-primary/10 p-2">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Administration</h1>
        </div>

        {(() => {
          const totalStudents = students.length;
          const totalCoaches = coaches.length;
          const assignedStudentIds = new Set(assignments.map((a: any) => a.user_id));
          const assignedStudents = students.filter((s) => assignedStudentIds.has(s.id)).length;
          const unassignedStudents = totalStudents - assignedStudents;
          return (
            <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
              <KpiCard title="Élèves" value={totalStudents} icon={<Users className="h-4 w-4" />} />
              <KpiCard title="Élèves assignés" value={assignedStudents} icon={<Shield className="h-4 w-4" />} />
              <KpiCard title="Non assignés" value={unassignedStudents} icon={<MessageSquare className="h-4 w-4" />} />
              <KpiCard title="Coachs" value={totalCoaches} icon={<CalendarCheck className="h-4 w-4" />} />
            </div>
          );
        })()}

        <Tabs defaultValue="users">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <TabsList>
              <TabsTrigger value="users">Utilisateurs</TabsTrigger>
              <TabsTrigger value="assignments">Assignations</TabsTrigger>
            </TabsList>
            <Dialog open={createUserOpen} onOpenChange={setCreateUserOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><UserPlus className="h-4 w-4 mr-1" /> Créer un utilisateur</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Créer un utilisateur</DialogTitle>
                  <DialogDescription>Créer un compte manuellement avec email et mot de passe.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label>Nom complet</Label>
                    <Input value={newUserName} onChange={(e) => setNewUserName(e.target.value)} placeholder="Jean Dupont" />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input type="email" value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} placeholder="jean@exemple.com" />
                  </div>
                  <div className="space-y-2">
                    <Label>Mot de passe</Label>
                    <Input type="password" value={newUserPassword} onChange={(e) => setNewUserPassword(e.target.value)} placeholder="••••••••" />
                  </div>
                  <div className="space-y-2">
                    <Label>Rôle</Label>
                    <Select value={newUserRole} onValueChange={(v) => setNewUserRole(v as AppRole)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ROLE_OPTIONS.map((r) => (
                          <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    className="w-full"
                    onClick={() => createUser.mutate()}
                    disabled={createUser.isPending || !newUserName || !newUserEmail || !newUserPassword}
                  >
                    {createUser.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Créer le compte
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <TabsContent value="users" className="mt-4 space-y-4">
            {/* Search and Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher par nom ou email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Rôle" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les rôles</SelectItem>
                  {ROLE_OPTIONS.map((r) => (
                    <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={providerFilter} onValueChange={setProviderFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="google">Google</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {filteredUsers.length} utilisateur{filteredUsers.length !== 1 ? 's' : ''}
                  {(searchQuery || roleFilter !== 'all' || providerFilter !== 'all') && (
                    <span className="text-muted-foreground font-normal"> (filtré)</span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {usersLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nom</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Rôle</TableHead>
                        <TableHead>Provider</TableHead>
                        <TableHead>Inscription</TableHead>
                        <TableHead>Dernière connexion</TableHead>
                        <TableHead className="w-[100px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.map((user) => (
                        <TableRow key={user.id} className="cursor-pointer hover:bg-muted/50">
                          <TableCell className="font-medium">{user.full_name || '—'}</TableCell>
                          <TableCell className="text-muted-foreground">{user.email}</TableCell>
                          <TableCell>
                            <Select
                              value={user.role}
                              onValueChange={(value) => updateRole.mutate({ userId: user.id, role: value as AppRole })}
                            >
                              <SelectTrigger className="w-[100px] h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {ROLE_OPTIONS.map((role) => (
                                  <SelectItem key={role} value={role} className="capitalize">{role}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Badge variant={providerBadgeVariant(user.provider)}>
                              {providerLabel(user.provider)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">{formatDate(user.created_at)}</TableCell>
                          <TableCell className="text-sm">{formatDate(user.last_sign_in_at)}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" onClick={() => setSelectedUser(user)} title="Détails">
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => setDeleteUser(user)} title="Supprimer">
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {filteredUsers.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                            Aucun utilisateur trouvé
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="assignments" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Ajouter une assignation</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Select value={selectedCoach} onValueChange={setSelectedCoach}>
                    <SelectTrigger className="w-full sm:w-[200px]">
                      <SelectValue placeholder="Sélectionner un coach" />
                    </SelectTrigger>
                    <SelectContent>
                      {coaches.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.full_name || c.email}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={selectedStudent} onValueChange={setSelectedStudent}>
                    <SelectTrigger className="w-full sm:w-[200px]">
                      <SelectValue placeholder="Sélectionner un élève" />
                    </SelectTrigger>
                    <SelectContent>
                      {students.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.full_name || s.email}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button onClick={handleAddAssignment} disabled={!selectedCoach || !selectedStudent || addAssignment.isPending}>
                    <Plus className="h-4 w-4 mr-1" /> Assigner
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Assignations actuelles ({assignments.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {assignments.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Aucune assignation</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Coach</TableHead>
                        <TableHead>Élève</TableHead>
                        <TableHead className="w-[80px]">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {assignments.map((a) => (
                        <TableRow key={a.id}>
                          <TableCell className="font-medium">{getName(a.coach_id)}</TableCell>
                          <TableCell>{getName(a.user_id)}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" onClick={() => removeAssignment.mutate(a.id)} disabled={removeAssignment.isPending}>
                              <Trash2 className="h-4 w-4 text-destructive" />
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
        </Tabs>
      </div>

      {/* User Detail Sheet */}
      <Sheet open={!!selectedUser} onOpenChange={(open) => !open && setSelectedUser(null)}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          {selectedUser && (
            <>
              <SheetHeader>
                <SheetTitle>{selectedUser.full_name || selectedUser.email}</SheetTitle>
                <SheetDescription>{selectedUser.email}</SheetDescription>
              </SheetHeader>
              <div className="mt-6 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Rôle</p>
                    <Badge className="mt-1 capitalize">{selectedUser.role}</Badge>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Provider</p>
                    <Badge variant={providerBadgeVariant(selectedUser.provider)} className="mt-1">
                      {providerLabel(selectedUser.provider)}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Inscription</p>
                    <p className="text-sm font-medium mt-1">{formatDate(selectedUser.created_at)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Dernière connexion</p>
                    <p className="text-sm font-medium mt-1">{formatDate(selectedUser.last_sign_in_at)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Email confirmé</p>
                    <p className="text-sm font-medium mt-1">{selectedUser.email_confirmed_at ? 'Oui' : 'Non'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Debug mode</p>
                    <p className="text-sm font-medium mt-1">{selectedUser.debug_role_switch_enabled ? 'Activé' : 'Désactivé'}</p>
                  </div>
                </div>

                {selectedUser.membership && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Abonnement</p>
                    <div className="flex gap-2">
                      <Badge variant="outline" className="capitalize">{selectedUser.membership.plan}</Badge>
                      <Badge variant="outline" className="capitalize">{selectedUser.membership.status}</Badge>
                    </div>
                  </div>
                )}

                {selectedUser.providers.length > 1 && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Providers liés</p>
                    <div className="flex gap-2">
                      {selectedUser.providers.map((p) => (
                        <Badge key={p} variant="outline">{providerLabel(p)}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {(selectedUser.coach_of.length > 0 || selectedUser.coached_by.length > 0) && (
                  <div>
                    {selectedUser.coach_of.length > 0 && (
                      <>
                        <p className="text-sm text-muted-foreground mb-1">Coach de</p>
                        <div className="flex flex-wrap gap-1 mb-2">
                          {selectedUser.coach_of.map((id) => (
                            <Badge key={id} variant="outline">{getName(id)}</Badge>
                          ))}
                        </div>
                      </>
                    )}
                    {selectedUser.coached_by.length > 0 && (
                      <>
                        <p className="text-sm text-muted-foreground mb-1">Coaché par</p>
                        <div className="flex flex-wrap gap-1">
                          {selectedUser.coached_by.map((id) => (
                            <Badge key={id} variant="outline">{getName(id)}</Badge>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}

                <div className="pt-4 border-t">
                  <Button
                    variant="destructive"
                    className="w-full"
                    onClick={() => {
                      setSelectedUser(null);
                      setDeleteUser(selectedUser);
                    }}
                  >
                    <Trash2 className="h-4 w-4 mr-2" /> Supprimer cet utilisateur
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteUser} onOpenChange={(open) => !open && setDeleteUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer l'utilisateur ?</AlertDialogTitle>
            <AlertDialogDescription>
              Vous êtes sur le point de supprimer définitivement <strong>{deleteUser?.full_name || deleteUser?.email}</strong>.
              <br /><br />
              Cette action est <strong>irréversible</strong>. Toutes les données associées (leads, deals, événements, assignations) seront supprimées.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteUser && deleteUserMutation.mutate(deleteUser.id)}
              disabled={deleteUserMutation.isPending}
            >
              {deleteUserMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Supprimer définitivement
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
