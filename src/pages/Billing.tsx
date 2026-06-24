import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { usePlan } from '@/hooks/usePlan';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Shield, Zap, ExternalLink } from 'lucide-react';

const STATUS_LABELS: Record<string, string> = {
  active: 'Actif',
  trialing: 'Essai gratuit',
  canceled: 'Annulé',
  past_due: 'Paiement en retard',
  incomplete: 'Incomplet',
};

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  trialing: 'bg-primary/10 text-primary border-primary/20',
  canceled: 'bg-red-50 text-red-700 border-red-200',
  past_due: 'bg-orange-50 text-orange-700 border-orange-200',
  incomplete: 'bg-muted text-muted-foreground border-border',
};

const PLAN_LABELS: Record<string, string> = {
  free: 'Essai gratuit',
  starter: 'SetterFlow — 30€/mois',
  pro: 'Pro',
  coach: 'Coach',
};

export function BillingContent() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { session } = useAuth();
  const { plan, membershipStatus, isActive, isTrialing, trialDaysLeft } = usePlan();
  const [portalLoading, setPortalLoading] = useState(false);

  const handlePortal = async () => {
    if (!session) return;
    setPortalLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('stripe-portal', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error || !data?.url) throw new Error(error?.message ?? 'Erreur');
      window.location.href = data.url;
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erreur', description: String(err) });
      setPortalLoading(false);
    }
  };

  const statusKey = membershipStatus ?? 'trialing';

  return (
    <div className="space-y-4 max-w-2xl">
      <Card className="border-primary/20">
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
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-lg font-semibold">{PLAN_LABELS[plan] ?? plan}</p>
              <p className="text-sm text-muted-foreground">
                {isTrialing
                  ? `${trialDaysLeft} jour${trialDaysLeft > 1 ? 's' : ''} d'essai restant${trialDaysLeft > 1 ? 's' : ''}`
                  : isActive
                  ? 'Abonnement actif · Sans engagement'
                  : 'Aucun abonnement actif'}
              </p>
            </div>
            <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[statusKey] ?? STATUS_STYLES.incomplete}`}>
              {STATUS_LABELS[statusKey] ?? statusKey}
            </span>
          </div>

          <div className="flex gap-2 flex-wrap pt-1">
            {isActive ? (
              <Button variant="outline" size="sm" onClick={handlePortal} disabled={portalLoading}>
                {portalLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ExternalLink className="h-4 w-4 mr-2" />}
                Gérer mon abonnement
              </Button>
            ) : (
              <Button size="sm" onClick={() => navigate('/pricing')} className="gap-2">
                <Zap className="h-4 w-4" />
                {isTrialing ? 'Passer à l\'abonnement' : 'S\'abonner'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function BillingPage() {
  return <AppLayout><div className="p-4 sm:p-6"><BillingContent /></div></AppLayout>;
}
