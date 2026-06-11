import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSidebar } from '@/components/ui/sidebar';
import { Zap } from 'lucide-react';

export function FreePlanCard() {
  const { user } = useAuth();
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const navigate = useNavigate();
  const [plan, setPlan] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('memberships')
      .select('plan')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => setPlan(data?.plan ?? 'free'));
  }, [user?.id]);

  if (!plan || plan !== 'free') return null;
  if (collapsed) return null;

  return (
    <div className="mx-2 mb-2 rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Zap className="h-3.5 w-3.5 text-primary shrink-0" />
        <p className="text-xs font-semibold text-foreground">Plan Free</p>
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
