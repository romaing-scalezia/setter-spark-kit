import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, BookOpen, Search, Copy, Check, Pencil, Trash2, FolderOpen, Target, Settings2 } from 'lucide-react';
import { CONTENT_TYPE_LABELS, type ContentType, type CoachingContent, type Profile } from '@/lib/constants';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import type { Persona } from '@/pages/Personas';

type ScriptCategory = {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  created_at: string;
};

export function LibraryContent() {
  const { user, activeRole } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isCoachOrAdmin = activeRole === 'coach' || activeRole === 'admin';

  const [tab, setTab] = useState<string>('script');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [editingContent, setEditingContent] = useState<CoachingContent | null>(null);
  const [selectedContent, setSelectedContent] = useState<CoachingContent | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Category management state
  const [categoryMgmtOpen, setCategoryMgmtOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategory, setEditingCategory] = useState<ScriptCategory | null>(null);
  const [editCategoryName, setEditCategoryName] = useState('');
  const [deleteCategoryId, setDeleteCategoryId] = useState<string | null>(null);

  // Form state
  const [formType, setFormType] = useState<ContentType>('script');
  const [formTitle, setFormTitle] = useState('');
  const [formBody, setFormBody] = useState('');
  const [formCategory, setFormCategory] = useState<string>('none');
  const [formGlobal, setFormGlobal] = useState(false);
  const [formTargetUserId, setFormTargetUserId] = useState<string>('none');
  const [formPersonaId, setFormPersonaId] = useState<string>('none');
  const [personaFilter, setPersonaFilter] = useState<string>('all');

  // ── Queries ──
  const { data: students = [] } = useQuery({
    queryKey: ['library-students', user?.id],
    queryFn: async () => {
      if (activeRole === 'admin') {
        const { data } = await supabase.from('profiles').select('*').eq('role', 'user');
        return (data || []) as Profile[];
      }
      const { data: assignments } = await supabase.from('coach_assignments').select('user_id').eq('coach_id', user!.id);
      if (!assignments?.length) return [];
      const ids = assignments.map((a) => a.user_id);
      const { data } = await supabase.from('profiles').select('*').in('id', ids);
      return (data || []) as Profile[];
    },
    enabled: !!user && isCoachOrAdmin,
  });

  const { data: personas = [] } = useQuery({
    queryKey: ['library-personas'],
    queryFn: async () => {
      const { data } = await supabase.from('personas').select('*').order('name');
      return (data || []) as Persona[];
    },
    enabled: !!user,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['script-categories'],
    queryFn: async () => {
      const { data, error } = await supabase.from('script_categories').select('*').order('name');
      if (error) throw error;
      return (data || []) as ScriptCategory[];
    },
    enabled: !!user,
  });

  const { data: contents = [], isLoading } = useQuery({
    queryKey: ['coaching-contents', tab],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('coaching_contents')
        .select('*')
        .eq('type', tab as ContentType)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as CoachingContent[];
    },
  });

  // ── Category Mutations ──
  const createCategory = useMutation({
    mutationFn: async (name: string) => {
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
      const { error } = await supabase.from('script_categories').insert({ name, slug, owner_id: user!.id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['script-categories'] });
      setNewCategoryName('');
      toast({ title: 'Catégorie créée' });
    },
    onError: (err: any) => toast({ variant: 'destructive', title: 'Erreur', description: err.message }),
  });

  const updateCategory = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
      const { error } = await supabase.from('script_categories').update({ name, slug }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['script-categories'] });
      setEditingCategory(null);
      toast({ title: 'Catégorie modifiée' });
    },
    onError: (err: any) => toast({ variant: 'destructive', title: 'Erreur', description: err.message }),
  });

  const deleteCategory = useMutation({
    mutationFn: async (id: string) => {
      // Contents with this category will have category set to null (handled by clearing)
      // First clear category from contents that use this category slug
      const cat = categories.find((c) => c.id === id);
      if (cat) {
        await supabase.from('coaching_contents').update({ category: null } as any).eq('category', cat.slug);
      }
      const { error } = await supabase.from('script_categories').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['script-categories'] });
      queryClient.invalidateQueries({ queryKey: ['coaching-contents'] });
      setDeleteCategoryId(null);
      toast({ title: 'Catégorie supprimée' });
    },
    onError: (err: any) => toast({ variant: 'destructive', title: 'Erreur', description: err.message }),
  });

  // ── Content Mutations ──
  const createContent = useMutation({
    mutationFn: async () => {
      const payload: any = {
        type: formType,
        title: formTitle,
        body: formBody,
        category: formCategory !== 'none' ? formCategory : null,
        is_global: isCoachOrAdmin ? formGlobal : false,
        target_user_id: isCoachOrAdmin && formTargetUserId !== 'none' && !formGlobal ? formTargetUserId : null,
        persona_id: formPersonaId !== 'none' ? formPersonaId : null,
        owner_id: user!.id,
        created_by: user!.id,
      };
      const { error } = await supabase.from('coaching_contents').insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coaching-contents'] });
      resetForm();
      setCreateOpen(false);
      toast({ title: 'Contenu créé' });
    },
    onError: (err: any) => toast({ variant: 'destructive', title: 'Erreur', description: err.message }),
  });

  const updateContent = useMutation({
    mutationFn: async () => {
      if (!editingContent) return;
      const { error } = await supabase.from('coaching_contents').update({
        title: formTitle,
        body: formBody,
        category: formCategory !== 'none' ? formCategory : null,
        is_global: isCoachOrAdmin ? formGlobal : false,
        target_user_id: isCoachOrAdmin && formTargetUserId !== 'none' && !formGlobal ? formTargetUserId : null,
        persona_id: formPersonaId !== 'none' ? formPersonaId : null,
      } as any).eq('id', editingContent.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coaching-contents'] });
      resetForm();
      setEditingContent(null);
      toast({ title: 'Contenu modifié' });
    },
    onError: (err: any) => toast({ variant: 'destructive', title: 'Erreur', description: err.message }),
  });

  const deleteContent = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('coaching_contents').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coaching-contents'] });
      setDeleteConfirmId(null);
      setSelectedContent(null);
      toast({ title: 'Contenu supprimé' });
    },
    onError: (err: any) => toast({ variant: 'destructive', title: 'Erreur', description: err.message }),
  });

  const resetForm = () => {
    setFormTitle('');
    setFormBody('');
    setFormCategory('none');
    setFormGlobal(false);
    setFormTargetUserId('none');
    setFormPersonaId('none');
  };

  const openEdit = (c: CoachingContent) => {
    setFormType(c.type);
    setFormTitle(c.title);
    setFormBody(c.body);
    setFormCategory((c as any).category || 'none');
    setFormGlobal(c.is_global);
    setFormTargetUserId(c.target_user_id || 'none');
    setFormPersonaId((c as any).persona_id || 'none');
    setEditingContent(c);
    setSelectedContent(null);
  };

  const canEdit = (c: CoachingContent) => c.created_by === user?.id || c.owner_id === user?.id || activeRole === 'admin';

  const getCategoryLabel = (slug: string | null) => {
    if (!slug) return null;
    const cat = categories.find((c) => c.slug === slug);
    return cat?.name || slug;
  };

  const filteredContents = contents.filter((c) => {
    if (search) {
      const q = search.toLowerCase();
      if (!c.title.toLowerCase().includes(q) && !c.body.toLowerCase().includes(q)) return false;
    }
    if (categoryFilter !== 'all') {
      if (categoryFilter === 'uncategorized') return !(c as any).category;
      if ((c as any).category !== categoryFilter) return false;
    }
    if (personaFilter !== 'all') {
      if (personaFilter === 'none') return !(c as any).persona_id;
      if ((c as any).persona_id !== personaFilter) return false;
    }
    return true;
  });

  const handleCopy = async (text: string, id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      toast({ title: 'Copié !' });
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast({ variant: 'destructive', title: 'Erreur' });
    }
  };

  const getStudentName = (id: string | null) => {
    if (!id) return null;
    const s = students.find((p) => p.id === id);
    return s?.full_name || s?.email || id.slice(0, 8);
  };

  const formDialog = (
    <Dialog open={createOpen || !!editingContent} onOpenChange={(open) => { if (!open) { setCreateOpen(false); setEditingContent(null); resetForm(); } }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editingContent ? 'Modifier le contenu' : 'Nouveau contenu'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {!editingContent && (
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
          )}
          <div className="space-y-2">
            <Label>Titre</Label>
            <Input value={formTitle} onChange={(e) => setFormTitle(e.target.value)} placeholder="Ex: Script premier message" />
          </div>
          <div className="space-y-2">
            <Label>Contenu</Label>
            <Textarea value={formBody} onChange={(e) => setFormBody(e.target.value)} rows={6} />
          </div>
          <div className="space-y-2">
            <Label>Catégorie</Label>
            <Select value={formCategory} onValueChange={setFormCategory}>
              <SelectTrigger><SelectValue placeholder="Aucune catégorie" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Aucune catégorie</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.slug}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {personas.length > 0 && (
            <div className="space-y-2">
              <Label>Persona / Cible (optionnel)</Label>
              <Select value={formPersonaId} onValueChange={setFormPersonaId}>
                <SelectTrigger><SelectValue placeholder="Aucune persona" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucune persona</SelectItem>
                  {personas.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {isCoachOrAdmin && (
            <>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="global" checked={formGlobal} onChange={(e) => { setFormGlobal(e.target.checked); if (e.target.checked) setFormTargetUserId('none'); }} className="rounded" />
                <Label htmlFor="global" className="text-sm">Global (visible par tous les élèves)</Label>
              </div>
              {!formGlobal && (
                <div className="space-y-2">
                  <Label>Assigner à un élève (optionnel)</Label>
                  <Select value={formTargetUserId} onValueChange={setFormTargetUserId}>
                    <SelectTrigger><SelectValue placeholder="Aucun — contenu personnel" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Aucun — contenu personnel</SelectItem>
                      {students.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.full_name || s.email}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </>
          )}
          <Button
            onClick={() => editingContent ? updateContent.mutate() : createContent.mutate()}
            disabled={!formTitle || !formBody || createContent.isPending || updateContent.isPending}
            className="w-full"
          >
            {editingContent ? 'Enregistrer' : 'Créer'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );

  return (
    <>
      <div className="p-4 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-md bg-primary/10 p-2">
              <BookOpen className="h-5 w-5 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Bibliothèque</h1>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setCategoryMgmtOpen(true)}>
              <Settings2 className="mr-1.5 h-4 w-4" /> Catégories
            </Button>
            <Button onClick={() => { setFormType(tab as ContentType); resetForm(); setCreateOpen(true); }}>
              <Plus className="mr-2 h-4 w-4" /> Nouveau
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Rechercher..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[180px]">
              <FolderOpen className="h-4 w-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Catégorie" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes catégories</SelectItem>
              <SelectItem value="uncategorized">Sans catégorie</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.slug}>{cat.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {personas.length > 0 && (
            <Select value={personaFilter} onValueChange={setPersonaFilter}>
              <SelectTrigger className="w-[180px]">
                <Target className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Persona" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes personas</SelectItem>
                <SelectItem value="none">Sans persona</SelectItem>
                {personas.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="script">Scripts</TabsTrigger>
            <TabsTrigger value="objection">Objections</TabsTrigger>
            <TabsTrigger value="recommendation">Recommandations</TabsTrigger>
            <TabsTrigger value="coach_note">Notes coach</TabsTrigger>
          </TabsList>

          {(['script', 'objection', 'recommendation', 'coach_note'] as ContentType[]).map((type) => (
            <TabsContent key={type} value={type} className="mt-4">
              {isLoading ? (
                <div className="flex justify-center py-12">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
              ) : filteredContents.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Aucun contenu</p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredContents.map((c) => (
                    <Card key={c.id} className="cursor-pointer hover:shadow-md transition-shadow group" onClick={() => setSelectedContent(c)}>
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between gap-2">
                          <CardTitle className="text-sm font-medium line-clamp-2">{c.title}</CardTitle>
                          <div className="flex items-center gap-1 shrink-0">
                            {(c as any).category && (
                              <Badge variant="outline" className="text-xs">{getCategoryLabel((c as any).category)}</Badge>
                            )}
                            {c.is_global && <Badge variant="secondary" className="text-xs">Global</Badge>}
                            {c.target_user_id && <Badge variant="outline" className="text-xs">→ {getStudentName(c.target_user_id)}</Badge>}
                            {(c as any).persona_id && (() => { const p = personas.find((p) => p.id === (c as any).persona_id); return p ? <Badge variant="outline" className="text-xs"><Target className="h-3 w-3 mr-0.5" />{p.name}</Badge> : null; })()}
                            <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => handleCopy(c.body, c.id, e)}>
                              {copiedId === c.id ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-xs text-muted-foreground line-clamp-3">{c.body}</p>
                        <p className="text-xs text-muted-foreground mt-2">{format(new Date(c.created_at), 'dd/MM/yyyy')}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>

      {formDialog}

      {/* Detail modal */}
      <Dialog open={!!selectedContent} onOpenChange={() => setSelectedContent(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="flex items-center justify-between pr-8">
              <DialogTitle>{selectedContent?.title}</DialogTitle>
              {selectedContent && (
                <div className="flex gap-1">
                  {canEdit(selectedContent) && (
                    <>
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => openEdit(selectedContent)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="outline" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteConfirmId(selectedContent.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                  <Button variant="outline" size="sm" onClick={() => handleCopy(selectedContent.body, selectedContent.id)}>
                    {copiedId === selectedContent.id ? <><Check className="mr-1.5 h-3.5 w-3.5 text-green-600" /> Copié</> : <><Copy className="mr-1.5 h-3.5 w-3.5" /> Copier</>}
                  </Button>
                </div>
              )}
            </div>
          </DialogHeader>
          {selectedContent && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge>{CONTENT_TYPE_LABELS[selectedContent.type]}</Badge>
                {(selectedContent as any).category && <Badge variant="outline">{getCategoryLabel((selectedContent as any).category)}</Badge>}
                {selectedContent.is_global && <Badge variant="secondary">Global</Badge>}
                {selectedContent.target_user_id && <Badge variant="outline">→ {getStudentName(selectedContent.target_user_id)}</Badge>}
                {(selectedContent as any).persona_id && (() => { const p = personas.find((p) => p.id === (selectedContent as any).persona_id); return p ? <Badge variant="outline"><Target className="h-3 w-3 mr-0.5" />{p.name}</Badge> : null; })()}
              </div>
              <div className="whitespace-pre-wrap text-sm text-foreground bg-muted/50 rounded-md p-4 max-h-[50vh] overflow-auto">
                {selectedContent.body}
              </div>
              <p className="text-xs text-muted-foreground">Créé le {format(new Date(selectedContent.created_at), 'dd/MM/yyyy')}</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Supprimer ce contenu ?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Cette action est irréversible.</p>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>Annuler</Button>
            <Button variant="destructive" onClick={() => deleteConfirmId && deleteContent.mutate(deleteConfirmId)} disabled={deleteContent.isPending}>
              Supprimer
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Category Management Dialog */}
      <Dialog open={categoryMgmtOpen} onOpenChange={setCategoryMgmtOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Gérer les catégories</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Add new */}
            <div className="flex gap-2">
              <Input
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="Nouvelle catégorie..."
                onKeyDown={(e) => { if (e.key === 'Enter' && newCategoryName.trim()) createCategory.mutate(newCategoryName.trim()); }}
              />
              <Button
                onClick={() => newCategoryName.trim() && createCategory.mutate(newCategoryName.trim())}
                disabled={!newCategoryName.trim() || createCategory.isPending}
                size="sm"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {/* Existing categories */}
            <div className="space-y-2 max-h-[40vh] overflow-y-auto">
              {categories.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Aucune catégorie</p>
              ) : (
                categories.map((cat) => (
                  <div key={cat.id} className="flex items-center justify-between rounded-md border p-2.5">
                    {editingCategory?.id === cat.id ? (
                      <div className="flex gap-2 flex-1">
                        <Input
                          value={editCategoryName}
                          onChange={(e) => setEditCategoryName(e.target.value)}
                          className="h-8 text-sm"
                          autoFocus
                          onKeyDown={(e) => { if (e.key === 'Enter') updateCategory.mutate({ id: cat.id, name: editCategoryName }); if (e.key === 'Escape') setEditingCategory(null); }}
                        />
                        <Button size="sm" variant="outline" className="h-8" onClick={() => updateCategory.mutate({ id: cat.id, name: editCategoryName })}>
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <span className="text-sm font-medium">{cat.name}</span>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingCategory(cat); setEditCategoryName(cat.name); }}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteCategoryId(cat.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete category confirmation */}
      <Dialog open={!!deleteCategoryId} onOpenChange={() => setDeleteCategoryId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Supprimer cette catégorie ?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Les contenus associés passeront en "sans catégorie".</p>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setDeleteCategoryId(null)}>Annuler</Button>
            <Button variant="destructive" onClick={() => deleteCategoryId && deleteCategory.mutate(deleteCategoryId)} disabled={deleteCategory.isPending}>
              Supprimer
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function Library() {
  return <AppLayout><LibraryContent /></AppLayout>;
}
