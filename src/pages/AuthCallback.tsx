import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

export default function AuthCallback() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const processedRef = useRef(false);

  useEffect(() => {
    if (processedRef.current) return;
    processedRef.current = true;

    const handleCallback = async () => {
      try {
        // Wait for session to be available (set by lovableAuth or onAuthStateChange)
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError || !session?.user) {
          // Session may not be ready yet — listen for the auth state change
          const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, newSession) => {
              if (event === 'SIGNED_IN' && newSession?.user) {
                subscription.unsubscribe();
                await bootstrapAndRedirect(newSession.user.id, newSession.user.user_metadata?.full_name);
              }
            }
          );

          // Timeout: if no session after 8 seconds, redirect to login
          setTimeout(() => {
            subscription.unsubscribe();
            toast({ variant: 'destructive', title: 'Erreur', description: "Impossible de restaurer la session. Veuillez réessayer." });
            navigate('/login', { replace: true });
          }, 8000);
          return;
        }

        await bootstrapAndRedirect(session.user.id, session.user.user_metadata?.full_name);
      } catch (err) {
        console.error('Auth callback error:', err);
        toast({ variant: 'destructive', title: 'Erreur', description: String(err) });
        navigate('/login', { replace: true });
      }
    };

    const bootstrapAndRedirect = async (userId: string, fullName?: string | null) => {
      try {
        // Ensure profile + role + membership exist
        await supabase.rpc('bootstrap_current_user', { _full_name: fullName ?? null });
      } catch (err) {
        console.error('Bootstrap error (non-fatal):', err);
      }

      // Persist source from URL (Google OAuth doesn't carry metadata directly)
      const source = searchParams.get('source');
      if (source) {
        await supabase.auth.updateUser({ data: { source } });
        // No-op if `source` doesn't match an active row in `offers` (handles both email + Google OAuth)
        await supabase.rpc('activate_offer_trial');
      }

      // Fetch role to determine redirect target
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();

      const role = roleData?.role || 'user';

      navigate('/dashboard', { replace: true });
    };

    handleCallback();
  }, [navigate, toast]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
        <p className="text-muted-foreground">Connexion en cours…</p>
      </div>
    </div>
  );
}
