import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, ArrowRight, Target, BookOpen, LayoutGrid, Zap, Check, Settings } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const PROFILE_STEPS = 5;
const TOUR_STEPS = 4;
const TOTAL_STEPS = PROFILE_STEPS + TOUR_STEPS;

const BUSINESS_TYPES = [
  'Agence marketing',
  'Agence web / dev',
  'Agence communication',
  'Consultant',
  'Coach',
  'Freelance',
  'SaaS',
  'Cabinet (RH, finance, juridique…)',
  'Formation / infoproduit',
  'Startup',
  'Autre',
];

const INDUSTRIES = [
  'Marketing / communication',
  'Tech / SaaS',
  'Immobilier',
  'Finance',
  'RH / recrutement',
  'Éducation / formation',
  'BTP / industrie',
  'Événementiel',
  'Conseil / service B2B',
  'Autre',
];

const REVENUES = [
  '0 – 2K',
  '2K – 5K',
  '5K – 10K',
  '10K – 20K',
  '20K – 50K',
  '50K – 100K',
  '+100K',
];

const VOLUMES = [
  'Pas encore de prospection',
  '< 5 conversations/jour',
  '5–10 conversations/jour',
  '10–20 conversations/jour',
  '20+ conversations/jour',
];

interface TourSlide {
  icon: React.ElementType;
  accentClass: string;
  bgClass: string;
  title: string;
  subtitle: string;
  features: string[];
  isLinkedIn?: boolean;
}

const TOUR_SLIDES: TourSlide[] = [
  {
    icon: Target,
    accentClass: 'text-violet-600',
    bgClass: 'bg-violet-50 dark:bg-violet-950/30',
    title: 'Les Personas, votre boussole',
    subtitle: 'Définissez votre client idéal une bonne fois pour toutes.',
    features: [
      'Décrivez votre ICP en quelques lignes',
      'Personnalisez vos campagnes selon le profil cible',
      'Mesurez les résultats par audience',
    ],
  },
  {
    icon: BookOpen,
    accentClass: 'text-blue-600',
    bgClass: 'bg-blue-50 dark:bg-blue-950/30',
    title: 'La Bibliothèque, vos messages prêts à l\'emploi',
    subtitle: 'Centralisez tous vos templates pour ne jamais repartir de zéro.',
    features: [
      'Réutilisez vos meilleurs messages en un clic',
      'Insérez des variables dynamiques (prénom, entreprise…)',
      'Testez et conservez ce qui convertit le mieux',
    ],
  },
  {
    icon: LayoutGrid,
    accentClass: 'text-emerald-600',
    bgClass: 'bg-emerald-50 dark:bg-emerald-950/30',
    title: 'Le CRM, votre pipeline de prospects',
    subtitle: 'Suivez chaque contact, du premier message au rendez-vous.',
    features: [
      'Ajoutez des prospects manuellement ou depuis l\'inbox LinkedIn',
      'Suivez l\'avancement de chaque lead en temps réel',
      'Ne laissez plus aucune opportunité sans suivi',
    ],
  },
  {
    icon: Zap,
    accentClass: 'text-amber-600',
    bgClass: 'bg-amber-50 dark:bg-amber-950/30',
    title: 'Connectez LinkedIn pour tout débloquer',
    subtitle: 'La connexion LinkedIn est le moteur de SetterFlow.',
    features: [
      'Inbox LinkedIn intégrée directement dans l\'app',
      'Utilisation de vos templates depuis les conversations',
      'Campagnes de prospection entièrement automatisées',
      'Création automatique de prospects dans le CRM',
    ],
    isLinkedIn: true,
  },
];

