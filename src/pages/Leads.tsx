import { useState, useCallback, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { LeadImportExport } from '@/components/LeadImportExport';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { OUTREACH_TYPE_LABELS } from '@/lib/constants';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/AppLayout';
import { StatusDropdown } from '@/components/StatusDropdown';
import { CreateLeadModal } from '@/components/CreateLeadModal';
import { ReasonModal } from '@/components/ReasonModal';
import { FollowUpDateModal } from '@/components/FollowUpDateModal';
import { LeadDetailDrawer } from '@/components/LeadDetailDrawer';
import { MergeLeadsModal } from '@/components/MergeLeadsModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Search, ExternalLink, Trash2, Merge, LayoutGrid, List } from 'lucide-react';
import { format, isToday, isBefore, startOfDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { Lead, LeadStatus } from '@/lib/constants';
import { STATUS_CONFIG, TARGET_TYPES, SECTORS, COMPANY_SIZES } from '@/lib/constants';
import { scoreLead, TEMPERATURE_CONFIG, type LeadTemperature } from '@/lib/leadScoring';
import type { Persona } from '@/pages/Personas';
import { useTeammates, teammateLabel } from '@/hooks/useTeammates';

const STATUS_TABS: Array<{ value: string; label: string }> = [
  { value: 'all', label: 'Tous' },
  { value: 'conversation_engagee', label: 'Engagées' },
  { value: 'en_cours', label: 'En cours' },
  { value: 'appel_propose', label: 'Appels' },
  { value: 'follow_up', label: 'Follow-up' },
  { value: 'rendez_vous_booke', label: 'RDV' },
  { value: 'ferme_perdu', label: 'Perdus' },
  { value: 'non_qualifie', label: 'Non qual.' },
];

type SortOption = 'recent' | 'score_desc' | 'score_asc' | 'name';

export default function Leads() {
  const { user, activeRole } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isAdmin = activeRole === 'admin';

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [tempFilter, setTempFilter] = useState<string>('all');
  const [outreachFilter, setOutreachFilter] = useState('all');
  const [followUpLevelFilter, setFollowUpLevelFilter] = useState('all');
  const [sectorFilter, setSectorFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [sizeFilter, setSizeFilter] = useState('all');
  const [setterFilter, setSetterFilter] = useState('all');
  const [sortBy, setSortBy] = useState<SortOption>('score_desc');
  const { teammates, isTeam } = useTeammates();
  const [searchParams, setSearchParams] = useSearchParams();

  // Admin overrides: filter by ?owner=id or ?team=id1,id2
  const adminOwnerFilter = isAdmin ? searchParams.get('owner') : null;
  const adminTeamFilter = isAdmin ? searchParams.get('team') : null;
  const adminTeamIds = useMemo(
    () => (adminTeamFilter ? adminTeamFilter.split(',').filter(Boolean) : null),
    [adminTeamFilter]
  );

  // For admin, fetch all profiles to build setter list
  const { data: adminProfiles = [] } = useQuery({
    queryKey: ['admin-leads-profiles'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, full_name, email, avatar_url');
      return (data || []) as Array<{ id: string; full_name: string | null; email: string | null; avatar_url: string | null }>;
    },
    enabled: isAdmin,
  });

  const effectiveTeammates = isAdmin && adminProfiles.length > 0
    ? adminProfiles.map((p) => ({ id: p.id, full_name: p.full_name, email: p.email, avatar_url: p.avatar_url }))
    : teammates;
  const showSetterUI = isAdmin || isTeam;
  const teammateMap = useMemo(() => new Map(effectiveTeammates.map((t) => [t.id, t])), [effectiveTeammates]);
  const [createOpen, setCreateOpen] = useState(false);

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<'single' | 'bulk'>('single');
  const [singleDeleteId, setSingleDeleteId] = useState<string | null>(null);
  const [mergeOpen, setMergeOpen] = useState(false);

  // Auto-open create modal after onboarding
  useEffect(() => {
    if (searchParams.get('onboarding') === 'done') {
      setCreateOpen(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [pendingStatusChange, setPendingStatusChange] = useState<{ lead: Lead; newStatus: LeadStatus } | null>(null);
  const [reasonModalOpen, setReasonModalOpen] = useState(false);
  const [reasonType, setReasonType] = useState<'loss' | 'disqualification'>('loss');
  const [followUpModalOpen, setFollowUpModalOpen] = useState(false);

  const { data: allLeads = [], isLoading } = useQuery({
    queryKey: ['leads'],
    queryFn: async () => {
      const { data, error } = await supabase.from('leads').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data as Lead[];
    },
  });

  const { data: allPersonas = [] } = useQuery({
    queryKey: ['all-personas-leads'],
    queryFn: async () => {
      const { data } = await supabase.from('personas').select('id, name, target_type, sector, company_size');
      return (data || []) as Pick<Persona, 'id' | 'name' | 'target_type' | 'sector' | 'company_size'>[];
    },
  });

  const personaMap = useMemo(() => {
    const map = new Map<string, Pick<Persona, 'id' | 'name' | 'target_type' | 'sector' | 'company_size'>>();
    allPersonas.forEach((p) => map.set(p.id, p));
    return map;
  }, [allPersonas]);

  const scoredLeads = useMemo(() => {
    return allLeads.map((lead) => ({
      lead,
      ...scoreLead(lead),
    }));
  }, [allLeads]);

  const tabCounts = allLeads.reduce((acc, l) => {
    acc[l.status] = (acc[l.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const selectedLead = useMemo(() => {
    if (!selectedLeadId) return null;
    return allLeads.find((l) => l.id === selectedLeadId) || null;
  }, [selectedLeadId, allLeads]);

  const { data: leadEvents = [] } = useQuery({
    queryKey: ['lead-events', selectedLeadId],
    queryFn: async () => {
      if (!selectedLeadId) return [];
      const { data } = await supabase
        .from('lead_events')
        .select('event_type, old_value, new_value, created_at')
        .eq('lead_id', selectedLeadId)
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!selectedLeadId,
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['leads'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard-leads'] });
    queryClient.invalidateQueries({ queryKey: ['follow-up-leads'] });
  };

  const createLead = useMutation({
    mutationFn: async (data: { first_name: string; last_name: string; linkedin_url: string; persona_id: string | null; outreach_type: string | null; setter_id?: string | null }) => {
      const { data: lead, error } = await supabase.from('leads').insert({
        owner_id: user!.id,
        setter_id: data.setter_id || user!.id,
        first_name: data.first_name,
        last_name: data.last_name,
        linkedin_url: data.linkedin_url || null,
        persona_id: data.persona_id || null,
        outreach_type: (data.outreach_type || null) as any,
        status: 'conversation_engagee' as LeadStatus,
        conversation_started_at: new Date().toISOString(),
      } as any).select().single();
      if (error) throw error;
      await supabase.from('lead_events').insert({
        lead_id: lead.id, user_id: user!.id,
        event_type: 'lead_created', new_value: 'conversation_engagee',
      });
      return lead;
    },
    onSuccess: () => { invalidateAll(); toast({ title: 'Lead créé' }); },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ leadId, newStatus, extra }: { leadId: string; newStatus: LeadStatus; extra?: Record<string, any> }) => {
      const currentLead = allLeads.find((l) => l.id === leadId);
      const updateData: Record<string, any> = { status: newStatus, last_status_change_at: new Date().toISOString(), ...extra };

      const STATUS_RANK: Record<string, number> = {
        conversation_engagee: 0, en_cours: 1, appel_propose: 2,
        follow_up: 3, rendez_vous_booke: 4, ferme_perdu: -1, non_qualifie: -1,
      };
      const newRank = STATUS_RANK[newStatus] ?? 0;

      if (newStatus === 'en_cours' && !currentLead?.first_response_at) updateData.first_response_at = new Date().toISOString();
      if (newStatus === 'appel_propose') updateData.call_proposed_at = new Date().toISOString();
      if (newStatus === 'rendez_vous_booke') updateData.meeting_booked_at = new Date().toISOString();
      if (newStatus === 'ferme_perdu') updateData.closed_lost_at = new Date().toISOString();
      if (newStatus === 'non_qualifie') updateData.unqualified_at = new Date().toISOString();

      if (newRank < 4) updateData.meeting_booked_at = null;
      if (newRank < 2) updateData.call_proposed_at = null;
      if (newStatus === 'appel_propose') updateData.call_proposed_at = new Date().toISOString();
      if (newStatus === 'rendez_vous_booke') updateData.meeting_booked_at = new Date().toISOString();

      if (newStatus === 'follow_up') {
        updateData.follow_up_level = ((currentLead as any)?.follow_up_level || 0) + 1;
      }
      if (newStatus !== 'follow_up' && currentLead?.status === 'follow_up') updateData.follow_up_date = null;
      if (newStatus !== 'ferme_perdu') { updateData.loss_reason = null; updateData.closed_lost_at = null; }
      if (newStatus !== 'non_qualifie') { updateData.disqualification_reason = null; updateData.unqualified_at = null; }
      if (extra) Object.assign(updateData, extra);
      if (newStatus === 'ferme_perdu') updateData.closed_lost_at = new Date().toISOString();
      if (newStatus === 'non_qualifie') updateData.unqualified_at = new Date().toISOString();

      const { error } = await supabase.from('leads').update(updateData).eq('id', leadId);
      if (error) throw error;
      await supabase.from('lead_events').insert({
        lead_id: leadId, user_id: user!.id, event_type: 'status_changed',
        old_value: currentLead?.status || null, new_value: newStatus,
        metadata: extra ? { follow_up_date: extra.follow_up_date ?? null, loss_reason: extra.loss_reason ?? null, disqualification_reason: extra.disqualification_reason ?? null, reason_detail: extra.reason_detail ?? null } : null,
      });
    },
    onSuccess: () => {
      invalidateAll();
      queryClient.invalidateQueries({ queryKey: ['lead-events'] });
      toast({ title: 'Statut mis à jour' });
    },
    onError: (error: any) => {
      toast({ variant: 'destructive', title: 'Erreur', description: error?.message || 'Impossible de changer le statut' });
    },
  });

  // Delete leads mutation
  const deleteLeads = useMutation({
    mutationFn: async (leadIds: string[]) => {
      // Delete related events first, then leads
      const { error: evError } = await supabase.from('lead_events').delete().in('lead_id', leadIds);
      if (evError) throw evError;
      // Delete related deals
      const { error: dealError } = await supabase.from('deals').delete().in('lead_id', leadIds);
      if (dealError) throw dealError;
      const { error } = await supabase.from('leads').delete().in('id', leadIds);
      if (error) throw error;
    },
    onSuccess: (_, leadIds) => {
      invalidateAll();
      queryClient.invalidateQueries({ queryKey: ['lead-events'] });
      setSelectedIds(new Set());
      setDrawerOpen(false);
      toast({ title: leadIds.length > 1 ? `${leadIds.length} leads supprimés` : 'Lead supprimé' });
    },
    onError: (error: any) => {
      toast({ variant: 'destructive', title: 'Erreur', description: error?.message || 'Suppression impossible' });
    },
  });

  // Merge leads
  const handleMerge = async (primaryId: string, secondaryId: string) => {
    const primary = allLeads.find(l => l.id === primaryId);
    const secondary = allLeads.find(l => l.id === secondaryId);
    if (!primary || !secondary) return;

    // Merge: fill empty fields on primary from secondary
    const mergeData: Record<string, any> = {};
    if (!primary.company_name && secondary.company_name) mergeData.company_name = secondary.company_name;
    if (!primary.job_title && secondary.job_title) mergeData.job_title = secondary.job_title;
    if (!primary.linkedin_url && secondary.linkedin_url) mergeData.linkedin_url = secondary.linkedin_url;
    if (!(primary as any).persona_id && (secondary as any).persona_id) mergeData.persona_id = (secondary as any).persona_id;
    if (!primary.outreach_type && secondary.outreach_type) mergeData.outreach_type = secondary.outreach_type;
    if (!primary.campaign_tag && secondary.campaign_tag) mergeData.campaign_tag = secondary.campaign_tag;
    if (!primary.source_type && secondary.source_type) mergeData.source_type = secondary.source_type;
    // Keep higher follow_up_level
    const primaryFU = (primary as any).follow_up_level || 0;
    const secondaryFU = (secondary as any).follow_up_level || 0;
    if (secondaryFU > primaryFU) mergeData.follow_up_level = secondaryFU;

    // Update primary with merged data
    if (Object.keys(mergeData).length > 0) {
      await supabase.from('leads').update(mergeData).eq('id', primaryId);
    }

    // Move secondary's events to primary
    await supabase.from('lead_events').update({ lead_id: primaryId }).eq('lead_id', secondaryId);
    // Move secondary's deals to primary
    await supabase.from('deals').update({ lead_id: primaryId }).eq('lead_id', secondaryId);

    // Log merge event
    await supabase.from('lead_events').insert({
      lead_id: primaryId,
      user_id: user!.id,
      event_type: 'lead_merged',
      new_value: `Fusionné avec ${secondary.first_name} ${secondary.last_name}`,
      metadata: { merged_from_id: secondaryId } as any,
    });

    // Delete secondary lead
    await supabase.from('leads').delete().eq('id', secondaryId);

    invalidateAll();
    queryClient.invalidateQueries({ queryKey: ['lead-events'] });
    setSelectedIds(new Set());
    toast({ title: 'Leads fusionnés avec succès' });
  };

  const handleStatusChange = useCallback((lead: Lead, newStatus: LeadStatus) => {
    if (newStatus === lead.status) return;
    if (newStatus === 'follow_up') { setPendingStatusChange({ lead, newStatus }); setFollowUpModalOpen(true); }
    else if (newStatus === 'ferme_perdu') { setPendingStatusChange({ lead, newStatus }); setReasonType('loss'); setReasonModalOpen(true); }
    else if (newStatus === 'non_qualifie') { setPendingStatusChange({ lead, newStatus }); setReasonType('disqualification'); setReasonModalOpen(true); }
    else updateStatus.mutate({ leadId: lead.id, newStatus });
  }, [updateStatus, allLeads]);

  const handleFollowUpDate = (date: Date) => {
    if (pendingStatusChange) updateStatus.mutate({ leadId: pendingStatusChange.lead.id, newStatus: 'follow_up', extra: { follow_up_date: format(date, 'yyyy-MM-dd') } });
    setPendingStatusChange(null);
  };

  const handleReason = (reason: string, detail?: string) => {
    if (pendingStatusChange) {
      const extra: Record<string, any> = {};
      if (reasonType === 'loss') extra.loss_reason = reason; else extra.disqualification_reason = reason;
      if (detail) extra.reason_detail = detail;
      updateStatus.mutate({ leadId: pendingStatusChange.lead.id, newStatus: pendingStatusChange.newStatus, extra });
    }
    setPendingStatusChange(null);
  };

  const getPersona = (lead: Lead) => {
    const pid = (lead as any).persona_id;
    if (!pid) return null;
    return personaMap.get(pid) || null;
  };

  // Selection helpers
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredLeads.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredLeads.map(sl => sl.lead.id)));
    }
  };

  const selectedLeadsForMerge = useMemo(() => {
    if (selectedIds.size !== 2) return [];
    return allLeads.filter(l => selectedIds.has(l.id));
  }, [selectedIds, allLeads]);

  // Single delete from drawer
  const handleSingleDelete = (leadId: string) => {
    setSingleDeleteId(leadId);
    setDeleteTarget('single');
    setDeleteConfirmOpen(true);
  };

  const handleBulkDelete = () => {
    setDeleteTarget('bulk');
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = () => {
    if (deleteTarget === 'single' && singleDeleteId) {
      deleteLeads.mutate([singleDeleteId]);
    } else {
      deleteLeads.mutate(Array.from(selectedIds));
    }
    setDeleteConfirmOpen(false);
    setSingleDeleteId(null);
  };

  // Filter & sort
  const filteredLeads = useMemo(() => {
    let results = scoredLeads;
    if (statusFilter !== 'all') results = results.filter((sl) => sl.lead.status === statusFilter);
    if (tempFilter !== 'all') results = results.filter((sl) => sl.temperature === tempFilter);
    if (outreachFilter !== 'all') results = results.filter((sl) => sl.lead.outreach_type === outreachFilter);
    if (followUpLevelFilter !== 'all') {
      if (followUpLevelFilter === '3+') results = results.filter((sl) => ((sl.lead as any).follow_up_level || 0) >= 3);
      else results = results.filter((sl) => ((sl.lead as any).follow_up_level || 0) === Number(followUpLevelFilter));
    }
    if (sectorFilter !== 'all') {
      results = results.filter((sl) => {
        const p = getPersona(sl.lead);
        return p?.sector === sectorFilter;
      });
    }
    if (typeFilter !== 'all') {
      results = results.filter((sl) => {
        const p = getPersona(sl.lead);
        return p?.target_type === typeFilter;
      });
    }
    if (sizeFilter !== 'all') {
      results = results.filter((sl) => {
        const p = getPersona(sl.lead);
        return p?.company_size === sizeFilter;
      });
    }
    if (adminOwnerFilter) {
      results = results.filter((sl) => sl.lead.owner_id === adminOwnerFilter);
    }
    if (adminTeamIds && adminTeamIds.length > 0) {
      const ids = new Set(adminTeamIds);
      results = results.filter((sl) => ids.has(sl.lead.owner_id));
    }
    if (setterFilter !== 'all') {
      results = results.filter((sl) => ((sl.lead as any).setter_id || sl.lead.owner_id) === setterFilter);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      results = results.filter((sl) => {
        const firstName = sl.lead.first_name.toLowerCase();
        const lastName = sl.lead.last_name.toLowerCase();
        const fullName = `${firstName} ${lastName}`;
        const reverseName = `${lastName} ${firstName}`;
        const company = (sl.lead.company_name || '').toLowerCase();
        return firstName.includes(q) || lastName.includes(q) || fullName.includes(q) || reverseName.includes(q) || company.includes(q);
      });
    }
    if (sortBy === 'score_desc') results = [...results].sort((a, b) => b.score - a.score);
    else if (sortBy === 'score_asc') results = [...results].sort((a, b) => a.score - b.score);
    else if (sortBy === 'name') results = [...results].sort((a, b) => a.lead.first_name.localeCompare(b.lead.first_name));
    return results;
  }, [scoredLeads, statusFilter, tempFilter, outreachFilter, followUpLevelFilter, sectorFilter, typeFilter, sizeFilter, setterFilter, search, sortBy, personaMap, adminOwnerFilter, adminTeamIds]);

  const getFollowUpBadge = (lead: Lead) => {
    if (!lead.follow_up_date || lead.status !== 'follow_up') return null;
    const d = new Date(lead.follow_up_date);
    if (isBefore(d, startOfDay(new Date()))) return <span className="text-xs font-medium text-destructive">En retard</span>;
    if (isToday(d)) return <span className="text-xs font-medium text-amber-600">Aujourd'hui</span>;
    return <span className="text-xs text-muted-foreground">{format(d, 'dd/MM', { locale: fr })}</span>;
  };

  const TemperatureBadge = ({ temp }: { temp: LeadTemperature }) => {
    const config = TEMPERATURE_CONFIG[temp];
    return (
      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${config.className}`}>
        {config.emoji} {config.label}
      </span>
    );
  };

  const hasActiveFilters = sectorFilter !== 'all' || typeFilter !== 'all' || sizeFilter !== 'all' || outreachFilter !== 'all' || followUpLevelFilter !== 'all';

  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('table');
  const [draggedLeadId, setDraggedLeadId] = useState<string | null>(null);

  const KANBAN_STATUSES: LeadStatus[] = [
    'conversation_engagee',
    'en_cours',
    'appel_propose',
    'follow_up',
    'rendez_vous_booke',
    'ferme_perdu',
  ];

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 space-y-4" data-testid="page-leads">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground">Leads</h1>
            <div className="flex rounded-md border border-primary/30 bg-primary/5 p-0.5 gap-0.5">
              <button
                onClick={() => setViewMode('table')}
                className={`rounded p-1.5 transition-colors ${viewMode === 'table' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                title="Vue table"
              >
                <List className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('kanban')}
                className={`rounded p-1.5 transition-colors ${viewMode === 'kanban' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                title="Vue kanban"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LeadImportExport leads={filteredLeads.map((sl) => sl.lead)} personaMap={personaMap as Map<string, { id: string; name: string }>} />
            <Button onClick={() => setCreateOpen(true)} data-testid="leads-new-lead">
              <Plus className="mr-2 h-4 w-4" /> Nouveau lead
            </Button>
          </div>
        </div>

        {isAdmin && (adminOwnerFilter || adminTeamIds) && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3" data-testid="admin-scope-banner">
            <div className="text-sm">
              <span className="font-medium text-primary">Vue admin filtrée · </span>
              {adminOwnerFilter && (
                <span>leads de <strong>{teammateLabel(teammateMap.get(adminOwnerFilter))}</strong></span>
              )}
              {adminTeamIds && (
                <span>leads de l'équipe ({adminTeamIds.length} membres)</span>
              )}
            </div>
            <Button size="sm" variant="ghost" onClick={() => setSearchParams({}, { replace: true })}>
              Réinitialiser
            </Button>
          </div>
        )}

        {/* Bulk actions bar */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-3 rounded-lg border bg-muted/50 p-3" data-testid="leads-bulk-actions">
            <span className="text-sm font-medium text-foreground">{selectedIds.size} lead{selectedIds.size > 1 ? 's' : ''} sélectionné{selectedIds.size > 1 ? 's' : ''}</span>
            <div className="flex items-center gap-2 ml-auto">
              {selectedIds.size === 2 && (
                <Button variant="outline" size="sm" onClick={() => setMergeOpen(true)}>
                  <Merge className="mr-2 h-4 w-4" />Fusionner
                </Button>
              )}
              <Button variant="destructive" size="sm" onClick={handleBulkDelete} data-testid="leads-bulk-delete">
                <Trash2 className="mr-2 h-4 w-4" />Supprimer ({selectedIds.size})
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
                Désélectionner
              </Button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Rechercher..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" data-testid="leads-search" />
          </div>
          <Select value={tempFilter} onValueChange={setTempFilter}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous leads</SelectItem>
              <SelectItem value="hot">🔥 Chauds</SelectItem>
              <SelectItem value="warm">🟡 Tièdes</SelectItem>
              <SelectItem value="cold">❄️ Froids</SelectItem>
           </SelectContent>
          </Select>
          <Select value={outreachFilter} onValueChange={setOutreachFilter}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tout format</SelectItem>
              <SelectItem value="message_texte">✍️ Écrit</SelectItem>
              <SelectItem value="video">🎥 Vidéo</SelectItem>
              <SelectItem value="vocal">🎙️ Vocal</SelectItem>
              <SelectItem value="autre">📎 Autre</SelectItem>
           </SelectContent>
          </Select>
          <Select value={followUpLevelFilter} onValueChange={setFollowUpLevelFilter}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tout niveau FU</SelectItem>
              <SelectItem value="1">Follow-up 1</SelectItem>
              <SelectItem value="2">Follow-up 2</SelectItem>
              <SelectItem value="3+">Follow-up 3+</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="score_desc">Score ↓</SelectItem>
              <SelectItem value="score_asc">Score ↑</SelectItem>
              <SelectItem value="recent">Récent</SelectItem>
              <SelectItem value="name">Nom</SelectItem>
            </SelectContent>
          </Select>
          {showSetterUI && (
            <Select value={setterFilter} onValueChange={setSetterFilter}>
              <SelectTrigger className="w-[180px]" data-testid="leads-setter-filter"><SelectValue placeholder="Tous setters" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous setters</SelectItem>
                {effectiveTeammates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{teammateLabel(t)}{t.id === user?.id ? ' (vous)' : ''}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Persona dimension filters */}
        <div className="flex flex-wrap gap-2">
          <Select value={sectorFilter} onValueChange={setSectorFilter}>
            <SelectTrigger className="w-[160px] h-8 text-xs"><SelectValue placeholder="Secteur" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous secteurs</SelectItem>
              {SECTORS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[160px] h-8 text-xs"><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous types</SelectItem>
              {TARGET_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={sizeFilter} onValueChange={setSizeFilter}>
            <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue placeholder="Taille" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes tailles</SelectItem>
              {COMPANY_SIZES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { setSectorFilter('all'); setTypeFilter('all'); setSizeFilter('all'); setOutreachFilter('all'); setFollowUpLevelFilter('all'); }}>
              Réinitialiser
            </Button>
          )}
        </div>

        <Tabs value={statusFilter} onValueChange={setStatusFilter}>
          <TabsList className="flex-wrap h-auto gap-1 bg-primary/5 border border-primary/30">
            {STATUS_TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value} className="text-xs">
                {tab.label}
                {tab.value !== 'all' && tabCounts[tab.value] ? (
                  <span className="ml-1.5 rounded-full bg-muted px-1.5 text-[10px] font-medium">{tabCounts[tab.value]}</span>
                ) : tab.value === 'all' ? (
                  <span className="ml-1.5 rounded-full bg-muted px-1.5 text-[10px] font-medium">{allLeads.length}</span>
                ) : null}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {viewMode === 'table' ? (
          <div className="rounded-lg border border-primary/30 bg-card" data-testid="leads-table">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={filteredLeads.length > 0 && selectedIds.size === filteredLeads.length}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Nom</TableHead>
                  <TableHead>Temp.</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="hidden sm:table-cell">Cible</TableHead>
                  <TableHead className="hidden sm:table-cell">Format</TableHead>
                  <TableHead className="hidden sm:table-cell">Relance</TableHead>
                  <TableHead className="hidden md:table-cell">Score</TableHead>
                  {showSetterUI && <TableHead className="hidden md:table-cell">Setter</TableHead>}
                  <TableHead className="hidden md:table-cell">Date</TableHead>
                  <TableHead className="hidden lg:table-cell">LinkedIn</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={showSetterUI ? 11 : 10} className="text-center py-8 text-muted-foreground">Chargement...</TableCell>
                  </TableRow>
                ) : filteredLeads.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={showSetterUI ? 11 : 10} className="text-center py-8 text-muted-foreground" data-testid="leads-empty-state">Aucun lead trouvé</TableCell>
                  </TableRow>
                ) : (
                  filteredLeads.map(({ lead, score, temperature }) => {
                    const persona = getPersona(lead);
                    return (
                      <TableRow
                        key={lead.id}
                        className={`cursor-pointer hover:bg-muted/50 ${selectedIds.has(lead.id) ? 'bg-muted/30' : ''}`}
                        onClick={() => { setSelectedLeadId(lead.id); setDrawerOpen(true); }}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedIds.has(lead.id)}
                            onCheckedChange={() => toggleSelect(lead.id)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          <div>
                            {lead.first_name} {lead.last_name}
                            {lead.company_name && <p className="text-xs text-muted-foreground">{lead.company_name}</p>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <TemperatureBadge temp={temperature} />
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <StatusDropdown value={lead.status} onValueChange={(s) => handleStatusChange(lead, s)} />
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          {persona ? (
                            <div className="space-y-0.5">
                              <Badge variant="outline" className="text-xs">{persona.name}</Badge>
                              <div className="flex flex-wrap gap-1">
                                {persona.sector && <span className="text-[10px] text-muted-foreground">{persona.sector}</span>}
                                {persona.target_type && <span className="text-[10px] text-muted-foreground">· {persona.target_type}</span>}
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          {lead.outreach_type ? (
                            <Badge variant="outline" className="text-xs">{OUTREACH_TYPE_LABELS[lead.outreach_type] || lead.outreach_type}</Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <div className="flex items-center gap-1">
                            {getFollowUpBadge(lead)}
                            {lead.status === 'follow_up' && (lead as any).follow_up_level > 0 && (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">FU {(lead as any).follow_up_level}</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <span className="text-xs font-medium text-muted-foreground">{score}</span>
                        </TableCell>
                        {showSetterUI && (
                          <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                            {teammateLabel(teammateMap.get((lead as any).setter_id || lead.owner_id))}
                          </TableCell>
                        )}
                        <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{format(new Date(lead.created_at), 'dd/MM/yy')}</TableCell>
                        <TableCell className="hidden lg:table-cell" onClick={(e) => e.stopPropagation()}>
                          {lead.linkedin_url && (
                            <a href={lead.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        ) : (
          /* Kanban */
          <div className="overflow-x-auto pb-4" data-testid="leads-kanban">
            <div className="flex gap-3 min-w-max">
              {KANBAN_STATUSES.map((status) => {
                const config = STATUS_CONFIG[status];
                const columnLeads = filteredLeads.filter((sl) => sl.lead.status === status);
                return (
                  <div
                    key={status}
                    className="flex w-64 shrink-0 flex-col rounded-xl border bg-muted/40"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (draggedLeadId) {
                        const lead = allLeads.find((l) => l.id === draggedLeadId);
                        if (lead && lead.status !== status) handleStatusChange(lead, status);
                        setDraggedLeadId(null);
                      }
                    }}
                  >
                    <div className="flex items-center justify-between px-3 py-2.5 border-b">
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{config.label}</span>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">{columnLeads.length}</span>
                    </div>
                    <div className="flex flex-col gap-2 p-2 overflow-y-auto max-h-[calc(100vh-18rem)]">
                      {columnLeads.map(({ lead, score, temperature }) => (
                        <div
                          key={lead.id}
                          draggable
                          onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; setDraggedLeadId(lead.id); }}
                          onDragEnd={() => setDraggedLeadId(null)}
                          className="rounded-lg border bg-card p-3 space-y-2 cursor-grab active:cursor-grabbing hover:shadow-sm transition-shadow"
                          onClick={() => { setSelectedLeadId(lead.id); setDrawerOpen(true); }}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{lead.first_name} {lead.last_name}</p>
                              {lead.company_name && <p className="text-xs text-muted-foreground truncate">{lead.company_name}</p>}
                            </div>
                            <TemperatureBadge temp={temperature} />
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">Score {score}</span>
                            {lead.outreach_type && (
                              <Badge variant="outline" className="text-[10px] px-1.5">
                                {OUTREACH_TYPE_LABELS[lead.outreach_type] || lead.outreach_type}
                              </Badge>
                            )}
                          </div>
                          {lead.linkedin_url && (
                            <a
                              href={lead.linkedin_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                            >
                              <ExternalLink className="h-3 w-3" />
                              Profil LinkedIn
                            </a>
                          )}
                        </div>
                      ))}
                      {columnLeads.length === 0 && (
                        <p className="py-4 text-center text-xs text-muted-foreground">Aucun lead</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <CreateLeadModal open={createOpen} onOpenChange={setCreateOpen} onSubmit={async (data) => { await createLead.mutateAsync(data); }} />
      <ReasonModal open={reasonModalOpen} onOpenChange={(o) => { setReasonModalOpen(o); if (!o) setPendingStatusChange(null); }} type={reasonType} onSubmit={handleReason} />
      <FollowUpDateModal open={followUpModalOpen} onOpenChange={(o) => { setFollowUpModalOpen(o); if (!o) setPendingStatusChange(null); }} onSubmit={handleFollowUpDate} />
      <LeadDetailDrawer lead={selectedLead} open={drawerOpen} onOpenChange={setDrawerOpen} events={leadEvents} onDelete={handleSingleDelete} />

      {/* Delete confirmation */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent data-testid="delete-confirm-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget === 'single'
                ? 'Ce lead sera définitivement supprimé avec son historique et ses notes. Cette action est irréversible.'
                : `${selectedIds.size} leads seront définitivement supprimés avec leur historique et leurs notes. Cette action est irréversible.`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" data-testid="delete-confirm-action">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Merge modal */}
      {selectedLeadsForMerge.length === 2 && (
        <MergeLeadsModal
          open={mergeOpen}
          onOpenChange={setMergeOpen}
          leads={selectedLeadsForMerge}
          onMerge={handleMerge}
        />
      )}
    </AppLayout>
  );
}
