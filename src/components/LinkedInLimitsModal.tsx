import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Minus, Plus, Loader2, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const RECOMMENDED_MAX = 30;

interface LimitRowProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
}

function LimitRow({ label, value, onChange }: LimitRowProps) {
  const overLimit = value > RECOMMENDED_MAX;

  const handleInputChange = (raw: string) => {
    const n = parseInt(raw, 10);
    onChange(Number.isNaN(n) ? 0 : Math.max(0, n));
  };

  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}</Label>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9 shrink-0"
          onClick={() => onChange(Math.max(0, value - 1))}
        >
          <Minus className="h-4 w-4" />
        </Button>
        <Input
          type="number"
          min={0}
          value={value}
          onChange={(e) => handleInputChange(e.target.value)}
          className={cn(
            'text-center',
            overLimit && 'border-primary focus-visible:ring-primary',
          )}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9 shrink-0"
          onClick={() => onChange(value + 1)}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      {overLimit && (
        <p className="text-xs text-primary">Limite recommandée : {RECOMMENDED_MAX} max</p>
      )}
    </div>
  );
}

interface LinkedInLimitsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LinkedInLimitsModal({ open, onOpenChange }: LinkedInLimitsModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [visits, setVisits] = useState(20);
  const [invites, setInvites] = useState(20);
  const [messages, setMessages] = useState(20);

  useEffect(() => {
    if (!open || !user) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from('memberships')
        .select('visits_daily_limit, invites_daily_limit, messages_daily_limit')
        .eq('user_id', user.id)
        .maybeSingle();
      if (cancelled) return;
      if (!error && data) {
        setVisits(data.visits_daily_limit);
        setInvites(data.invites_daily_limit);
        setMessages(data.messages_daily_limit);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, user]);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase.rpc('set_linkedin_daily_limits', {
      p_visits: visits,
      p_invites: invites,
      p_messages: messages,
    });
    setSaving(false);
    if (error) {
      toast({ variant: 'destructive', title: 'Erreur', description: error.message });
      return;
    }
    toast({ title: 'Limites mises à jour' });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Gérer mes limites LinkedIn</DialogTitle>
          <DialogDescription>
            Nombre maximum d'actions LinkedIn automatisées par 24h.
          </DialogDescription>
        </DialogHeader>

        <Alert className="border-primary/30 bg-primary/10 text-primary">
          <AlertTriangle className="h-4 w-4 !text-primary" />
          <AlertDescription className="text-primary">
            LinkedIn peut suspendre ou restreindre votre compte à vie si vous effectuez trop
            d'actions par jour. Assurez-vous de respecter les limites recommandées.
          </AlertDescription>
        </Alert>

        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <div className="space-y-4 py-1">
            <LimitRow label="Nombre maximum de visites LinkedIn par 24h" value={visits} onChange={setVisits} />
            <LimitRow label="Nombre maximal d'invitations LinkedIn envoyées par 24h" value={invites} onChange={setInvites} />
            <LimitRow label="Nombre maximal de messages LinkedIn envoyés par 24h" value={messages} onChange={setMessages} />
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
