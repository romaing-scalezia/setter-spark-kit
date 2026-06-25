import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { usePlan } from '@/hooks/usePlan';
import { AppLayout } from '@/components/AppLayout';
import { Loader2, Check } from 'lucide-react';

const FEATURES = [
  'Connexion LinkedIn',
  'Inbox LinkedIn centralisée',
  'Campagnes LinkedIn illimitées',
  'Gestion des leads & Pipeline',
  'Suivi des performances',
  'Bibliothèque de scripts',
  'Import/Export des prospects',
];

function LogoMark() {
  return (
    <svg viewBox="0 0 48 48" fill="none" style={{ width: 28, height: 28 }} aria-hidden="true">
      <rect width="48" height="48" rx="12" fill="#5851E8" />
      <path d="M14 34V20l10-6 10 6v14l-10 6-10-6Z" stroke="#fff" strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M14 20l10 6 10-6M24 26v14" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

export default function Pricing() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { session } = useAuth();
  const { isTrialing, trialDaysLeft, trialExpired } = usePlan();
  const [loading, setLoading] = useState(false);

  const handleSubscribe = async () => {
    if (!session) { navigate('/login'); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('stripe-checkout', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error || !data?.url) throw new Error(error?.message ?? 'Erreur');
      window.location.href = data.url;
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erreur', description: String(err) });
      setLoading(false);
    }
  };

  return (
    <AppLayout>
    <div className="min-h-[calc(100vh-3.5rem)] bg-[#F5F5F7] flex flex-col">
      {/* Main */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-3xl space-y-8 text-center">
          {/* Heading */}
          <div className="space-y-3">
            {isTrialing && trialExpired && (
              <p className="text-sm font-medium text-destructive">Votre période d'essai est terminée</p>
            )}
            <h1 className="text-4xl sm:text-5xl font-bold text-foreground leading-tight">
              Automatisez votre<br />
              <span className="text-primary">prospection LinkedIn</span>
            </h1>
            <p className="text-muted-foreground text-lg">
              {isTrialing && !trialExpired
                ? `Il vous reste ${trialDaysLeft} jour${trialDaysLeft > 1 ? 's' : ''} d'essai gratuit.`
                : 'Passez à l\'abonnement pour continuer à utiliser SetterFlow.'}
            </p>
          </div>

          {/* Card */}
          <div className="rounded-2xl overflow-hidden shadow-lg border border-border/50 flex flex-col sm:flex-row bg-white text-left">
            {/* Left — price + CTA */}
            <div className="sm:w-72 shrink-0 bg-primary/5 p-8 flex flex-col gap-6">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary text-xs font-semibold px-3 py-1">
                  🔥 Choix des top performers
                </span>
              </div>

              <div>
                <div className="flex items-baseline gap-1">
                  <span className="text-5xl font-bold text-foreground">30€</span>
                  <span className="text-muted-foreground text-sm">/mois</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Sans engagement · Résiliable à tout moment</p>
              </div>

              <div className="space-y-3 flex-1">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-white text-primary text-xs font-medium px-3 py-1">
                  🎉 14 jours d'essai gratuit
                </span>
                <p className="text-xs text-muted-foreground">Sans carte bancaire requise pour l'essai</p>
              </div>

              <button
                onClick={handleSubscribe}
                disabled={loading}
                className="w-full rounded-xl bg-primary text-primary-foreground font-semibold py-3.5 text-sm flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-70"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {isTrialing && !trialExpired ? 'Passer à l\'abonnement' : '14j d\'essai gratuit'}
              </button>

              <p className="text-[10px] text-center text-muted-foreground">
                Paiement sécurisé par Stripe
              </p>
            </div>

            {/* Right — features */}
            <div className="flex-1 p-8 space-y-6">
              <div>
                <h2 className="text-xl font-bold text-foreground">Tout ce qu'il vous faut pour closer</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Un seul outil pour gérer toute votre prospection LinkedIn.
                </p>
              </div>

              <ul className="space-y-3">
                {FEATURES.map((f) => (
                  <li key={f} className="flex items-center gap-3 text-sm text-foreground">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10">
                      <Check className="h-3 w-3 text-primary" strokeWidth={2.5} />
                    </span>
                    {f}
                  </li>
                ))}
              </ul>

              {isTrialing && !trialExpired && (
                <button
                  onClick={() => navigate(-1)}
                  className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
                >
                  Retourner à l'application
                </button>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
    </AppLayout>
  );
}
