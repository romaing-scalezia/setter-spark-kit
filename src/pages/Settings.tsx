import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import type { AppRole } from '@/contexts/AuthContext';
import { LinkedInIntegrationCard } from '@/components/LinkedInIntegrationCard';
import { WorkspaceContent } from '@/pages/Workspace';
import { BillingContent } from '@/pages/Billing';

const DEBUG_ROLES: AppRole[] = ['user', 'coach', 'admin'];

export default function SettingsPage() {
  const { user, profile, activeRole, refreshUserData, switchRole } = useAuth();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') ?? 'profil';
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [loading, setLoading] = useState(false);
  const [roleLoading, setRoleLoading] = useState<AppRole | null>(null);
  const [debugEnabled, setDebugEnabled] = useState(profile?.debug_role_switch_enabled ?? false);
  const [debugLoading, setDebugLoading] = useState(false);

  useEffect(() => {
    setFullName(profile?.full_name || '');
    setDebugEnabled(profile?.debug_role_switch_enabled ?? false);
  }, [profile?.full_name, profile?.debug_role_switch_enabled]);

  const handleSave = async () => {
    setLoading(true);
    const { error } = await supabase.from('profiles').update({ full_name: fullName }).eq('id', user!.id);
    if (error) {
      toast({ variant: 'destructive', title: 'Erreur', description: error.message });
    } else {
      await refreshUserData();
      toast({ title: 'Profil mis à jour' });
    }
    setLoading(false);
  };

  const handleToggleDebug = async (enabled: boolean) => {
    setDebugLoading(true);
    const { error } = await supabase.rpc('set_debug_role_access', {
      _target_user_id: user!.id,
      _enabled: enabled,
    });

    if (error) {
      toast({ variant: 'destructive', title: 'Action impossible', description: error.message });
    } else {
      setDebugEnabled(enabled);
      await refreshUserData();
      toast({ title: enabled ? 'Mode debug activé' : 'Mode debug désactivé' });
    }

    setDebugLoading(false);
  };

  const handleSwitchRole = async (role: AppRole) => {
    setRoleLoading(role);
    const { error } = await switchRole(role);
    if (error) {
      toast({ variant: 'destructive', title: 'Impossible de changer le rôle', description: error.message });
    } else {
      toast({ title: `Rôle actif : ${role}` });
    }
    setRoleLoading(null);
  };

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 space-y-4 max-w-3xl" data-testid="page-settings">
        <h1 className="text-2xl font-bold text-foreground">Paramètres</h1>

        <Tabs
          value={tab}
          onValueChange={(v) => setSearchParams({ tab: v }, { replace: true })}
        >
          <TabsList>
            <TabsTrigger value="profil">Profil</TabsTrigger>
            <TabsTrigger value="linkedin">Intégration LinkedIn</TabsTrigger>
            <TabsTrigger value="workspace">Espace de travail</TabsTrigger>
            <TabsTrigger value="facturation">Facturation</TabsTrigger>
          </TabsList>

          {/* Profil */}
          <TabsContent value="profil" className="space-y-6 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Profil</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input value={user?.email || ''} disabled />
                </div>
                <div className="space-y-2">
                  <Label>Nom complet</Label>
                  <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Rôle actuel</Label>
                  <Input value={activeRole} disabled />
                </div>
                <Button onClick={handleSave} disabled={loading} data-testid="settings-save">
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Enregistrer
                </Button>
              </CardContent>
            </Card>

            {activeRole === 'admin' && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Mode debug rôles</CardTitle>
                  <CardDescription>
                    Activez-le une fois pour pouvoir basculer rapidement entre user, coach et admin sur votre compte de test.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between rounded-md border p-4">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-foreground">Autoriser le switch de rôle</p>
                      <p className="text-sm text-muted-foreground">Réservé au compte admin de test.</p>
                    </div>
                    <Switch checked={debugEnabled} onCheckedChange={handleToggleDebug} disabled={debugLoading} />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {DEBUG_ROLES.map((role) => (
                      <Button
                        key={role}
                        type="button"
                        variant={activeRole === role ? 'default' : 'outline'}
                        disabled={!debugEnabled || roleLoading !== null}
                        onClick={() => handleSwitchRole(role)}
                        className="capitalize"
                      >
                        {roleLoading === role && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Switch to {role}
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* LinkedIn */}
          <TabsContent value="linkedin" className="mt-4">
            <LinkedInIntegrationCard />
          </TabsContent>

          {/* Espace de travail */}
          <TabsContent value="workspace" className="mt-4">
            <WorkspaceContent />
          </TabsContent>

          {/* Facturation */}
          <TabsContent value="facturation" className="mt-4">
            <BillingContent />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
