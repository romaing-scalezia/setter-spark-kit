import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Search, Loader2, ArrowLeft, Trash2, List, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { parseFunctionErrorBody } from '@/lib/functionsError';

interface ApolloPerson {
  id: string;
  first_name: string | null;
  last_name_obfuscated: string | null;
  title: string | null;
  has_email?: boolean;
  has_direct_phone?: string;
  organization?: { name: string | null } | null;
}

interface ApolloFilters {
  person_titles?: string[];
  person_not_titles?: string[];
  person_seniorities?: string[];
  person_locations?: string[];
  organization_locations?: string[];
  q_keywords?: string;
  organization_num_employees_ranges?: string[];
}

interface ProspectList {
  id: string;
  name: string;
  created_at: string;
  count: number;
}

interface ProspectListItem {
  id: string;
  linkedin_url: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  job_title: string | null;
  email: string | null;
}

const SENIORITIES: { value: string; label: string }[] = [
  { value: 'owner', label: 'Propriétaire' },
  { value: 'founder', label: 'Fondateur' },
  { value: 'c_suite', label: 'Direction (C-level)' },
  { value: 'partner', label: 'Associé' },
  { value: 'vp', label: 'Vice-président' },
  { value: 'head', label: 'Responsable' },
  { value: 'director', label: 'Directeur' },
  { value: 'manager', label: 'Manager' },
  { value: 'senior', label: 'Senior' },
  { value: 'entry', label: 'Débutant' },
  { value: 'intern', label: 'Stagiaire' },
];

async function callApolloFn(name: string, body: object) {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    const parsed = await parseFunctionErrorBody(error);
    throw new Error((parsed?.error as string) || error.message);
  }
  if (data?.error) throw new Error(typeof data.error === 'string' ? data.error : JSON.stringify(data.error));
  return data;
}

