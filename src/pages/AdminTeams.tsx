import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/AppLayout';
import { KpiCard } from '@/components/KpiCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Users, UserCheck, Search, Loader2, Eye, Info } from 'lucide-react';

const RESPONDED = new Set(['en_cours', 'appel_propose', 'follow_up', 'rendez_vous_booke']);
const CALLS = new Set(['appel_propose', 'rendez_vous_booke']);
const RDV = new Set(['rendez_vous_booke']);

interface Profile { id: string; full_name: string | null; email: string | null }
interface Workspace { id: string; name: string; owner_id: string; created_at: string }
interface Member { workspace_id: string; user_id: string; role: string }

const labelOf = (p?: Profile) => p ? (p.full_name || p.email || p.id.slice(0, 8)) : '—';
const initials = (s: string) => s.slice(0, 2).toUpperCase();

export default function AdminTeamsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const { data: profiles = [] } = useQuery({
    queryKey: ['admin-profiles-ws'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('id, full_name, email');
      if (error) throw error;
      return (data || []) as Profile[];
    },
  });

  const { data: workspaces = [], isLoading: wLoad } = useQuery({
    queryKey: ['admin-workspaces'],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from('workspaces').select('id, name, owner_id, created_at');
      if (error) throw error;
      return (data || []) as Workspace[];
    },
  });

  const { data: members = [], isLoading: mLoad } = useQuery({
    queryKey: ['admin-workspace-members'],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from('workspace_members').select('workspace_id, user_id, role');
      if (error) throw error;
      return (data || []) as Member[];
    },
  });

  const { data: leads = [], isLoading: lLoad } = useQuery({
    queryKey: ['admin-leads-ws'],
    queryFn: async () => {
      const { data, error } = await supabase.from('leads').select('id, owner_id, setter_id, status');
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const profileMap = useMemo(() => {
    const m = new Map<string, Profile>();
    profiles.forEach((p) => m.set(p.id, p));
    return m;
  }, [profiles]);

  const teams = useMemo(() => {
    return workspaces.map((w) => {
      const memberIds = members.filter((m) => m.workspace_id === w.id).map((m) => m.user_id);
      const memberSet = new Set(memberIds);
      const teamLeads = leads.filter((l: any) => memberSet.has(l.owner_id));
      const bySetter = new Map<string, { conv: number; resp: number; calls: number; rdv: number }>();
      memberIds.forEach((id) => bySetter.set(id, { conv: 0, resp: 0, calls: 0, rdv: 0 }));
      teamLeads.forEach((l: any) => {
        const sid = l.setter_id || l.owner_id;
        if (!bySetter.has(sid)) bySetter.set(sid, { conv: 0, resp: 0, calls: 0, rdv: 0 });
        const r = bySetter.get(sid)!;
        r.conv += 1;
        if (RESPONDED.has(l.status)) r.resp += 1;
        if (CALLS.has(l.status)) r.calls += 1;
        if (RDV.has(l.status)) r.rdv += 1;
      });
      return {
        ...w,
        members: memberIds,
        leadCount: teamLeads.length,
        rdvCount: teamLeads.filter((l: any) => RDV.has(l.status)).length,
        breakdown: Array.from(bySetter.entries()).map(([sid, s]) => ({ sid, ...s })).sort((a, b) => b.rdv - a.rdv),
      };
    });
  }, [workspaces, members, leads]);

  const filteredTeams = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return teams;
    return teams.filter((t) =>
      t.name.toLowerCase().includes(q) ||
      labelOf(profileMap.get(t.owner_id)).toLowerCase().includes(q) ||
      t.members.some((m) => labelOf(profileMap.get(m)).toLowerCase().includes(q))
    );
  }, [teams, search, profileMap]);

  const isLoading = wLoad || mLoad || lLoad;

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 space-y-6" data-testid="page-admin-teams">
        <div className="flex items-center gap-3">
          <div className="rounded-md bg-primary/10 p-2"><Users className="h-5 w-5 text-primary" /></div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Workspaces / Équipes</h1>
            <p className="text-sm text-muted-foreground">
              Équipes explicites créées par les utilisateurs. Ne sont PAS dérivées des assignations coach.
            </p>
          </div>
        </div>

        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="py-3 flex items-start gap-3">
            <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <p className="text-sm text-foreground">
              Les équipes sont désormais des entités explicites. Un utilisateur n'appartient à une équipe que s'il
              l'a créée ou s'il y a été ajouté manuellement. Partager un coach ne crée plus de groupe.
            </p>
          </CardContent>
        </Card>

        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <KpiCard title="Workspaces" value={teams.length} icon={<Users className="h-4 w-4" />} />
          <KpiCard title="Membres total" value={teams.reduce((a, t) => a + t.members.length, 0)} icon={<UserCheck className="h-4 w-4" />} />
          <KpiCard title="Équipes multi-membres" value={teams.filter((t) => t.members.length > 1).length} icon={<Users className="h-4 w-4" />} />
          <KpiCard title="Utilisateurs solo" value={profiles.length - new Set(members.map((m) => m.user_id)).size} icon={<Users className="h-4 w-4" />} />
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher équipe ou membre..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="grid gap-4">
            {filteredTeams.length === 0 && (
              <Card><CardContent className="py-10 text-center text-muted-foreground">
                Aucun workspace n'a encore été créé. Les utilisateurs peuvent en créer un depuis leurs paramètres.
              </CardContent></Card>
            )}
            {filteredTeams.map((t) => {
              const owner = profileMap.get(t.owner_id);
              return (
                <Card key={t.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10"><AvatarFallback className="bg-primary/10 text-primary">{initials(t.name)}</AvatarFallback></Avatar>
                        <div>
                          <CardTitle className="text-base">{t.name}</CardTitle>
                          <p className="text-xs text-muted-foreground">
                            Owner: {labelOf(owner)} · {t.members.length} membre{t.members.length > 1 ? 's' : ''}
                            {t.members.length > 1 && <Badge className="ml-2" variant="secondary">Équipe</Badge>}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-3 items-center">
                        <div className="text-right"><p className="text-xs text-muted-foreground">Leads</p><p className="text-lg font-semibold">{t.leadCount}</p></div>
                        <div className="text-right"><p className="text-xs text-muted-foreground">RDV</p><p className="text-lg font-semibold text-primary">{t.rdvCount}</p></div>
                        <Button size="sm" variant="outline" onClick={() => navigate(`/leads?team=${t.members.join(',')}`)}>
                          <Eye className="h-4 w-4 mr-1" /> Leads équipe
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead><tr className="text-left text-xs text-muted-foreground border-b">
                          <th className="py-2 pr-3 font-medium">Membre</th>
                          <th className="py-2 px-2 text-center font-medium">Conv.</th>
                          <th className="py-2 px-2 text-center font-medium">Réponses</th>
                          <th className="py-2 px-2 text-center font-medium">Appels</th>
                          <th className="py-2 px-2 text-center font-medium">RDV</th>
                        </tr></thead>
                        <tbody>
                          {t.breakdown.map((r) => {
                            const p = profileMap.get(r.sid);
                            return (
                              <tr key={r.sid} className="border-b last:border-0">
                                <td className="py-2 pr-3"><div className="flex items-center gap-2">
                                  <Avatar className="h-6 w-6"><AvatarFallback className="text-[10px] bg-muted">{initials(labelOf(p))}</AvatarFallback></Avatar>
                                  <span>{labelOf(p)}</span>
                                </div></td>
                                <td className="py-2 px-2 text-center">{r.conv}</td>
                                <td className="py-2 px-2 text-center">{r.resp}</td>
                                <td className="py-2 px-2 text-center">{r.calls}</td>
                                <td className="py-2 px-2 text-center font-medium text-primary">{r.rdv}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
