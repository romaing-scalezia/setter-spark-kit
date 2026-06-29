import { useState, useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

type Step = 'idle' | 'waiting';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const LINKEDIN_ICON = (
  <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-xl bg-[#0A66C2]">
    <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
    </svg>
  </div>
);

export function LinkedInConnectDialog({ open, onOpenChange, onSuccess }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>('idle');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const popupRef = useRef<Window | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function stopPolling() {
    if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
  }

  function resetState() {
    setStep('idle');
    setLoading(false);
    setError(null);
    stopPolling();
    if (popupRef.current && !popupRef.current.closed) popupRef.current.close();
    popupRef.current = null;
  }

  useEffect(() => {
    if (!open) resetState();
  }, [open]);

  useEffect(() => () => { stopPolling(); }, []);

  function startPolling() {
    pollingRef.current = setInterval(async () => {
      // Si l'utilisateur a fermé la popup manuellement
      if (popupRef.current?.closed) {
        stopPolling();
        setStep('idle');
        setLoading(false);
        return;
      }

      if (!user) return;
      try {
        const { data } = await (supabase.from('unipile_accounts' as any) as any)
          .select('account_id, status')
          .eq('user_id', user.id)
          .eq('status', 'connected')
          .maybeSingle();

        if (data?.account_id) {
          stopPolling();
          if (popupRef.current && !popupRef.current.closed) popupRef.current.close();
          popupRef.current = null;
          onSuccess();
          onOpenChange(false);
          toast({ title: 'LinkedIn connecté !', description: 'Ton compte LinkedIn est maintenant synchronisé.' });
        }
      } catch { /* ignore */ }
    }, 2000);
  }

  async function handleConnect() {
    setError(null);
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('unipile-proxy', {
        body: {
          action: 'hosted_auth',
          notify_url: `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/unipile-webhook`,
          success_redirect_url: `${window.location.origin}/settings?tab=integration&linkedin=success`,
          failure_redirect_url: `${window.location.origin}/settings?tab=integration&linkedin=error`,
        },
      });
      if (error) throw new Error(error.message);
      const url = (data as any)?.url;
      if (!url) throw new Error('URL manquante dans la réponse Unipile');

      // Calcule le centre de l'écran pour la popup
      const w = 520, h = 680;
      const left = Math.round(window.screenX + (window.outerWidth - w) / 2);
      const top = Math.round(window.screenY + (window.outerHeight - h) / 2);

      const popup = window.open(
        url,
        'linkedin-auth',
        `width=${w},height=${h},left=${left},top=${top},resizable=yes,scrollbars=yes`
      );

      if (!popup) {
        throw new Error('Popup bloquée par le navigateur. Autorise les popups pour ce site puis réessaie.');
      }

      popupRef.current = popup;
      setStep('waiting');
      startPolling();
    } catch (err: any) {
      setError(err.message ?? 'Une erreur est survenue.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetState(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md">
        {step === 'idle' ? (
          <>
            <DialogHeader className="items-center text-center">
              {LINKEDIN_ICON}
              <DialogTitle className="text-xl font-bold">Se connecter avec LinkedIn</DialogTitle>
              <DialogDescription>
                Une fenêtre sécurisée s'ouvrira pour authentifier votre compte LinkedIn.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 pt-2">
              {error && <p className="text-sm text-destructive text-center">{error}</p>}

              <Button className="w-full" onClick={handleConnect} disabled={loading}>
                {loading
                  ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  : <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                }
                Connecter mon compte LinkedIn
              </Button>

              <p className="text-center text-xs text-muted-foreground">
                Tes identifiants ne transitent jamais par SetterFlow.
              </p>
            </div>
          </>
        ) : (
          <>
            <DialogHeader className="items-center text-center">
              {LINKEDIN_ICON}
              <DialogTitle className="text-xl font-bold">Authentification en cours…</DialogTitle>
              <DialogDescription>
                Connecte-toi dans la fenêtre qui vient de s'ouvrir. Cette modale se fermera automatiquement une fois la connexion établie.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col items-center gap-5 py-4">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground text-center">
                En attente de confirmation LinkedIn…
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  stopPolling();
                  if (popupRef.current && !popupRef.current.closed) popupRef.current.close();
                  popupRef.current = null;
                  setStep('idle');
                }}
              >
                Annuler
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
