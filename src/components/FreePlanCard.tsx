import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useSidebar } from '@/components/ui/sidebar';
import { Zap } from 'lucide-react';

function daysLeft(endsAt: string | null): number | null {
  if (!endsAt) return null;
  const diff = new Date(endsAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export function FreePlanCard() {
  const { plan, trialEndsAt } = useAuth();
  const { state } = useSidebar();
  const navigate = useNavigate();

  if (plan !== 'free') return null;
  if (state === 'collapsed') return null;

  const days = daysLeft(trialEndsAt);
  const daysLabel = days === null
    ? null
    : days === 0
      ? 'Expire aujourd\'hui'
      : days === 1
        ? '1 jour restant'
        : `${days} jours restants`;

  return (
    <div className="mx-2 mb-2 rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Zap className="h-3.5 w-3.5 text-primary shrink-0" />
        <p className="text-xs font-semibold text-foreground">
          Essai gratuit
          {daysLabel && (
            <span className="font-normal text-muted-foreground"> · {daysLabel}</span>
          )}
        </p>
      </div>
      <p className="text-[11px] text-muted-foreground leading-snug">
        Passez en Pro pour débloquer toutes les fonctionnalités.
      </p>
      <Button
        size="sm"
        className="w-full h-7 text-xs"
        onClick={() => navigate('/settings?tab=facturation')}
      >
        Passer en Pro →
      </Button>
    </div>
  );
}
