import { Lead, STATUS_CONFIG, LOSS_REASONS, DISQUALIFICATION_REASONS, SOURCE_TYPE_LABELS, OUTREACH_TYPE_LABELS, type LossReason, type DisqualificationReason, type OutreachType } from '@/lib/constants';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { StatusBadge } from '@/components/StatusBadge';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ExternalLink, Calendar, Building2, Briefcase, Save, Send, Target, Pencil, Trash2, X, Check, CalendarClock, ArrowRightCircle, Mail, Phone, Trophy } from 'lucide-react';
import { FollowUpDateModal } from '@/components/FollowUpDateModal';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useTeammates, teammateLabel } from '@/hooks/useTeammates';
import { Users } from 'lucide-react';

interface LeadDetailDrawerProps {
  lead: Lead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  events?: Array<{ event_type: string; old_value: string | null; new_value: string | null; created_at: string }>;
  onDelete?: (leadId: string) => void;
}

export function LeadDetailDrawer({ lead, open, onOpenChange, events = [], onDelete }: LeadDetailDrawerProps) {
  const { user, roles } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isCoach = roles.includes('coach') || roles.includes('admin');
  const { teammates, isTeam } = useTeammates();

  const [companyName, setCompanyName] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [personaId, setPersonaId] = useState<string>('none');
  const [outreachType, setOutreachType] = useState<string>('none');
  const [setterId, setSetterId] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteValue, setEditingNoteValue] = useState('');
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);
  const [followUpAction, setFollowUpAction] = useState<null | 'change' | 'next'>(null);

  // Fetch notes from lead_events
  const { data: noteEvents = [], refetch: refetchNotes } = useQuery({
    queryKey: ['lead-notes', lead?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('lead_events')
        .select('id, event_type, new_value, old_value, created_at, user_id')
        .eq('lead_id', lead!.id)
        .in('event_type', ['note_added', 'coach_note_added'])
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!lead?.id && open,
  });

  // Fetch personas for dropdown
  const { data: myPersonas = [] } = useQuery({
    queryKey: ['lead-detail-personas', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('personas')
        .select('id, name')
        .order('name', { ascending: true });

      if (error) throw error;

      return (data || []) as { id: string; name: string }[];
    },
    enabled: !!user && open,
  });

  // Fetch the won deal amount for closed-won leads
  const { data: wonDeal } = useQuery({
    queryKey: ['lead-won-deal', lead?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('deals')
        .select('amount')
        .eq('lead_id', lead!.id)
        .eq('status', 'won')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!lead?.id && open && lead?.status === 'ferme_gagne',
  });

  useEffect(() => {
    if (lead) {
      setCompanyName(lead.company_name || '');
      setJobTitle(lead.job_title || '');
      setEmail(lead.email || '');
      setPhone(lead.phone || '');
      setPersonaId((lead as any).persona_id || 'none');
      setOutreachType(lead.outreach_type || 'none');
      setSetterId((lead as any).setter_id || lead.owner_id);
    }
  }, [lead?.id, lead?.company_name, lead?.job_title, lead?.email, lead?.phone, (lead as any)?.persona_id, lead?.outreach_type, (lead as any)?.setter_id]);

  if (!lead) return null;

  const isOwner = lead.owner_id === user?.id;

  const handleSave = async () => {
    setSaving(true);
    const updateData: Record<string, any> = {};
    if (isOwner) {
      updateData.company_name = companyName || null;
      updateData.job_title = jobTitle || null;
      updateData.email = email || null;
      updateData.phone = phone || null;
      updateData.persona_id = personaId !== 'none' ? personaId : null;
      updateData.outreach_type = outreachType !== 'none' ? outreachType : null;
      if (isTeam && setterId) updateData.setter_id = setterId;
    }

    const { error } = await supabase.from('leads').update(updateData).eq('id', lead.id);
    if (error) {
      toast({ variant: 'destructive', title: 'Erreur', description: error.message });
    } else {
      toast({ title: 'Enregistré' });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-leads'] });
    }
    setSaving(false);
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    setAddingNote(true);
    const eventType = isCoach && !isOwner ? 'coach_note_added' : 'note_added';
    const { error } = await supabase.from('lead_events').insert({
      lead_id: lead.id,
      user_id: user!.id,
      event_type: eventType,
      new_value: newNote.trim(),
    });
    if (error) {
      toast({ variant: 'destructive', title: 'Erreur', description: error.message });
    } else {
      setNewNote('');
      refetchNotes();
      queryClient.invalidateQueries({ queryKey: ['lead-events'] });
      toast({ title: 'Note ajoutée' });
    }
    setAddingNote(false);
  };

  const handleEditNote = async (noteId: string) => {
    if (!editingNoteValue.trim()) return;
    const { error } = await supabase.from('lead_events').update({ new_value: editingNoteValue.trim() }).eq('id', noteId);
    if (error) {
      toast({ variant: 'destructive', title: 'Erreur', description: error.message });
    } else {
      setEditingNoteId(null);
      setEditingNoteValue('');
      refetchNotes();
      toast({ title: 'Note modifiée' });
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    const { error } = await supabase.from('lead_events').delete().eq('id', noteId);
    if (error) {
      toast({ variant: 'destructive', title: 'Erreur', description: error.message });
    } else {
      setDeletingNoteId(null);
      refetchNotes();
      toast({ title: 'Note supprimée' });
    }
  };

  const personaName = myPersonas.find((p) => p.id === (lead as any).persona_id)?.name;
  const dealAmountLabel = wonDeal?.amount != null
    ? new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number(wonDeal.amount))
    : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto" data-testid="lead-detail-drawer">
        <SheetHeader>
          <SheetTitle className="text-xl">{lead.first_name} {lead.last_name}</SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-5">
          {/* Editable info for owner */}
          {isOwner && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Entreprise</Label>
                  <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Nom entreprise" className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Poste</Label>
                  <Input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="Titre du poste" className="h-8 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Email</Label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jean@exemple.com" className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Portable</Label>
                  <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="06 12 34 56 78" className="h-8 text-sm" />
                </div>
              </div>
              {myPersonas.length > 0 && (
                <div className="space-y-1">
                  <Label className="text-xs flex items-center gap-1"><Target className="h-3 w-3" />Cible / Persona</Label>
                  <Select value={personaId} onValueChange={setPersonaId}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Aucune" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Aucune</SelectItem>
                      {myPersonas.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-1">
                <Label className="text-xs">Format d'approche</Label>
                <Select value={outreachType} onValueChange={setOutreachType}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Non défini" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Non défini</SelectItem>
                    <SelectItem value="message_texte">✍️ Écrit</SelectItem>
                    <SelectItem value="video">🎥 Vidéo</SelectItem>
                    <SelectItem value="vocal">🎙️ Vocal</SelectItem>
                    <SelectItem value="autre">📎 Autre</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {isTeam && (
                <div className="space-y-1">
                  <Label className="text-xs flex items-center gap-1"><Users className="h-3 w-3" />Setter responsable</Label>
                  <Select value={setterId} onValueChange={setSetterId}>
                    <SelectTrigger className="h-8 text-sm" data-testid="lead-setter-select"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {teammates.map((t) => (
                        <SelectItem key={t.id} value={t.id}>{teammateLabel(t)}{t.id === user?.id ? ' (vous)' : ''}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {lead.status === 'follow_up' && (
                <div className="rounded-md border border-border bg-muted/20 p-3 space-y-2" data-testid="follow-up-manager">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Gestion de la relance</Label>
                    <Badge variant="secondary" className="text-[10px]">FU {(lead as any).follow_up_level || 0}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {lead.follow_up_date
                      ? <>Prochaine relance : <span className="font-medium text-foreground">{format(new Date(lead.follow_up_date), 'dd MMM yyyy', { locale: fr })}</span></>
                      : 'Aucune date de relance définie'}
                  </p>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setFollowUpAction('change')}
                      data-testid="follow-up-change-date"
                    >
                      <CalendarClock className="mr-1.5 h-3.5 w-3.5" />Modifier la date
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => setFollowUpAction('next')}
                      data-testid="follow-up-next"
                    >
                      <ArrowRightCircle className="mr-1.5 h-3.5 w-3.5" />Relance effectuée
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Le statut reste « Follow-up » — aucune incidence sur le funnel.
                  </p>
                </div>
              )}
              <Button onClick={handleSave} disabled={saving} size="sm" className="w-full">
                <Save className="mr-2 h-4 w-4" />Enregistrer
              </Button>
            </div>
          )}

          {/* Read-only info for coaches */}
          {!isOwner && (
            <div className="space-y-2">
              {lead.company_name && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Building2 className="h-4 w-4" />{lead.company_name}</div>}
              {lead.job_title && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Briefcase className="h-4 w-4" />{lead.job_title}</div>}
              {lead.email && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Mail className="h-4 w-4" />{lead.email}</div>}
              {lead.phone && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Phone className="h-4 w-4" />{lead.phone}</div>}
              {personaName && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Target className="h-4 w-4" />{personaName}</div>}
              {isTeam && (lead as any).setter_id && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" />Setter : {teammateLabel(teammates.find((t) => t.id === (lead as any).setter_id))}
                </div>
              )}
            </div>
          )}

          {lead.linkedin_url && (
            <a href={lead.linkedin_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline">
              <ExternalLink className="h-4 w-4" />Profil LinkedIn
            </a>
          )}

          <Separator />

          {/* Status */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-foreground">Statut :</span>
            <StatusBadge status={lead.status} />
          </div>

          {lead.status === 'ferme_gagne' && dealAmountLabel && (
            <div className="flex items-center gap-2 text-sm font-medium text-emerald-600">
              <Trophy className="h-4 w-4" />
              <span>Montant du deal : {dealAmountLabel}</span>
            </div>
          )}

          {lead.follow_up_date && (
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>Relance : {format(new Date(lead.follow_up_date), 'dd MMMM yyyy', { locale: fr })}</span>
            </div>
          )}

          {lead.date_rdv && (
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>RDV : {format(new Date(lead.date_rdv), 'dd MMMM yyyy', { locale: fr })}</span>
            </div>
          )}

          {lead.loss_reason && (
            <div className="space-y-1">
              <p className="text-sm font-medium text-destructive">Raison de perte</p>
              <p className="text-sm">{LOSS_REASONS[lead.loss_reason as LossReason] || lead.loss_reason}</p>
            </div>
          )}
          {lead.disqualification_reason && (
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Raison de disqualification</p>
              <p className="text-sm">{DISQUALIFICATION_REASONS[lead.disqualification_reason as DisqualificationReason] || lead.disqualification_reason}</p>
            </div>
          )}

          {/* Meta */}
          <div className="grid grid-cols-3 gap-3 text-sm">
            {lead.source_type && <div><p className="text-muted-foreground text-xs">Source</p><p>{SOURCE_TYPE_LABELS[lead.source_type] || lead.source_type}</p></div>}
            {lead.outreach_type && <div><p className="text-muted-foreground text-xs">Outreach</p><p>{OUTREACH_TYPE_LABELS[lead.outreach_type] || lead.outreach_type}</p></div>}
            {lead.campaign_tag && <div><p className="text-muted-foreground text-xs">Campagne</p><Badge variant="outline">{lead.campaign_tag}</Badge></div>}
          </div>

          <Separator />

          {/* Notes — new system */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Notes</Label>
            {(isOwner || isCoach) && (
              <div className="flex gap-2">
                <Textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  rows={2}
                  placeholder={isCoach && !isOwner ? 'Ajouter une note coach...' : 'Ajouter une note...'}
                  className="flex-1"
                />
                <Button
                  size="icon"
                  onClick={handleAddNote}
                  disabled={addingNote || !newNote.trim()}
                  className="shrink-0 self-end"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            )}
            {noteEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune note</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {noteEvents.map((n: any) => (
                  <div key={n.id} className={`rounded-md border p-2.5 text-sm ${n.event_type === 'coach_note_added' ? 'border-primary/20 bg-primary/5' : 'bg-muted/30'}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-muted-foreground">
                        {n.event_type === 'coach_note_added' ? '🎯 Note coach' : '📝 Note'}
                      </span>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground">{format(new Date(n.created_at), 'dd/MM HH:mm')}</span>
                        {(isOwner || n.user_id === user?.id) && (
                          <>
                            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => { setEditingNoteId(n.id); setEditingNoteValue(n.new_value || ''); }}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                            {deletingNoteId === n.id ? (
                              <div className="flex items-center gap-0.5">
                                <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive" onClick={() => handleDeleteNote(n.id)}>
                                  <Check className="h-3 w-3" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setDeletingNoteId(null)}>
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            ) : (
                              <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive" onClick={() => setDeletingNoteId(n.id)}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                    {editingNoteId === n.id ? (
                      <div className="flex gap-1 mt-1">
                        <Textarea value={editingNoteValue} onChange={(e) => setEditingNoteValue(e.target.value)} rows={2} className="flex-1 text-sm" />
                        <div className="flex flex-col gap-1">
                          <Button size="icon" className="h-6 w-6" onClick={() => handleEditNote(n.id)}><Check className="h-3 w-3" /></Button>
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditingNoteId(null)}><X className="h-3 w-3" /></Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-foreground whitespace-pre-wrap">{n.new_value}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <Separator />

          {/* Timeline */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Historique</p>
            {events.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun événement</p>
            ) : (
              <div className="space-y-2">
                {events.filter(ev => ev.event_type !== 'note_added' && ev.event_type !== 'coach_note_added').map((ev, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <span className="text-muted-foreground whitespace-nowrap">{format(new Date(ev.created_at), 'dd/MM HH:mm')}</span>
                    <span>
                      {ev.event_type === 'lead_created' && 'Lead créé'}
                      {ev.event_type === 'status_changed' && `Statut : ${STATUS_CONFIG[ev.old_value as keyof typeof STATUS_CONFIG]?.label || ev.old_value} → ${STATUS_CONFIG[ev.new_value as keyof typeof STATUS_CONFIG]?.label || ev.new_value}`}
                      {ev.event_type === 'follow_up_set' && `Follow-up : ${ev.new_value}`}
                      {ev.event_type === 'loss_reason_set' && `Perte : ${LOSS_REASONS[ev.new_value as LossReason] || ev.new_value}`}
                      {ev.event_type === 'disqualification_reason_set' && `Disqualifié : ${DISQUALIFICATION_REASONS[ev.new_value as DisqualificationReason] || ev.new_value}`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="text-xs text-muted-foreground space-y-1">
            <p>Créé le {format(new Date(lead.created_at), 'dd/MM/yyyy HH:mm')}</p>
            <p>Mis à jour le {format(new Date(lead.updated_at), 'dd/MM/yyyy HH:mm')}</p>
          </div>

          {isOwner && onDelete && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => onDelete(lead.id)}
              data-testid="lead-delete-button"
            >
              <Trash2 className="mr-2 h-4 w-4" />Supprimer ce lead
            </Button>
          )}
        </div>
      </SheetContent>

      <FollowUpDateModal
        open={followUpAction !== null}
        onOpenChange={(o) => !o && setFollowUpAction(null)}
        onSubmit={async (date) => {
          const action = followUpAction;
          const updateData: Record<string, any> = {
            follow_up_date: format(date, 'yyyy-MM-dd'),
          };
          if (action === 'next') {
            updateData.follow_up_level = ((lead as any).follow_up_level || 0) + 1;
          }
          // Status is intentionally NOT updated — preserves funnel analytics.
          const { error } = await supabase.from('leads').update(updateData).eq('id', lead.id);
          if (error) {
            toast({ variant: 'destructive', title: 'Erreur', description: error.message });
            return;
          }
          queryClient.invalidateQueries({ queryKey: ['leads'] });
          queryClient.invalidateQueries({ queryKey: ['dashboard-leads'] });
          queryClient.invalidateQueries({ queryKey: ['follow-up-leads'] });
          queryClient.invalidateQueries({ queryKey: ['tasks'] });
          toast({
            title: action === 'next' ? 'Relance enregistrée' : 'Date de relance mise à jour',
          });
          setFollowUpAction(null);
        }}
      />
    </Sheet>
  );
}
