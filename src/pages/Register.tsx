import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Loader2, MailCheck } from 'lucide-react';

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const source = searchParams.get('source') ?? 'organic';

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast({ variant: 'destructive', title: 'Erreur', description: 'Le mot de passe doit contenir au moins 6 caractères.' });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { source },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) {
        let description = error.message;
        if (error.message.includes('already registered') || error.message.includes('already exists')) {
          description = 'Un compte existe déjà avec cet email. Essayez de vous connecter.';
        }
        toast({ variant: 'destructive', title: "Erreur d'inscription", description });
      } else if (data.session) {
        // Auto-confirm enabled: user is logged in immediately
        navigate('/dashboard');
      } else if (data.user && !data.session) {
        // Email confirmation required — show confirmation screen
        setEmailSent(true);
      }
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erreur inattendue', description: String(err) });
    }
    setLoading(false);
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback?source=${source}`,
        },
      });
      if (error) {
        toast({ variant: 'destructive', title: 'Erreur Google', description: String(error.message) });
        setGoogleLoading(false);
        return;
      }
      // Success: supabase-js already redirected the browser to Google.
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erreur Google', description: String(err) });
      setGoogleLoading(false);
    }
  };

  // Confirmation screen after signup
  if (emailSent) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <MailCheck className="h-7 w-7 text-primary" />
            </div>
            <CardTitle className="text-2xl font-bold">Vérifiez votre email</CardTitle>
            <CardDescription className="text-base mt-2">
              Un email de confirmation a été envoyé à <span className="font-medium text-foreground">{email}</span>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p className="text-sm text-muted-foreground">
              Cliquez sur le lien dans l'email pour activer votre compte et accéder à SetterFlow.
            </p>
            <p className="text-sm text-muted-foreground">
              Vous n'avez pas reçu l'email ? Vérifiez vos spams ou{' '}
              <button
                type="button"
                onClick={() => setEmailSent(false)}
                className="text-primary hover:underline font-medium"
              >
                réessayez
              </button>.
            </p>
            <Separator />
            <p className="text-sm text-muted-foreground">
              Déjà confirmé ?{' '}
              <Link to="/login" className="text-primary hover:underline font-medium">Se connecter</Link>
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4" data-testid="page-register">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" width="150" height="34" viewBox="0 0 150 34" fill="none">
              <rect x="0" y="0" width="34" height="34" rx="10" fill="#5851E8"/>
              <g transform="translate(6.5 6.5) scale(0.4375)">
                <path d="M32.5 13.5C32.5 9.5 16 9 16 16.8C16 22.6 32 22.9 32 30C32 37.8 16 37.8 16 33.4" stroke="#FFFFFF" strokeWidth="3.4" strokeLinecap="round" fill="none"/>
                <circle cx="32.5" cy="13.5" r="4" fill="#FFFFFF"/>
                <circle cx="24" cy="23.6" r="4" fill="#FFFFFF"/>
                <circle cx="16" cy="33.4" r="4.6" fill="#FFFFFF"/>
              </g>
              <path d="M45.78 13.46C45.78 15.70 47.08 17.12 49.56 17.66L51.88 18.18C53.08 18.44 53.58 19.02 53.58 20C53.58 21.22 52.50 21.96 50.80 21.96C49.16 21.96 48.16 21.22 48.14 19.98L45.58 19.98C45.64 22.60 47.68 24.26 50.80 24.26C54.02 24.26 56.14 22.50 56.14 19.78C56.14 17.60 54.92 16.32 52.42 15.78L50.12 15.28C48.90 15 48.34 14.42 48.34 13.38C48.34 12.16 49.36 11.40 50.94 11.40C52.38 11.40 53.28 12.14 53.34 13.40L55.90 13.40C55.82 10.76 53.94 9.12 50.98 9.12C47.90 9.12 45.78 10.90 45.78 13.46ZM62.12 24.26C64.70 24.26 66.50 22.96 66.92 20.80L64.66 20.80C64.38 21.74 63.50 22.26 62.16 22.26C60.54 22.26 59.62 21.38 59.44 19.64L66.88 19.62L66.88 18.88C66.88 15.80 65 13.82 62.04 13.82C59.14 13.82 57.12 15.96 57.12 19.06C57.12 22.12 59.18 24.26 62.12 24.26ZM62.06 15.82C63.52 15.82 64.46 16.72 64.46 18.08L59.50 18.08C59.74 16.60 60.62 15.82 62.06 15.82ZM71.80 24L71.80 16.16L73.72 16.16L73.72 14.12L71.80 14.12L71.80 11.04L69.36 11.04L69.36 14.12L67.46 14.12L67.46 16.16L69.36 16.16L69.36 24ZM78.20 24L78.20 16.16L80.12 16.16L80.12 14.12L78.20 14.12L78.20 11.04L75.76 11.04L75.76 14.12L73.86 14.12L73.86 16.16L75.76 16.16L75.76 24ZM85.66 24.26C88.24 24.26 90.04 22.96 90.46 20.80L88.20 20.80C87.92 21.74 87.04 22.26 85.70 22.26C84.08 22.26 83.16 21.38 82.98 19.64L90.42 19.62L90.42 18.88C90.42 15.80 88.54 13.82 85.58 13.82C82.68 13.82 80.66 15.96 80.66 19.06C80.66 22.12 82.72 24.26 85.66 24.26ZM85.60 15.82C87.06 15.82 88 16.72 88 18.08L83.04 18.08C83.28 16.60 84.16 15.82 85.60 15.82ZM98.18 14.08C97.78 13.98 97.44 13.94 97.10 13.94C95.78 13.94 94.84 14.60 94.42 15.58L94.28 14.14L91.98 14.14L91.98 24L94.42 24L94.42 19.20C94.42 17.28 95.52 16.34 97.28 16.34L98.18 16.34Z" fill="#5851E8"/>
              <path d="M107.80 18.02L107.80 15.72L102.36 15.72L102.36 11.74L108.84 11.74L108.84 9.38L99.80 9.38L99.80 24L102.36 24L102.36 18.02ZM112.84 24L112.84 9.12L110.42 9.12L110.42 24ZM114.42 19.04C114.42 22.12 116.64 24.24 119.70 24.24C122.76 24.24 124.98 22.12 124.98 19.04C124.98 15.96 122.76 13.84 119.70 13.84C116.64 13.84 114.42 15.96 114.42 19.04ZM116.86 19.04C116.86 17.24 118.02 16.02 119.70 16.02C121.38 16.02 122.54 17.24 122.54 19.04C122.54 20.84 121.38 22.06 119.70 22.06C118.02 22.06 116.86 20.84 116.86 19.04ZM128.70 24L131.08 24L132.44 19.76C132.94 18.14 133.12 17.44 133.22 16.98C133.30 17.48 133.52 18.42 133.92 19.72L135.28 24L137.56 24L140.98 14.12L138.40 14.12L137.08 18.36C136.90 18.98 136.58 20.16 136.42 20.90C136.30 20.24 135.90 18.76 135.78 18.36L134.46 14.12L131.98 14.12L130.62 18.36C130.30 19.34 130.12 19.96 129.94 20.92C129.76 20 129.56 19.14 129.34 18.36L128.04 14.12L125.50 14.12Z" fill="#15161A"/>
              <path d="M143.70 24.24C144.58 24.24 145.32 23.52 145.32 22.66C145.32 21.78 144.58 21.06 143.70 21.06C142.82 21.06 142.08 21.78 142.08 22.66C142.08 23.52 142.82 24.24 143.70 24.24Z" fill="#5851E8"/>
            </svg>
          </div>
          <CardTitle className="sr-only">SetterFlow</CardTitle>
          <CardTitle className="text-2xl font-bold">Créer un compte</CardTitle>
          <CardDescription>Rejoignez SetterFlow</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button variant="outline" className="w-full" onClick={handleGoogleLogin} disabled={googleLoading}>
            {googleLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            )}
            Continuer avec Google
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center"><Separator /></div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">ou</span>
            </div>
          </div>

          <form onSubmit={handleRegister} className="space-y-4" data-testid="register-form">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="vous@exemple.com" value={email} onChange={(e) => setEmail(e.target.value)} required data-testid="register-email" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <Input id="password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} data-testid="register-password" />
            </div>
            <Button type="submit" className="w-full" disabled={loading} data-testid="register-submit">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              S'inscrire
            </Button>
          </form>
          <p className="text-center text-sm text-muted-foreground">
            Déjà un compte ?{' '}
            <Link to="/login" className="text-primary hover:underline">Se connecter</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
