import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Shield } from 'lucide-react';

export function BillingContent() {
  const { user } = useAuth();
  const [membership, setMembership] = useState<{ plan: string; status: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('memberships')
      .select('plan, status')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        setMembership(data ?? { plan: 'free', status: 'active' });
        setLoading(false);
      });
  }, [user]);

  return (
    <>
      <div className="space-y-6 max-w-3xl">

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Shield className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base">Plan actuel</CardTitle>
                  <CardDescription>Votre abonnement SetterFlow</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="space-y-1">
                  <p className="text-lg font-semibold capitalize">{membership?.plan ?? 'free'}</p>
                  <p className="text-sm text-muted-foreground">
                    Accès complet à toutes les fonctionnalités actuelles.
                  </p>
                </div>
                <Badge variant="secondary" className="ml-auto capitalize">
                  {membership?.status ?? 'active'}
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}

export default function BillingPage() {
  return <AppLayout><div className="p-4 sm:p-6"><BillingContent /></div></AppLayout>;
}
