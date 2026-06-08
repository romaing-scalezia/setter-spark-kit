import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Users, Plus, Trash2, UserPlus, LogOut, Loader2, Info } from 'lucide-react';

interface Workspace { id: string; name: string; owner_id: string }
interface Member { workspace_id: string; user_id: string; role: string }
interface Profile { id: string; full_name: string | null; email: string | null }

export default function WorkspacePage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [newName, setNewName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');

  const { data: workspaces = [], isLoading } = useQuery({
    queryKey: ['my-workspaces', user?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from('workspaces').select('id, name, owner_id');
      if (error) throw error;
      return (data || []) as Workspace[];
    },
    enabled: !!user,
  });

  const { data: members = [] } = useQuery({
    queryKey: ['my-workspace-members', workspaces.map((w) => w.id).join(',')],
    queryFn: async () => {
      if (workspaces.length === 0) return [] as Member[];
      const { data, error } = await (supabase as any)
        .from('workspace_members')
        .select('workspace_id, user_id, role')
        .in('workspace_id', workspaces.map((w) => w.id));
      if (error) throw error;
      return (data || []) as Member[];
    },
    enabled: workspaces.length > 0,
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ['ws-member-profiles', members.map((m) => m.user_id).join(',')],
    queryFn: async () => {
      const ids = Array.from(new Set(members.map((m) => m.user_id)));
      if (ids.length === 0) return [] as Profile[];
      const { data, error } = await supabase.from('profiles').select('id, full_name, email').in('id', ids);
      if (error) throw error;
      return (data || []) as Profile[];
    },
    enabled: members.length > 0,
  });

  const createWs = useMutation({
    mutationFn: async (name: string) => {
      if (!user) throw new Error('not authenticated');
      const { data, error } = await (supabase as any)
        .from('workspaces')
        .insert({ name, owner_id: user.id })
        .select()
        .single();
      if (error) throw error;
      // self-add as member
      await (supabase as any).from('workspace_members').insert({ workspace_id: data.id, user_id: user.id, role: 'owner' });
      return data;
    },
    onSuccess: () => {
      toast.success('Workspace créé');
      setNewName('');
      qc.invalidateQueries({ queryKey: ['my-workspaces'] });
      qc.invalidateQueries({ queryKey: ['teammates'] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteWs = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('workspaces').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Workspace supprimé');
      qc.invalidateQueries({ queryKey: ['my-workspaces'] });
      qc.invalidateQueries({ queryKey: ['teammates'] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const invite = useMutation({
    mutationFn: async ({ wsId, email }: { wsId: string; email: string }) => {
      const { data: prof, error: pErr } = await supabase.from('profiles').select('id').eq('email', email).maybeSingle();
      if (pErr) throw pErr;
      if (!prof) throw new Error("Aucun utilisateur trouvé avec cet email");
      const { error } = await (supabase as any)
        .from('workspace_members')
        .insert({ workspace_id: wsId, user_id: prof.id, role: 'member' });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Membre ajouté');
      setInviteEmail('');
      qc.invalidateQueries({ queryKey: ['my-workspace-members'] });
      qc.invalidateQueries({ queryKey: ['teammates'] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const removeMember = useMutation({
    mutationFn: async ({ wsId, userId }: { wsId: string; userId: string }) => {
      const { error } = await (supabase as any).from('workspace_members').delete()
        .eq('workspace_id', wsId).eq('user_id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-workspace-members'] });
      qc.invalidateQueries({ queryKey: ['teammates'] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const profileMap = new Map(profiles.map((p) => [p.id, p]));

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 space-y-6 max-w-4xl">
        <div className="flex items-center gap-3">
          <div className="rounded-md bg-primary/10 p-2"><Users className="h-5 w-5 text-primary" /></div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Mon workspace</h1>
            <p className="text-sm text-muted-foreground">
              Travaillez à plusieurs sur le même compte LinkedIn. Optionnel — laissez vide pour rester en solo.
            </p>
          </div>
        </div>

        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="py-3 flex items-start gap-3">
            <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <p className="text-sm">
              Un workspace est <strong>explicite</strong> : créez-en un et invitez vos coéquipiers manuellement.
              Sans workspace, l'app fonctionne en mode solo classique.
            </p>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            {workspaces.length === 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Créer un workspace</CardTitle>
                  <CardDescription>Donnez un nom à votre équipe pour commencer.</CardDescription>
                </CardHeader>
                <CardContent className="flex gap-2">
                  <Input placeholder="Nom de l'équipe" value={newName} onChange={(e) => setNewName(e.target.value)} />
                  <Button onClick={() => createWs.mutate(newName)} disabled={!newName.trim() || createWs.isPending}>
                    <Plus className="h-4 w-4 mr-1" /> Créer
                  </Button>
                </CardContent>
              </Card>
            )}

            {workspaces.map((w) => {
              const wsMembers = members.filter((m) => m.workspace_id === w.id);
              const isOwner = w.owner_id === user?.id;
              return (
                <Card key={w.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <CardTitle className="text-base">{w.name}</CardTitle>
                        <CardDescription>
                          {isOwner ? 'Vous êtes propriétaire' : 'Membre'} · {wsMembers.length} membre{wsMembers.length > 1 ? 's' : ''}
                        </CardDescription>
                      </div>
                      {isOwner && (
                        <Button size="sm" variant="ghost" className="text-destructive"
                          onClick={() => confirm('Supprimer ce workspace ?') && deleteWs.mutate(w.id)}>
                          <Trash2 className="h-4 w-4 mr-1" /> Supprimer
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      {wsMembers.map((m) => {
                        const p = profileMap.get(m.user_id);
                        return (
                          <div key={m.user_id} className="flex items-center justify-between border rounded-md p-2">
                            <div className="flex items-center gap-2">
                              <span className="text-sm">{p?.full_name || p?.email || m.user_id.slice(0, 8)}</span>
                              {m.user_id === w.owner_id && <Badge variant="secondary">Owner</Badge>}
                            </div>
                            {isOwner && m.user_id !== w.owner_id && (
                              <Button size="sm" variant="ghost" onClick={() => removeMember.mutate({ wsId: w.id, userId: m.user_id })}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                            {!isOwner && m.user_id === user?.id && (
                              <Button size="sm" variant="ghost" onClick={() => removeMember.mutate({ wsId: w.id, userId: m.user_id })}>
                                <LogOut className="h-4 w-4 mr-1" /> Quitter
                              </Button>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {isOwner && (
                      <div className="space-y-2 pt-2 border-t">
                        <Label className="text-xs">Inviter par email (utilisateur existant)</Label>
                        <div className="flex gap-2">
                          <Input placeholder="email@example.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
                          <Button onClick={() => invite.mutate({ wsId: w.id, email: inviteEmail })}
                            disabled={!inviteEmail.trim() || invite.isPending}>
                            <UserPlus className="h-4 w-4 mr-1" /> Inviter
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </>
        )}
      </div>
    </AppLayout>
  );
}
