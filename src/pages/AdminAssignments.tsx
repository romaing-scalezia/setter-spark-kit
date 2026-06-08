import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/AppLayout';
import { KpiCard } from '@/components/KpiCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Users, UserCheck, UserX, Search, Loader2, Save, X } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface EnrichedUser {
  id: string;
  email: string;
  full_name: string | null;
  role: 'user' | 'coach' | 'admin';
  created_at: string;
  coached_by: string[];
}

const UNASSIGNED = '__unassigned__';

export default function AdminAssignmentsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'assigned' | 'unassigned'>('all');
  const [coachFilter, setCoachFilter] = useState<string>('all');

  // Per-row pending coach selection (studentId -> coachId | UNASSIGNED)
  const [pending, setPending] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState<
    | { type: 'change' | 'remove'; studentId: string; studentName: string; nextCoachId: string | null; currentAssignmentId: string | null; currentCoachName: string | null }
    | null
  >(null);

  const { data: users = [], isLoading } = useQuery({
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

  const { data: assignments = [] } = useQuery({
    queryKey: ['admin-assignments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('coach_assignments')
        .select('id, coach_id, user_id, created_at');
      if (error) throw error;
      return data || [];
    },
  });

  const coaches = useMemo(
    () => users.filter((u) => u.role === 'coach' || u.role === 'admin'),
    [users]
  );
  const students = useMemo(() => users.filter((u) => u.role === 'user'), [users]);

  const coachById = useMemo(() => {
    const m = new Map<string, EnrichedUser>();
    coaches.forEach((c) => m.set(c.id, c));
    return m;
  }, [coaches]);

  // Build student -> active assignment (pick most recent if several exist)
  const assignmentByStudent = useMemo(() => {
    const m = new Map<string, { id: string; coach_id: string }>();
    [...assignments]
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .forEach((a) => m.set(a.user_id, { id: a.id, coach_id: a.coach_id }));
    return m;
  }, [assignments]);

  const totalCoaches = coaches.length;
  const totalStudents = students.length;
  const assignedCount = students.filter((s) => assignmentByStudent.has(s.id)).length;
  const unassignedCount = totalStudents - assignedCount;

  const filteredStudents = students.filter((s) => {
    const a = assignmentByStudent.get(s.id);
    const coach = a ? coachById.get(a.coach_id) : null;

    if (statusFilter === 'assigned' && !a) return false;
    if (statusFilter === 'unassigned' && a) return false;
    if (coachFilter !== 'all') {
      if (coachFilter === UNASSIGNED) {
        if (a) return false;
      } else if (!a || a.coach_id !== coachFilter) {
        return false;
      }
    }

    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      s.full_name?.toLowerCase().includes(q) ||
      s.email?.toLowerCase().includes(q) ||
      coach?.full_name?.toLowerCase().includes(q) ||
      coach?.email?.toLowerCase().includes(q)
    );
  });

  const formatDate = (d: string | null) => {
    if (!d) return '—';
    try {
      return format(new Date(d), 'dd MMM yyyy', { locale: fr });
    } catch {
      return '—';
    }
  };

  const applyMutation = useMutation({
    mutationFn: async ({
      studentId,
      nextCoachId,
      currentAssignmentId,
    }: {
      studentId: string;
      nextCoachId: string | null;
      currentAssignmentId: string | null;
    }) => {
      // Remove all existing assignments for the student first to enforce one active coach
      const studentAssignments = assignments.filter((a) => a.user_id === studentId);
      for (const a of studentAssignments) {
        const { error } = await supabase.from('coach_assignments').delete().eq('id', a.id);
        if (error) throw error;
      }
      if (nextCoachId) {
        const { error } = await supabase
          .from('coach_assignments')
          .insert({ coach_id: nextCoachId, user_id: studentId });
        if (error) throw error;
      }
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['admin-assignments'] });
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      setPending((p) => {
        const next = { ...p };
        delete next[vars.studentId];
        return next;
      });
      toast({ title: vars.nextCoachId ? 'Coach assigné' : 'Assignation supprimée' });
      setConfirm(null);
    },
    onError: (e: Error) => {
      toast({ variant: 'destructive', title: 'Erreur', description: e.message });
    },
  });

  const handleApply = (s: EnrichedUser) => {
    const current = assignmentByStudent.get(s.id) ?? null;
    const selected = pending[s.id];
    if (!selected) return;
    const nextCoachId = selected === UNASSIGNED ? null : selected;
    if ((current?.coach_id ?? null) === nextCoachId) return;

    if (current) {
      // Change or remove → confirm
      setConfirm({
        type: nextCoachId ? 'change' : 'remove',
        studentId: s.id,
        studentName: s.full_name || s.email,
        nextCoachId,
        currentAssignmentId: current.id,
        currentCoachName:
          coachById.get(current.coach_id)?.full_name ||
          coachById.get(current.coach_id)?.email ||
          '—',
      });
    } else {
      // Initial assign → no confirm
      applyMutation.mutate({ studentId: s.id, nextCoachId, currentAssignmentId: null });
    }
  };

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 space-y-6" data-testid="page-admin-assignments">
        <div className="flex items-center gap-3">
          <div className="rounded-md bg-primary/10 p-2">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Assignations Coach / Élève</h1>
            <p className="text-sm text-muted-foreground">
              Visualisez et gérez le matching entre coachs et élèves.
            </p>
          </div>
        </div>

        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <KpiCard title="Total élèves" value={totalStudents} icon={<Users className="h-4 w-4" />} />
          <KpiCard title="Assignés" value={assignedCount} icon={<UserCheck className="h-4 w-4" />} />
          <KpiCard title="Non assignés" value={unassignedCount} icon={<UserX className="h-4 w-4" />} />
          <KpiCard title="Coachs" value={totalCoaches} icon={<Users className="h-4 w-4" />} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Filtres</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  data-testid="assignments-search"
                  placeholder="Rechercher par élève, email ou coach..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
                <SelectTrigger className="w-full sm:w-[180px]" data-testid="assignments-status-filter">
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="assigned">Assignés</SelectItem>
                  <SelectItem value="unassigned">Non assignés</SelectItem>
                </SelectContent>
              </Select>
              <Select value={coachFilter} onValueChange={setCoachFilter}>
                <SelectTrigger className="w-full sm:w-[220px]" data-testid="assignments-coach-filter">
                  <SelectValue placeholder="Coach" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les coachs</SelectItem>
                  <SelectItem value={UNASSIGNED}>Aucun coach</SelectItem>
                  {coaches.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.full_name || c.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {filteredStudents.length} élève{filteredStudents.length !== 1 ? 's' : ''}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Élève</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Coach actuel</TableHead>
                    <TableHead>Inscription</TableHead>
                    <TableHead>Assigner / Modifier</TableHead>
                    <TableHead className="w-[140px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStudents.map((s) => {
                    const a = assignmentByStudent.get(s.id);
                    const currentCoach = a ? coachById.get(a.coach_id) : null;
                    const currentValue = a?.coach_id ?? UNASSIGNED;
                    const selected = pending[s.id] ?? currentValue;
                    const isDirty = selected !== currentValue;
                    const isSaving =
                      applyMutation.isPending && applyMutation.variables?.studentId === s.id;

                    return (
                      <TableRow key={s.id} data-testid={`assignment-row-${s.id}`}>
                        <TableCell className="font-medium">{s.full_name || '—'}</TableCell>
                        <TableCell className="text-muted-foreground">{s.email}</TableCell>
                        <TableCell>
                          {a ? (
                            <Badge>Assigné</Badge>
                          ) : (
                            <Badge variant="secondary">Non assigné</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {currentCoach ? (
                            <span>{currentCoach.full_name || currentCoach.email}</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(s.created_at)}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={selected}
                            onValueChange={(v) =>
                              setPending((p) => ({ ...p, [s.id]: v }))
                            }
                          >
                            <SelectTrigger className="w-[220px] h-8" data-testid={`assignment-select-${s.id}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={UNASSIGNED}>— Aucun coach —</SelectItem>
                              {coaches.map((c) => (
                                <SelectItem key={c.id} value={c.id}>
                                  {c.full_name || c.email}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="default"
                              disabled={!isDirty || isSaving}
                              onClick={() => handleApply(s)}
                              data-testid={`assignment-save-${s.id}`}
                            >
                              {isSaving ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Save className="h-4 w-4" />
                              )}
                            </Button>
                            {isDirty && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() =>
                                  setPending((p) => {
                                    const next = { ...p };
                                    delete next[s.id];
                                    return next;
                                  })
                                }
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filteredStudents.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        Aucun élève ne correspond aux filtres.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={!!confirm} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.type === 'remove'
                ? 'Retirer l’assignation ?'
                : 'Changer le coach assigné ?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.type === 'remove' ? (
                <>
                  L’élève <strong>{confirm?.studentName}</strong> ne sera plus assigné à{' '}
                  <strong>{confirm?.currentCoachName}</strong>.
                </>
              ) : (
                <>
                  L’élève <strong>{confirm?.studentName}</strong> passera de{' '}
                  <strong>{confirm?.currentCoachName}</strong> à un nouveau coach.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!confirm) return;
                applyMutation.mutate({
                  studentId: confirm.studentId,
                  nextCoachId: confirm.nextCoachId,
                  currentAssignmentId: confirm.currentAssignmentId,
                });
              }}
            >
              Confirmer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
