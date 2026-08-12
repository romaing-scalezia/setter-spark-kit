import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Loader2, Users, CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useTeammates, teammateLabel } from '@/hooks/useTeammates';
import type { Persona } from '@/pages/Personas';

interface CreateLeadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { first_name: string; last_name: string; linkedin_url: string; company_name: string; job_title: string; created_at: string; persona_id: string | null; outreach_type: string | null; setter_id: string | null }) => Promise<void>;
  initialValues?: {
    first_name?: string | null;
    last_name?: string | null;
    linkedin_url?: string | null;
    company_name?: string | null;
    job_title?: string | null;
  };
}

const OUTREACH_OPTIONS = [
  { value: 'message_texte', label: '✍️ Écrit', short: 'Écrit' },
  { value: 'video', label: '🎥 Vidéo', short: 'Vidéo' },
  { value: 'vocal', label: '🎙️ Vocal', short: 'Vocal' },
  { value: 'autre', label: '📎 Autre', short: 'Autre' },
];

export function CreateLeadModal({ open, onOpenChange, onSubmit, initialValues }: CreateLeadModalProps) {
  const { user } = useAuth();
  const { teammates, isTeam } = useTeammates();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [createdAt, setCreatedAt] = useState<Date>(new Date());
  const [createdAtOpen, setCreatedAtOpen] = useState(false);
  const [personaId, setPersonaId] = useState('none');
  const [outreachType, setOutreachType] = useState('message_texte');
  const [setterId, setSetterId] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user?.id) setSetterId(user.id);
  }, [user?.id]);

  useEffect(() => {
    if (open) {
      setFirstName(initialValues?.first_name ?? '');
      setLastName(initialValues?.last_name ?? '');
      setLinkedinUrl(initialValues?.linkedin_url ?? '');
      setCompanyName(initialValues?.company_name ?? '');
      setJobTitle(initialValues?.job_title ?? '');
      setCreatedAt(new Date());
    }
  }, [open, initialValues?.first_name, initialValues?.last_name, initialValues?.linkedin_url, initialValues?.company_name, initialValues?.job_title]);

  const { data: myPersonas = [] } = useQuery({
    queryKey: ['create-lead-personas', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('personas')
        .select('id, name')
        .order('name', { ascending: true });

      if (error) throw error;

      return (data || []) as Pick<Persona, 'id' | 'name'>[];
    },
    enabled: !!user && open,
  });

  const hasPersonas = myPersonas.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await onSubmit({
      first_name: firstName,
      last_name: lastName,
      linkedin_url: linkedinUrl,
      company_name: companyName,
      job_title: jobTitle,
      created_at: createdAt.toISOString(),
      persona_id: personaId !== 'none' ? personaId : null,
      outreach_type: outreachType,
      setter_id: isTeam ? (setterId || user!.id) : null,
    });
    setFirstName('');
    setLastName('');
    setLinkedinUrl('');
    setCompanyName('');
    setJobTitle('');
    setCreatedAt(new Date());
    setPersonaId('none');
    setOutreachType('message_texte');
    setSetterId(user?.id ?? '');
    setLoading(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nouveau lead</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4" data-testid="create-lead-form">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="firstName">Prénom</Label>
              <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} required placeholder="Jean" data-testid="create-lead-firstname" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Nom</Label>
              <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} required placeholder="Dupont" data-testid="create-lead-lastname" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="linkedin">URL LinkedIn</Label>
            <Input id="linkedin" value={linkedinUrl} onChange={(e) => setLinkedinUrl(e.target.value)} placeholder="https://linkedin.com/in/..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="companyName">Entreprise</Label>
              <Input id="companyName" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Nom entreprise" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="jobTitle">Poste</Label>
              <Input id="jobTitle" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="Titre du poste" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Date de création</Label>
            <Popover open={createdAtOpen} onOpenChange={setCreatedAtOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className={cn('w-full justify-start text-left font-normal')}
                  data-testid="create-lead-created-at"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(createdAt, 'dd MMMM yyyy', { locale: fr })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={createdAt}
                  onSelect={(d) => { if (d) { setCreatedAt(d); setCreatedAtOpen(false); } }}
                  disabled={(d) => d > new Date()}
                  locale={fr}
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-2">
            <Label>Format d'approche *</Label>
            <div className="flex gap-1">
              {OUTREACH_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setOutreachType(opt.value)}
                  className={`flex-1 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors ${
                    outreachType === opt.value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-background text-muted-foreground hover:bg-muted/50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          {isTeam && (
            <div className="space-y-2">
              <Label className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />Setter responsable</Label>
              <Select value={setterId || user?.id} onValueChange={setSetterId}>
                <SelectTrigger data-testid="create-lead-setter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {teammates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {teammateLabel(t)}{t.id === user?.id ? ' (vous)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-2">
            <Label>Cible / Persona</Label>
            {hasPersonas ? (
              <Select value={personaId} onValueChange={setPersonaId}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une cible (optionnel)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucune (compléter plus tard)</SelectItem>
                  {myPersonas.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-xs text-muted-foreground">
                Vous pourrez associer une persona plus tard depuis l'écran Personas.
              </p>
            )}
          </div>
          <Button type="submit" className="w-full" disabled={loading} data-testid="create-lead-submit">
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Créer le lead
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
