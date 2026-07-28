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
import { Loader2, ArrowRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const TOTAL_STEPS = 5;

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

  const canNext = useCallback(() => {
    switch (step) {
      case 1: return !!(firstName.trim() && lastName.trim());
      case 2: return !!businessType;
      case 3: return !!industry;
      case 4: return !!monthlyRevenue;
      case 5: return !!prospectingVolume;
      default: return true;
    }
  }, [step, firstName, lastName, businessType, industry, monthlyRevenue, prospectingVolume]);

  const handleNext = async () => {
    if (!canNext()) return;

    // Last step: save profile, mark onboarding complete, go to dashboard
    if (step === TOTAL_STEPS) {
      setSaving(true);
      try {
        if (!user) return;
        const { error } = await supabase.from('profiles').update({
          full_name: `${firstName.trim()} ${lastName.trim()}`,
          business_type: businessType,
          industry,
          monthly_revenue: monthlyRevenue,
          prospecting_volume: prospectingVolume,
          onboarding_completed: true,
        }).eq('id', user.id);
        if (error) throw error;
        await refreshUserData();
        navigate('/dashboard', { replace: true });
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
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : step === TOTAL_STEPS ? (
                <>Accéder à SetterFlow <ArrowRight className="h-4 w-4 ml-1" /></>
              ) : (
                <>Continuer <ArrowRight className="h-4 w-4 ml-1" /></>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
