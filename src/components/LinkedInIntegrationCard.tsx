import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Linkedin } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUnipileAccount } from '@/hooks/useUnipileAccount';
import { useToast } from '@/hooks/use-toast';
import { LinkedInConnectDialog } from '@/components/LinkedInConnectDialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export function LinkedInIntegrationCard() {
  const { user } = useAuth();
  const { account, loading, refetch } = useUnipileAccount();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [connectOpen, setConnectOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!account?.account_id) {
      setDisplayName(null);
      return;
    }
    (async () => {
      const { data, error } = await supabase.functions.invoke('unipile-proxy', {
        body: { action: 'get_account', account_id: account.account_id },
      });
      if (cancelled) return;
      if (error) {
        setDisplayName(null);
        return;
      }
      const d = data as any;
      setDisplayName(d?.name ?? d?.display_name ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [account?.account_id]);

  const handleConnect = () => setConnectOpen(true);

  const handleDisconnect = async () => {
    if (!user) return;
    setBusy(true);
    const { error } = await (supabase.from('unipile_accounts' as any) as any)
      .delete()
      .eq('user_id', user.id);
    if (error) {
      toast({ variant: 'destructive', title: 'Erreur', description: error.message });
    } else {
      await refetch();
      toast({ title: 'LinkedIn déconnecté' });
    }
    setBusy(false);
  };

  const isConnected = account?.status === 'connected';
  const statusColor = isConnected ? 'bg-green-500' : 'bg-orange-500';
  const statusLabel = isConnected ? 'LinkedIn connecté' : 'LinkedIn déconnecté';

  return (
    <>
    <LinkedInConnectDialog
      open={connectOpen}
      onOpenChange={setConnectOpen}
      onSuccess={refetch}
    />
    <Card data-testid="settings-linkedin-card">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Linkedin className="h-4 w-4" />
          Intégration LinkedIn
        </CardTitle>
        <CardDescription>
          Connectez votre compte LinkedIn pour synchroniser vos conversations.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Chargement...
          </div>
        ) : account ? (
          <div className="flex items-center justify-between rounded-md border p-4">
            <div className="flex items-center gap-3">
              <span className={`inline-block h-2.5 w-2.5 rounded-full ${statusColor}`} aria-hidden />
              <div className="space-y-0.5">
                <p className="text-sm font-medium text-foreground">{statusLabel}</p>
                <p className="text-xs text-muted-foreground">
                  {displayName ?? account.account_id}
                </p>
              </div>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" disabled={busy} data-testid="settings-linkedin-disconnect">
                  {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Déconnecter
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Déconnecter LinkedIn ?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Vous devrez reconnecter votre compte pour synchroniser à nouveau vos conversations.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDisconnect}>Déconnecter</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        ) : (
          <Button onClick={handleConnect} disabled={busy} data-testid="settings-linkedin-connect">
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Connecter mon LinkedIn
          </Button>
        )}
      </CardContent>
    </Card>
    </Card>
    </>
  );
}