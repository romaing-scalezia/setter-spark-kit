import { useState, useEffect, useRef } from 'react';
import { Loader2, Eye, EyeOff, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Step = 'credentials' | 'checkpoint';
type CheckpointType = '2FA' | 'OTP' | 'IN_APP_VALIDATION' | 'PHONE_REGISTER';

const CHECKPOINT_TIMEOUT_S = 5 * 60;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const LinkedInLogo = () => (
  <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-xl bg-[#0A66C2]">
    <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
    </svg>
  </div>
);

export function LinkedInConnectDialog({ open, onOpenChange, onSuccess }: Props) {
  const { toast } = useToast();

  const [step, setStep] = useState<Step>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [checkpointType, setCheckpointType] = useState<CheckpointType | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [timeLeft, setTimeLeft] = useState(CHECKPOINT_TIMEOUT_S);

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function stopPolling() {
    if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
  }
  function stopTimer() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }

  function resetState() {
    setStep('credentials');
    setEmail('');
    setPassword('');
    setShowPassword(false);
    setLoading(false);
    setError(null);
    setCheckpointType(null);
    setAccountId(null);
    setCode('');
    setTimeLeft(CHECKPOINT_TIMEOUT_S);
    stopPolling();
    stopTimer();
  }

  useEffect(() => { if (!open) resetState(); }, [open]);
  useEffect(() => () => { stopPolling(); stopTimer(); }, []);

  function startTimer() {
    stopTimer();
    setTimeLeft(CHECKPOINT_TIMEOUT_S);
    timerRef.current = setInterval(() => {
      setTimeLeft(t => { if (t <= 1) { stopTimer(); return 0; } return t - 1; });
    }, 1000);
  }

  function startInAppPolling(accId: string) {
    stopPolling();
    pollingRef.current = setInterval(async () => {
      try {
        const { data } = await supabase.functions.invoke('unipile-proxy', {
          body: { action: 'get_account_status', account_id: accId },
        });
        // Unipile returns { AccountStatus: { message: "OK" } } or { connection_status: "OK" }
        const msg =
          (data as any)?.AccountStatus?.message ??
          (data as any)?.connection_status ??
          (data as any)?.status;
        if (msg === 'OK' || msg === 'connected' || msg === 'CONNECTED') {
          stopPolling(); stopTimer();
          // Upsert unipile_accounts — IN_APP_VALIDATION bypasses create_account upsert
          await supabase.functions.invoke('unipile-proxy', {
            body: { action: 'confirm_account', account_id: accId },
          });
          onSuccess(); onOpenChange(false);
          toast({ title: 'LinkedIn connecté !' });
        }
      } catch { /* ignore */ }
    }, 3000);
  }

  function enterCheckpoint(type: CheckpointType, accId: string) {
    setCheckpointType(type);
    setAccountId(accId);
    setCode('');
    setError(null);
    setStep('checkpoint');
    startTimer();
    if (type === 'IN_APP_VALIDATION') startInAppPolling(accId);
  }

  function handleSuccess() {
    stopPolling(); stopTimer();
    onSuccess(); onOpenChange(false);
    toast({ title: 'LinkedIn connecté !', description: 'Ton compte LinkedIn est maintenant synchronisé.' });
  }

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('unipile-proxy', {
        body: { action: 'create_account', username: email, password },
      });
      if (error) throw new Error(error.message);
      const d = data as any;
      if (d?.object === 'AccountCreated') {
        handleSuccess();
      } else if (d?.object === 'Checkpoint') {
        enterCheckpoint(d.checkpoint?.type as CheckpointType, d.account_id);
      } else {
        throw new Error(d?.details?.message ?? d?.error ?? 'Identifiants incorrects ou réponse inattendue.');
      }
    } catch (err: any) {
      setError(err.message ?? 'Une erreur est survenue.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSolveCheckpoint(e: React.FormEvent) {
    e.preventDefault();
    if (!accountId) return;
    setError(null);
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('unipile-proxy', {
        body: { action: 'solve_checkpoint', account_id: accountId, code },
      });
      if (error) throw new Error(error.message);
      const d = data as any;
      if (d?.object === 'AccountCreated') {
        handleSuccess();
      } else if (d?.object === 'Checkpoint') {
        enterCheckpoint(d.checkpoint?.type as CheckpointType, accountId);
      } else {
        throw new Error(d?.details?.message ?? d?.error ?? 'Code incorrect ou expiré.');
      }
    } catch (err: any) {
      setError(err.message ?? 'Code invalide. Réessaie.');
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (!accountId) return;
    try {
      await supabase.functions.invoke('unipile-proxy', {
        body: { action: 'resend_checkpoint', account_id: accountId },
      });
      setTimeLeft(CHECKPOINT_TIMEOUT_S);
      toast({ title: 'Code renvoyé' });
    } catch {
      toast({ variant: 'destructive', title: 'Impossible de renvoyer le code' });
    }
  }

  async function handleTryAnotherWay() {
    if (!accountId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('unipile-proxy', {
        body: { action: 'solve_checkpoint', account_id: accountId, code: 'TRY_ANOTHER_WAY' },
      });
      if (error) throw new Error(error.message);
      const d = data as any;
      if (d?.object === 'Checkpoint') {
        stopPolling();
        setCode('');
        setCheckpointType(d.checkpoint?.type as CheckpointType);
        if (d.checkpoint?.type === 'IN_APP_VALIDATION') startInAppPolling(accountId);
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erreur', description: err.message });
    } finally {
      setLoading(false);
    }
  }

  const timerLabel = timeLeft > 0
    ? `${Math.floor(timeLeft / 60)}:${String(timeLeft % 60).padStart(2, '0')}`
    : 'Expiré';

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetState(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md">

        {step === 'credentials' && (
          <>
            <DialogHeader className="items-center text-center">
              <LinkedInLogo />
              <DialogTitle className="text-xl font-bold">Se connecter avec LinkedIn</DialogTitle>
              <DialogDescription>Saisissez les identifiants de votre compte LinkedIn.</DialogDescription>
            </DialogHeader>

            <form onSubmit={handleConnect} className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label htmlFor="li-email">E-mail LinkedIn</Label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-foreground">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                  </span>
                  <Input id="li-email" type="email" placeholder="email@exemple.com" value={email} onChange={e => setEmail(e.target.value)} className="pl-9" required autoComplete="email" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="li-password">Mot de passe LinkedIn</Label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-foreground">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  </span>
                  <Input id="li-password" type={showPassword ? 'text' : 'password'} placeholder="••••••••••••" value={password} onChange={e => setPassword(e.target.value)} className="pl-9 pr-24" required autoComplete="current-password" />
                  <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute inset-y-0 right-3 flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    {showPassword ? 'Masquer' : 'Afficher'}
                  </button>
                </div>
              </div>

              {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

              <Button type="submit" className="w-full" disabled={loading || !email || !password}>
                {loading
                  ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  : <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>}
                Se connecter
              </Button>

              <p className="text-center text-xs text-muted-foreground">
                Tu utilises Google pour te connecter à LinkedIn ?{' '}
                <a href="https://www.linkedin.com/psettings/sign-in-and-security" target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2">Crée d'abord un mot de passe LinkedIn</a>
              </p>
            </form>
          </>
        )}

        {step === 'checkpoint' && (
          <>
            <DialogHeader className="items-center text-center">
              <LinkedInLogo />
              <DialogTitle className="text-xl font-bold">Vérification LinkedIn</DialogTitle>
              <DialogDescription>
                {checkpointType === 'IN_APP_VALIDATION' ? "LinkedIn attend une confirmation depuis ton application mobile."
                  : checkpointType === 'PHONE_REGISTER' ? "Entre ton numéro de téléphone pour recevoir un code."
                  : "Entre le code de vérification envoyé par LinkedIn."}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 pt-2">
              {checkpointType === 'IN_APP_VALIDATION' ? (
                <div className="flex flex-col items-center gap-4 py-2">
                  <Loader2 className="h-10 w-10 animate-spin text-primary" />
                  <p className="text-center text-sm text-muted-foreground">Ouvre l'app LinkedIn sur ton téléphone et confirme la connexion.</p>
                  <Button variant="outline" size="sm" onClick={handleTryAnotherWay} disabled={loading}>Utiliser un code à la place</Button>
                </div>
              ) : (
                <form onSubmit={handleSolveCheckpoint} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="li-code">{checkpointType === 'PHONE_REGISTER' ? 'Numéro de téléphone' : 'Code de vérification'}</Label>
                    <Input id="li-code" type={checkpointType === 'PHONE_REGISTER' ? 'tel' : 'text'} placeholder={checkpointType === 'PHONE_REGISTER' ? '+33 6 12 34 56 78' : '123456'} value={code} onChange={e => setCode(e.target.value)} required autoFocus inputMode={checkpointType === 'PHONE_REGISTER' ? 'tel' : 'numeric'} />
                  </div>
                  {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
                  <Button type="submit" className="w-full" disabled={loading || !code}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Valider
                  </Button>
                </form>
              )}

              <div className="flex items-center justify-between border-t pt-3">
                <span className="text-xs text-muted-foreground">
                  Expire dans <span className={timeLeft < 60 ? 'font-medium text-destructive' : ''}>{timerLabel}</span>
                </span>
                {checkpointType !== 'IN_APP_VALIDATION' && (
                  <button type="button" onClick={handleResend} className="flex items-center gap-1 text-xs text-primary hover:underline">
                    <RefreshCw className="h-3 w-3" /> Renvoyer
                  </button>
                )}
              </div>

              <button type="button" onClick={resetState} className="flex w-full items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
                Recommencer
              </button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
