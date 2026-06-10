import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Loader2, MessageSquare, MailCheck } from 'lucide-react';

export default function Register() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      toast({ variant: 'destructive', title: 'Erreur', description: 'Le nom complet est requis.' });
      return;
    }
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
          data: { full_name: fullName },
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
          redirectTo: `${window.location.origin}/auth/callback`
        }
      });
      if (result.error) {
        toast({ variant: 'destructive', title: 'Erreur Google', description: String(result.error) });
        setGoogleLoading(false);
        return;
      }
      if (result.redirected) {
        return;
      }
      navigate('/auth/callback');
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
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary">
            <MessageSquare className="h-6 w-6 text-primary-foreground" />
          </div>
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
              <Label htmlFor="fullName">Nom complet</Label>
              <Input id="fullName" placeholder="Jean Dupont" value={fullName} onChange={(e) => setFullName(e.target.value)} required data-testid="register-fullname" />
            </div>
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