export default function Onboarding() {
  const { user, refreshUserData } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Profile fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [industry, setIndustry] = useState('');
  const [monthlyRevenue, setMonthlyRevenue] = useState('');
  const [prospectingVolume, setProspectingVolume] = useState('');

  const isProfileStep = step <= PROFILE_STEPS;
  const tourSlide = isProfileStep ? null : TOUR_SLIDES[step - PROFILE_STEPS - 1];
  const isLastStep = step === TOTAL_STEPS;

  const canNext = useCallback(() => {
    if (!isProfileStep) return true;
    switch (step) {
      case 1: return !!(firstName.trim() && lastName.trim());
      case 2: return !!businessType;
      case 3: return !!industry;
      case 4: return !!monthlyRevenue;
      case 5: return !!prospectingVolume;
      default: return true;
    }
  }, [step, isProfileStep, firstName, lastName, businessType, industry, monthlyRevenue, prospectingVolume]);

  const handleNext = async () => {
    if (!canNext()) return;

    // At end of profile steps: save profile data and move to tour
    if (step === PROFILE_STEPS) {
      setSaving(true);
      try {
        if (!user) return;
        const { error } = await supabase.from('profiles').update({
          full_name: `${firstName.trim()} ${lastName.trim()}`,
          business_type: businessType,
          industry,
          monthly_revenue: monthlyRevenue,
          prospecting_volume: prospectingVolume,
        }).eq('id', user.id);
        if (error) throw error;
        setStep(s => s + 1);
      } catch (err: any) {
        toast({ title: 'Erreur', description: err.message || 'Une erreur est survenue', variant: 'destructive' });
      } finally {
        setSaving(false);
      }
      return;
    }

    // Last tour slide: mark onboarding complete
    if (isLastStep) {
      setSaving(true);
      try {
        if (!user) return;
        const { error } = await supabase.from('profiles').update({
          onboarding_completed: true,
        }).eq('id', user.id);
        if (error) throw error;
        await refreshUserData();
        navigate('/personas', { replace: true });
      } catch (err: any) {
        toast({ title: 'Erreur', description: err.message || 'Une erreur est survenue', variant: 'destructive' });
      } finally {
        setSaving(false);
      }
      return;
    }

    setStep(s => s + 1);
  };

  const progress = (step / TOTAL_STEPS) * 100;

  const profileTitles: Record<number, string> = {
    1: 'Comment vous appelez-vous ?',
    2: "Quel est votre type d'activité ?",
    3: 'Dans quel secteur évoluez-vous ?',
    4: "Quel est votre chiffre d'affaires mensuel ?",
    5: 'Quel est votre volume de prospection ?',
  };

  const profileSubtitles: Record<number, string> = {
    1: 'Pour personnaliser votre expérience.',
    2: "Cela nous aide à adapter l'outil à votre activité.",
    3: 'Pour cibler les bonnes opportunités.',
    4: 'Pour calibrer vos objectifs.',
    5: 'Pour optimiser votre pipeline.',
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4" data-testid="page-onboarding">
      <div className="w-full max-w-lg space-y-6">
        {/* Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Étape {step}/{TOTAL_STEPS}</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        <Card className="border-0 shadow-lg">
          <CardContent className="pt-8 pb-8 px-8 space-y-6">

            {/* ── PROFILE STEPS (1–5) ── */}
            {isProfileStep && (
              <>
                <div className="text-center space-y-2">
                  <h1 className="text-xl font-semibold text-foreground">{profileTitles[step]}</h1>
                  <p className="text-sm text-muted-foreground">{profileSubtitles[step]}</p>
                </div>

                <div className="space-y-4">
                  {step === 1 && (
                    <>
                      <div className="space-y-2">
                        <Label>Prénom</Label>
                        <Input autoFocus value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Votre prénom" onKeyDown={e => e.key === 'Enter' && canNext() && handleNext()} />
                      </div>
                      <div className="space-y-2">
                        <Label>Nom</Label>
                        <Input value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Votre nom" onKeyDown={e => e.key === 'Enter' && canNext() && handleNext()} />
                      </div>
                    </>
                  )}

                  {step === 2 && (
                    <div className="space-y-2">
                      <Label>Type d'activité</Label>
                      <Select value={businessType} onValueChange={setBusinessType}>
                        <SelectTrigger><SelectValue placeholder="Choisissez votre activité" /></SelectTrigger>
                        <SelectContent>
                          {BUSINESS_TYPES.map(bt => <SelectItem key={bt} value={bt}>{bt}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {step === 3 && (
                    <div className="space-y-2">
                      <Label>Secteur d'activité</Label>
                      <Select value={industry} onValueChange={setIndustry}>
                        <SelectTrigger><SelectValue placeholder="Choisissez votre secteur" /></SelectTrigger>
                        <SelectContent>
                          {INDUSTRIES.map(ind => <SelectItem key={ind} value={ind}>{ind}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {step === 4 && (
                    <div className="space-y-2">
                      <Label>Chiffre d'affaires mensuel</Label>
                      <Select value={monthlyRevenue} onValueChange={setMonthlyRevenue}>
                        <SelectTrigger><SelectValue placeholder="Sélectionnez une tranche" /></SelectTrigger>
                        <SelectContent>
                          {REVENUES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {step === 5 && (
                    <div className="space-y-2">
                      <Label>Volume de prospection quotidien</Label>
                      <Select value={prospectingVolume} onValueChange={setProspectingVolume}>
                        <SelectTrigger><SelectValue placeholder="Sélectionnez un volume" /></SelectTrigger>
                        <SelectContent>
                          {VOLUMES.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                <Button className="w-full" size="lg" onClick={handleNext} disabled={!canNext() || saving} data-testid="onboarding-next">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Continuer <ArrowRight className="h-4 w-4 ml-1" /></>}
                </Button>
              </>
            )}

            {/* ── TOUR SLIDES (6–9) ── */}
            {!isProfileStep && tourSlide && (
              <>
                {/* Icon badge */}
                <div className="flex justify-center">
                  <div className={`h-16 w-16 rounded-2xl ${tourSlide.bgClass} flex items-center justify-center`}>
                    <tourSlide.icon className={`h-8 w-8 ${tourSlide.accentClass}`} />
                  </div>
                </div>

                <div className="text-center space-y-2">
                  <h1 className="text-xl font-semibold text-foreground">{tourSlide.title}</h1>
                  <p className="text-sm text-muted-foreground">{tourSlide.subtitle}</p>
                </div>

                {/* Feature list */}
                <ul className="space-y-3">
                  {tourSlide.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <div className={`mt-0.5 h-5 w-5 rounded-full ${tourSlide.bgClass} flex items-center justify-center shrink-0`}>
                        <Check className={`h-3 w-3 ${tourSlide.accentClass}`} />
                      </div>
                      <span className="text-sm text-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>

                <div className="space-y-2 pt-1">
                  <Button className="w-full" size="lg" onClick={handleNext} disabled={saving} data-testid="onboarding-next">
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : isLastStep ? (
                      <>Accéder à SetterFlow <ArrowRight className="h-4 w-4 ml-1" /></>
                    ) : (
                      <>Continuer <ArrowRight className="h-4 w-4 ml-1" /></>
                    )}
                  </Button>

                  {/* LinkedIn step: reminder note */}
                  {tourSlide.isLinkedIn && (
                    <p className="text-center text-xs text-muted-foreground flex items-center justify-center gap-1.5">
                      <Settings className="h-3 w-3" />
                      La connexion se fait depuis <span className="font-medium">Paramètres → Compte LinkedIn</span>
                    </p>
                  )}
                </div>
              </>
            )}

          </CardContent>
        </Card>
      </div>
    </div>
  );
}
