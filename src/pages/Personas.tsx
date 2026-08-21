import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, Pencil, Trash2, Target, Users, ArrowLeft, Rocket, ArrowRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { TARGET_TYPES, SECTORS, COMPANY_SIZES } from '@/lib/constants';
import type { Profile } from '@/lib/constants';

export type Persona = {
  id: string;
  name: string;
  description: string | null;
  target_type: string | null;
  sector: string | null;
  company_size: string | null;
  target_role: string | null;
  maturity_level: string | null;
  main_problems: string | null;
  objectives: string | null;
  frequent_objections: string | null;
  recommended_approach: string | null;
  coach_notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type UserPersona = {
  id: string;
  user_id: string;
  persona_id: string;
  is_primary: boolean;
  assigned_by: string;
  created_at: string;
};

function PersonaForm({
  persona,
  onSave,
  onCancel,
  isPending,
}: {
  persona?: Persona | null;
  onSave: (data: Partial<Persona>) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [name, setName] = useState(persona?.name || '');
  const [description, setDescription] = useState(persona?.description || '');
  const [targetType, setTargetType] = useState(persona?.target_type || '');
  const [sector, setSector] = useState(persona?.sector || '');
  const [companySize, setCompanySize] = useState(persona?.company_size || '');
  const [targetRole, setTargetRole] = useState(persona?.target_role || '');
  const [mainProblems, setMainProblems] = useState(persona?.main_problems || '');
  const [frequentObjections, setFrequentObjections] = useState(persona?.frequent_objections || '');
  const [recommendedApproach, setRecommendedApproach] = useState(persona?.recommended_approach || '');
  const [coachNotes, setCoachNotes] = useState(persona?.coach_notes || '');

  return (
    <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
      <div className="space-y-2">
        <Label>Nom de la cible *</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: CEO SaaS B2B" />
      </div>
      <div className="space-y-2">
        <Label>Description</Label>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Description courte de la cible" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Type de cible</Label>
          <Select value={targetType || 'none'} onValueChange={(v) => setTargetType(v === 'none' ? '' : v)}>
            <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">—</SelectItem>
              {TARGET_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Secteur d'activité</Label>
          <Select value={sector || 'none'} onValueChange={(v) => setSector(v === 'none' ? '' : v)}>
            <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">—</SelectItem>
              {SECTORS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Taille entreprise</Label>
          <Select value={companySize || 'none'} onValueChange={(v) => setCompanySize(v === 'none' ? '' : v)}>
            <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">—</SelectItem>
              {COMPANY_SIZES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Rôle cible</Label>
          <Input value={targetRole} onChange={(e) => setTargetRole(e.target.value)} placeholder="Ex: CEO, Head of Sales..." />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Problématiques principales</Label>
        <Textarea value={mainProblems} onChange={(e) => setMainProblems(e.target.value)} rows={2} placeholder="Quelles douleurs a cette cible ?" />
      </div>
      <div className="space-y-2">
        <Label>Objections fréquentes</Label>
        <Textarea value={frequentObjections} onChange={(e) => setFrequentObjections(e.target.value)} rows={2} placeholder="Objections les plus courantes" />
      </div>
      <div className="space-y-2">
        <Label>Angle d'approche recommandé</Label>
        <Textarea value={recommendedApproach} onChange={(e) => setRecommendedApproach(e.target.value)} rows={2} placeholder="Comment aborder cette cible" />
      </div>
      <div className="space-y-2">
        <Label>Notes coach</Label>
        <Textarea value={coachNotes} onChange={(e) => setCoachNotes(e.target.value)} rows={2} placeholder="Notes internes" />
      </div>
      <div className="flex gap-2 pt-2">
        <Button
          onClick={() => onSave({
            name, description: description || null, target_type: targetType || null, sector: sector || null,
            company_size: companySize || null, target_role: targetRole || null,
            main_problems: mainProblems || null,
            frequent_objections: frequentObjections || null, recommended_approach: recommendedApproach || null,
            coach_notes: coachNotes || null,
          })}
          disabled={!name || isPending}
          className="flex-1"
        >
          {persona ? 'Enregistrer' : 'Créer'}
        </Button>
        <Button variant="outline" onClick={onCancel}>Annuler</Button>
      </div>
    </div>
  );
}

function PersonaCard({ persona, onEdit, onDelete, onView }: {
  persona: Persona;
  onEdit?: () => void;
  onDelete?: () => void;
  onView: () => void;
}) {
  return (
    <Card className="cursor-pointer hover:shadow-md transition-shadow group" onClick={onView}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Target className="h-4 w-4 text-primary shrink-0" />
            {persona.name}
          </CardTitle>
          <div className="flex items-center gap-1 shrink-0">
            {persona.target_type && <Badge variant="outline" className="text-xs">{persona.target_type}</Badge>}
            {onEdit && (
              <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={(e) => { e.stopPropagation(); onEdit(); }}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}
            {onDelete && (
              <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 text-destructive" onClick={(e) => { e.stopPropagation(); onDelete(); }}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {persona.description && <p className="text-xs text-muted-foreground line-clamp-2">{persona.description}</p>}
        <div className="flex flex-wrap gap-1 mt-2">
          {persona.sector && <Badge variant="secondary" className="text-xs">{persona.sector}</Badge>}
          {persona.company_size && <Badge variant="secondary" className="text-xs">{persona.company_size}</Badge>}
          {persona.target_role && <Badge variant="secondary" className="text-xs">{persona.target_role}</Badge>}
        </div>
      </CardContent>
    </Card>
  );
}

export function PersonaDetailView({ persona }: { persona: Persona }) {
  const sections = [
    { label: 'Description', value: persona.description },
    { label: 'Type de cible', value: persona.target_type },
    { label: 'Secteur d\'activité', value: persona.sector },
    { label: 'Taille entreprise', value: persona.company_size },
    { label: 'Rôle cible', value: persona.target_role },
    { label: 'Problématiques principales', value: persona.main_problems },
    { label: 'Objections fréquentes', value: persona.frequent_objections },
    { label: 'Angle d\'approche recommandé', value: persona.recommended_approach },
    { label: 'Notes coach', value: persona.coach_notes },
  ].filter((s) => s.value);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Target className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold text-foreground">{persona.name}</h3>
        {persona.target_type && <Badge variant="outline">{persona.target_type}</Badge>}
      </div>
      {sections.map((s) => (
        <div key={s.label} className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{s.label}</p>
          <p className="text-sm text-foreground whitespace-pre-wrap">{s.value}</p>
        </div>
      ))}
    </div>
  );
}

export function PersonasContent() {
  const { user, activeRole } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isCoachOrAdmin = activeRole === 'coach' || activeRole === 'admin';
  const isOnboardingParam = searchParams.get('onboarding') === 'done';
  const onboardingModeRef = useRef(isOnboardingParam);

  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [onboardingMode, setOnboardingMode] = useState(isOnboardingParam);
  const [editingPersona, setEditingPersona] = useState<Persona | null>(null);
  const [viewingPersona, setViewingPersona] = useState<Persona | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [assignOpen, setAssignOpen] = useState<string | null>(null);
  const [assignUserId, setAssignUserId] = useState('none');
  const [assignPrimary, setAssignPrimary] = useState(false);

  // Clear onboarding param from URL
  useEffect(() => {
    if (isOnboardingParam) {
      setSearchParams({}, { replace: true });
    }
  }, []);

  const handleSkipPersona = () => {
    setOnboardingMode(false);
    navigate('/leads?onboarding=done', { replace: true });
  };

  const handleOnboardingPersonaCreated = () => {
    setOnboardingMode(false);
    navigate('/leads?onboarding=done', { replace: true });
  };

  const { data: personas = [], isLoading } = useQuery({
    queryKey: ['personas'],
    queryFn: async () => {
      const { data, error } = await supabase.from('personas').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as Persona[];
    },
  });

  const { data: userPersonas = [] } = useQuery({
    queryKey: ['user-personas'],
    queryFn: async () => {
      const { data, error } = await supabase.from('user_personas').select('*');
      if (error) throw error;
      return (data || []) as UserPersona[];
    },
  });

  const { data: students = [] } = useQuery({
    queryKey: ['personas-students', user?.id],
    queryFn: async () => {
      if (activeRole === 'admin') {
        const { data } = await supabase.from('profiles').select('*').eq('role', 'user');
        return (data || []) as Profile[];
      }
      const { data: assignments } = await supabase.from('coach_assignments').select('user_id').eq('coach_id', user!.id);
      if (!assignments?.length) return [];
      const { data } = await supabase.from('profiles').select('*').in('id', assignments.map((a) => a.user_id));
      return (data || []) as Profile[];
    },
    enabled: !!user && isCoachOrAdmin,
  });

  const createPersona = useMutation({
    mutationFn: async (data: Partial<Persona>) => {
      const { data: createdPersona, error } = await supabase
        .from('personas')
        .insert({ ...data, created_by: user!.id } as any)
        .select('id')
        .single();
      if (error) throw error;

      if (activeRole !== 'admin' && createdPersona?.id) {
        const existingPrimary = userPersonas.some((up) => up.user_id === user!.id && up.is_primary);
        const { error: assignmentError } = await supabase.from('user_personas').insert({
          user_id: user!.id,
          persona_id: createdPersona.id,
          assigned_by: user!.id,
          is_primary: !existingPrimary,
        } as any);
        if (assignmentError) throw assignmentError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['personas'] });
      queryClient.invalidateQueries({ queryKey: ['user-personas'] });
      queryClient.invalidateQueries({ queryKey: ['create-lead-personas'] });
      queryClient.invalidateQueries({ queryKey: ['lead-detail-personas'] });
      setCreateOpen(false);
      if (onboardingMode) {
        handleOnboardingPersonaCreated();
        return;
      }
      toast({ title: 'Persona créée' });
    },
    onError: (err: any) => toast({ variant: 'destructive', title: 'Erreur', description: err.message }),
  });

  const updatePersona = useMutation({
    mutationFn: async (data: Partial<Persona>) => {
      if (!editingPersona) return;
      const { error } = await supabase.from('personas').update(data as any).eq('id', editingPersona.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['personas'] });
      setEditingPersona(null);
      toast({ title: 'Persona modifiée' });
    },
    onError: (err: any) => toast({ variant: 'destructive', title: 'Erreur', description: err.message }),
  });

  const deletePersona = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('personas').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['personas'] });
      setDeleteConfirmId(null);
      setViewingPersona(null);
      toast({ title: 'Persona supprimée' });
    },
    onError: (err: any) => toast({ variant: 'destructive', title: 'Erreur', description: err.message }),
  });

  const assignPersona = useMutation({
    mutationFn: async () => {
      if (!assignOpen || assignUserId === 'none') return;
      if (assignPrimary) {
        const existing = userPersonas.filter((up) => up.user_id === assignUserId && up.is_primary);
        for (const e of existing) {
          await supabase.from('user_personas').update({ is_primary: false } as any).eq('id', e.id);
        }
      }
      const { error } = await supabase.from('user_personas').insert({
        user_id: assignUserId,
        persona_id: assignOpen,
        is_primary: assignPrimary,
        assigned_by: user!.id,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-personas'] });
      setAssignOpen(null);
      setAssignUserId('none');
      setAssignPrimary(false);
      toast({ title: 'Persona assignée' });
    },
    onError: (err: any) => toast({ variant: 'destructive', title: 'Erreur', description: err.message }),
  });

  const unassignPersona = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('user_personas').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-personas'] });
      toast({ title: 'Assignation retirée' });
    },
  });

  const filtered = personas.filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return p.name.toLowerCase().includes(q) || (p.target_type || '').toLowerCase().includes(q) || (p.sector || '').toLowerCase().includes(q);
  });

  const getStudentName = (id: string) => {
    const s = students.find((p) => p.id === id);
    return s?.full_name || s?.email || id.slice(0, 8);
  };

  const getAssignedStudents = (personaId: string) => userPersonas.filter((up) => up.persona_id === personaId);

  if (onboardingMode) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="flex justify-center">
              <div className="rounded-full bg-primary/10 p-3">
                <Rocket className="h-8 w-8 text-primary" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-foreground">Définissez votre cible idéale</h1>
            <p className="text-muted-foreground">Décrivez qui vous ciblez pour obtenir de meilleurs résultats.</p>
          </div>

          <Card className="border-0 shadow-lg">
            <CardContent className="pt-6 pb-6 px-6">
              <PersonaForm
                onSave={(data) => createPersona.mutate(data)}
                onCancel={handleSkipPersona}
                isPending={createPersona.isPending}
              />
            </CardContent>
          </Card>

          <div className="text-center">
            <Button variant="ghost" onClick={handleSkipPersona} className="text-muted-foreground">
              Passer cette étape <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="p-4 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-md bg-primary/10 p-2">
              <Target className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Personas / Cibles</h1>
              <p className="text-sm text-muted-foreground">{personas.length} persona{personas.length > 1 ? 's' : ''}</p>
            </div>
          </div>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Nouvelle persona
          </Button>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Rechercher..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>

        {isLoading ? (
          <p className="text-muted-foreground text-sm">Chargement...</p>
        ) : filtered.length === 0 ? (
          <p className="text-muted-foreground text-sm">Aucune persona trouvée</p>
        ) : viewingPersona ? (
          <Card>
            <CardHeader className="flex flex-row items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => setViewingPersona(null)}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <CardTitle className="text-base">Détail de la persona</CardTitle>
            </CardHeader>
            <CardContent>
              <PersonaDetailView persona={viewingPersona} />
              {isCoachOrAdmin && (
                <div className="mt-6 border-t pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium flex items-center gap-2">
                      <Users className="h-4 w-4" /> Élèves assignés
                    </p>
                    <Button size="sm" variant="outline" onClick={() => setAssignOpen(viewingPersona.id)}>
                      <Plus className="h-3 w-3 mr-1" /> Assigner
                    </Button>
                  </div>
                  {getAssignedStudents(viewingPersona.id).length === 0 ? (
                    <p className="text-xs text-muted-foreground">Aucun élève assigné</p>
                  ) : (
                    <div className="space-y-1">
                      {getAssignedStudents(viewingPersona.id).map((up) => (
                        <div key={up.id} className="flex items-center justify-between text-sm rounded-md border p-2">
                          <div className="flex items-center gap-2">
                            <span>{getStudentName(up.user_id)}</span>
                            {up.is_primary && <Badge variant="default" className="text-xs">Principal</Badge>}
                          </div>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => unassignPersona.mutate(up.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((persona) => {
              const canManage = persona.created_by === user?.id || isCoachOrAdmin;
              return (
                <PersonaCard
                  key={persona.id}
                  persona={persona}
                  onEdit={canManage ? () => setEditingPersona(persona) : undefined}
                  onDelete={canManage ? () => setDeleteConfirmId(persona.id) : undefined}
                  onView={() => setViewingPersona(persona)}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Create modal */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Nouvelle persona</DialogTitle></DialogHeader>
          <PersonaForm onSave={(data) => createPersona.mutate(data)} onCancel={() => setCreateOpen(false)} isPending={createPersona.isPending} />
        </DialogContent>
      </Dialog>

      {/* Edit modal */}
      <Dialog open={!!editingPersona} onOpenChange={(o) => { if (!o) setEditingPersona(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Modifier la persona</DialogTitle></DialogHeader>
          {editingPersona && (
            <PersonaForm persona={editingPersona} onSave={(data) => updatePersona.mutate(data)} onCancel={() => setEditingPersona(null)} isPending={updatePersona.isPending} />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleteConfirmId} onOpenChange={(o) => { if (!o) setDeleteConfirmId(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Supprimer cette persona ?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Cette action est irréversible.</p>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>Annuler</Button>
            <Button variant="destructive" onClick={() => deleteConfirmId && deletePersona.mutate(deleteConfirmId)}>Supprimer</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Assign modal */}
      <Dialog open={!!assignOpen} onOpenChange={(o) => { if (!o) { setAssignOpen(null); setAssignUserId('none'); setAssignPrimary(false); } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Assigner à un élève</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Select value={assignUserId} onValueChange={setAssignUserId}>
              <SelectTrigger><SelectValue placeholder="Choisir un élève" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none" disabled>Choisir un élève</SelectItem>
                {students.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.full_name || s.email || s.id.slice(0, 8)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={assignPrimary} onChange={(e) => setAssignPrimary(e.target.checked)} className="rounded" />
              Définir comme persona principale
            </label>
            <Button onClick={() => assignPersona.mutate()} disabled={assignUserId === 'none' || assignPersona.isPending} className="w-full">
              Assigner
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function PersonasPage() {
  return <AppLayout><PersonasContent /></AppLayout>;
}