export function RechercheContent() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<'search' | 'lists'>('search');

  // ── Recherche ────────────────────────────────────────────────
  const [naturalQuery, setNaturalQuery] = useState('');
  const [titlesInput, setTitlesInput] = useState('');
  const [excludeTitlesInput, setExcludeTitlesInput] = useState('');
  const [seniority, setSeniority] = useState('');
  const [personLocationsInput, setPersonLocationsInput] = useState('');
  const [orgLocationsInput, setOrgLocationsInput] = useState('');
  const [keywordsInput, setKeywordsInput] = useState('');
  const [employeeRangeInput, setEmployeeRangeInput] = useState('');
  const [page, setPage] = useState(1);

  const [people, setPeople] = useState<ApolloPerson[]>([]);
  const [totalEntries, setTotalEntries] = useState<number | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const syncInputsFromFilters = (f: ApolloFilters) => {
    setTitlesInput((f.person_titles ?? []).join(', '));
    setExcludeTitlesInput((f.person_not_titles ?? []).join(', '));
    setSeniority((f.person_seniorities ?? [])[0] ?? '');
    setPersonLocationsInput((f.person_locations ?? []).join(', '));
    setOrgLocationsInput((f.organization_locations ?? []).join(', '));
    setKeywordsInput(f.q_keywords ?? '');
    setEmployeeRangeInput((f.organization_num_employees_ranges ?? [])[0] ?? '');
  };

  const buildFiltersFromInputs = (): ApolloFilters => {
    const f: ApolloFilters = {};
    const split = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);
    if (titlesInput.trim()) f.person_titles = split(titlesInput);
    if (excludeTitlesInput.trim()) f.person_not_titles = split(excludeTitlesInput);
    if (seniority) f.person_seniorities = [seniority];
    if (personLocationsInput.trim()) f.person_locations = split(personLocationsInput);
    if (orgLocationsInput.trim()) f.organization_locations = split(orgLocationsInput);
    if (keywordsInput.trim()) f.q_keywords = keywordsInput.trim();
    if (employeeRangeInput.trim()) f.organization_num_employees_ranges = [employeeRangeInput.trim()];
    return f;
  };

  const runSearch = useMutation({
    mutationFn: async ({ query, filters, targetPage }: { query?: string; filters?: ApolloFilters; targetPage: number }) =>
      callApolloFn('apollo-search', { query, filters, page: targetPage, per_page: 25 }),
    onSuccess: (data) => {
      syncInputsFromFilters(data.filters ?? {});
      setPeople(data.people ?? []);
      setTotalEntries(data.total_entries ?? 0);
      setSelected(new Set());
    },
    onError: (e: Error) => toast({ variant: 'destructive', title: 'Erreur de recherche', description: e.message }),
  });

  const handleNaturalSearch = () => {
    if (!naturalQuery.trim()) return;
    setPage(1);
    runSearch.mutate({ query: naturalQuery.trim(), targetPage: 1 });
  };

  const handleManualSearch = (targetPage = 1) => {
    setPage(targetPage);
    runSearch.mutate({ filters: buildFiltersFromInputs(), targetPage });
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // ── Mes listes ───────────────────────────────────────────────
  const { data: lists = [], isLoading: listsLoading } = useQuery({
    queryKey: ['prospect-lists'],
    queryFn: async (): Promise<ProspectList[]> => {
      const { data: listsData, error } = await (supabase as any).from('prospect_lists').select('id, name, created_at').order('created_at', { ascending: false });
      if (error) throw error;
      const { data: itemsData } = await (supabase as any).from('prospect_list_items').select('list_id');
      const counts = new Map<string, number>();
      (itemsData ?? []).forEach((i: any) => counts.set(i.list_id, (counts.get(i.list_id) ?? 0) + 1));
      return (listsData ?? []).map((l: any) => ({ ...l, count: counts.get(l.id) ?? 0 }));
    },
  });

  const [viewingListId, setViewingListId] = useState<string | null>(null);
  const { data: listItems = [] } = useQuery({
    queryKey: ['prospect-list-items', viewingListId],
    queryFn: async (): Promise<ProspectListItem[]> => {
      const { data, error } = await (supabase as any).from('prospect_list_items').select('*').eq('list_id', viewingListId).order('added_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!viewingListId,
  });

  const deleteListItem = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await (supabase as any).from('prospect_list_items').delete().eq('id', itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prospect-list-items', viewingListId] });
      queryClient.invalidateQueries({ queryKey: ['prospect-lists'] });
    },
  });

  const deleteList = useMutation({
    mutationFn: async (listId: string) => {
      const { error } = await (supabase as any).from('prospect_lists').delete().eq('id', listId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Liste supprimée' });
      setViewingListId(null);
      queryClient.invalidateQueries({ queryKey: ['prospect-lists'] });
    },
  });

  // ── Ajout à une liste (déclenche l'enrichissement) ────────────
  const [addToListOpen, setAddToListOpen] = useState(false);
  const [targetListId, setTargetListId] = useState('__new__');
  const [newListName, setNewListName] = useState('');

  const addToList = useMutation({
    mutationFn: async () => {
      const apollo_ids = Array.from(selected);
      const payload: Record<string, unknown> = { apollo_ids };
      if (targetListId === '__new__') payload.new_list_name = newListName.trim();
      else payload.list_id = targetListId;
      return callApolloFn('apollo-enrich', payload);
    },
    onSuccess: (data) => {
      toast({
        title: `${data.added.length} prospect${data.added.length > 1 ? 's' : ''} ajouté${data.added.length > 1 ? 's' : ''}`,
        description: data.errors.length > 0 ? `${data.errors.length} n'ont pas pu être enrichis` : `Crédits utilisés : ${data.enrichments_used}/${data.safety_cap}`,
      });
      setPeople((prev) => prev.filter((p) => !selected.has(p.id)));
      setSelected(new Set());
      setAddToListOpen(false);
      setNewListName('');
      setTargetListId('__new__');
      queryClient.invalidateQueries({ queryKey: ['prospect-lists'] });
    },
    onError: (e: Error) => toast({ variant: 'destructive', title: 'Erreur', description: e.message }),
  });

  const viewedList = lists.find((l) => l.id === viewingListId);

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-md bg-primary/10 p-2">
            <Search className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Recherche de prospects</h1>
            <p className="text-sm text-muted-foreground">Via Apollo — outil interne, mode test</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant={tab === 'search' ? 'default' : 'outline'} size="sm" onClick={() => setTab('search')}>
            <Search className="h-3.5 w-3.5 mr-1.5" /> Recherche
          </Button>
          <Button variant={tab === 'lists' ? 'default' : 'outline'} size="sm" onClick={() => { setTab('lists'); setViewingListId(null); }}>
            <List className="h-3.5 w-3.5 mr-1.5" /> Mes listes ({lists.length})
          </Button>
        </div>
      </div>

      {tab === 'search' && (
        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">
          {/* Filtres */}
          <Card className="h-fit">
            <CardHeader><CardTitle className="text-sm">Filtres</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Postes (séparés par virgule)</Label>
                <Input value={titlesInput} onChange={(e) => setTitlesInput(e.target.value)} placeholder="sales director, VP sales" className="text-xs h-8" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Exclure des postes (séparés par virgule)</Label>
                <Input value={excludeTitlesInput} onChange={(e) => setExcludeTitlesInput(e.target.value)} placeholder="assistant, stagiaire" className="text-xs h-8" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Niveau hiérarchique</Label>
                <Select value={seniority || '__any__'} onValueChange={(v) => setSeniority(v === '__any__' ? '' : v)}>
                  <SelectTrigger className="text-xs h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__any__">Tous niveaux</SelectItem>
                    {SENIORITIES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Localisation (personne)</Label>
                <Input value={personLocationsInput} onChange={(e) => setPersonLocationsInput(e.target.value)} placeholder="France, Belgique" className="text-xs h-8" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Localisation (entreprise)</Label>
                <Input value={orgLocationsInput} onChange={(e) => setOrgLocationsInput(e.target.value)} placeholder="France" className="text-xs h-8" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Taille entreprise (min,max)</Label>
                <Input value={employeeRangeInput} onChange={(e) => setEmployeeRangeInput(e.target.value)} placeholder="10,200" className="text-xs h-8" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Mots-clés</Label>
                <Input value={keywordsInput} onChange={(e) => setKeywordsInput(e.target.value)} placeholder="SaaS B2B" className="text-xs h-8" />
              </div>
              <Button size="sm" className="w-full" onClick={() => handleManualSearch(1)} disabled={runSearch.isPending}>
                {runSearch.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Rechercher avec ces filtres'}
              </Button>
            </CardContent>
          </Card>

          {/* Résultats */}
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={naturalQuery}
                onChange={(e) => setNaturalQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleNaturalSearch()}
                placeholder="Ex : Directeurs commerciaux dans des SaaS B2B de 10-200 personnes en France"
                className="flex-1"
              />
              <Button onClick={handleNaturalSearch} disabled={runSearch.isPending || !naturalQuery.trim()}>
                {runSearch.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>

            {totalEntries !== null && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{totalEntries.toLocaleString('fr-FR')} résultats trouvés (Apollo n'expose pas le nom complet ni le LinkedIn avant import)</p>
                {selected.size > 0 && (
                  <Button size="sm" onClick={() => setAddToListOpen(true)}>
                    <Users className="h-3.5 w-3.5 mr-1.5" /> Ajouter à une liste ({selected.size})
                  </Button>
                )}
              </div>
            )}

            {people.length > 0 && (
              <div className="rounded-xl border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead className="w-8"></TableHead>
                      <TableHead>Prénom / Nom</TableHead>
                      <TableHead>Poste</TableHead>
                      <TableHead>Entreprise</TableHead>
                      <TableHead>Email</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {people.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>
                          <Checkbox checked={selected.has(p.id)} onCheckedChange={() => toggleSelect(p.id)} />
                        </TableCell>
                        <TableCell className="text-sm">{p.first_name} {p.last_name_obfuscated}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{p.title ?? '—'}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{p.organization?.name ?? '—'}</TableCell>
                        <TableCell>{p.has_email ? <Badge variant="secondary" className="text-[10px]">dispo</Badge> : <span className="text-xs text-muted-foreground">—</span>}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {totalEntries !== null && totalEntries > 25 && (
              <div className="flex items-center justify-center gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1 || runSearch.isPending} onClick={() => handleManualSearch(page - 1)}>Précédent</Button>
                <span className="text-xs text-muted-foreground">Page {page}</span>
                <Button variant="outline" size="sm" disabled={people.length < 25 || runSearch.isPending} onClick={() => handleManualSearch(page + 1)}>Suivant</Button>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'lists' && !viewedList && (
        listsLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : lists.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-12">Aucune liste — importe des prospects depuis l'onglet Recherche.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {lists.map((l) => (
              <Card key={l.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setViewingListId(l.id)}>
                <CardContent className="pt-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{l.name}</p>
                    <p className="text-xs text-muted-foreground">{l.count} prospect{l.count > 1 ? 's' : ''}</p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={(e) => { e.stopPropagation(); deleteList.mutate(l.id); }}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )
      )}

      {tab === 'lists' && viewedList && (
        <Card>
          <CardHeader className="flex flex-row items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setViewingListId(null)}><ArrowLeft className="h-4 w-4" /></Button>
            <CardTitle className="text-base">{viewedList.name} ({listItems.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {listItems.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Liste vide</p>
            ) : (
              <div className="space-y-1.5">
                {listItems.map((it) => (
                  <div key={it.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                    <div>
                      <p className="text-sm font-medium">{it.first_name} {it.last_name}</p>
                      <p className="text-xs text-muted-foreground">{it.job_title} {it.company_name ? `· ${it.company_name}` : ''}</p>
                      <a href={it.linkedin_url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">LinkedIn ↗</a>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteListItem.mutate(it.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={addToListOpen} onOpenChange={setAddToListOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Ajouter {selected.size} prospect{selected.size > 1 ? 's' : ''} à une liste</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Ça déclenche l'enrichissement Apollo (récupération du LinkedIn) — consomme des crédits réels.</p>
            <Select value={targetListId} onValueChange={setTargetListId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__new__">+ Nouvelle liste</SelectItem>
                {lists.map((l) => <SelectItem key={l.id} value={l.id}>{l.name} ({l.count})</SelectItem>)}
              </SelectContent>
            </Select>
            {targetListId === '__new__' && (
              <Input value={newListName} onChange={(e) => setNewListName(e.target.value)} placeholder="Nom de la nouvelle liste" />
            )}
          </div>
          <DialogFooter>
            <Button
              onClick={() => addToList.mutate()}
              disabled={addToList.isPending || (targetListId === '__new__' && !newListName.trim())}
            >
              {addToList.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              Confirmer et enrichir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function RecherchePage() {
  return <AppLayout><RechercheContent /></AppLayout>;
}
