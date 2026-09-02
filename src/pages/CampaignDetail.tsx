import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Loader2, ArrowLeft, Play, Pause, Pencil, CheckCircle2, UserCheck, Mail, Users, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useCampaignDetail } from '@/hooks/useCampaignDetail';
import type { CampaignStatus, CampaignLead } from '@/hooks/useCampaignDetail';
import {
  CAMPAIGN_STATUS_LABELS,
  CAMPAIGN_STATUS_STYLES,
  CAMPAIGN_LEAD_STATUS_STYLES,
  CAMPAIGN_LEAD_STATUS_LABELS,
} from '@/lib/constants';

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function formatDate(d: string | null) {
  if (!d) return '—';
  return format(new Date(d), 'd MMM', { locale: fr });
}

function leadName(lead: CampaignLead) {
  const parts = [lead.first_name, lead.last_name].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : lead.linkedin_url;
}

export default function CampaignDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { detail, isLoading, toggleStatus, deleteLeads } = useCampaignDetail(id);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  if (!detail) {
    return (
      <AppLayout>
        <div className="p-6">
          <p className="text-sm text-muted-foreground">Campagne introuvable.</p>
        </div>
      </AppLayout>
    );
  }

  const leads = detail.leads;
  const totalLeads    = leads.length;
  const invitedCount  = leads.filter((l) => l.invited_at).length;
  const acceptedCount = leads.filter((l) => l.accepted_at).length;
  const messaged1     = leads.filter((l) => l.messaged_1_at).length;
  const repliedCount  = leads.filter((l) => l.replied_at).length;
  const acceptRate    = invitedCount > 0
    ? Math.round((acceptedCount / invitedCount) * 100)
    : 0;

  const canToggle = detail.status === 'active' || detail.status === 'paused';

  const allSelected = totalLeads > 0 && selectedIds.size === totalLeads;
  const toggleAll = () => setSelectedIds(allSelected ? new Set() : new Set(leads.map((l) => l.id)));
  const toggleOne = (leadId: string) => setSelectedIds((prev) => {
    const next = new Set(prev);
    if (next.has(leadId)) next.delete(leadId); else next.add(leadId);
    return next;
  });
  const confirmDelete = () => {
    deleteLeads.mutate(Array.from(selectedIds), { onSuccess: () => setSelectedIds(new Set()) });
    setDeleteConfirmOpen(false);
  };

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 space-y-6" data-testid="page-campaign-detail">
        {/* Back + Header */}
        <div className="space-y-3">
          <Button variant="ghost" size="sm" className="text-muted-foreground -ml-1" onClick={() => navigate('/campaigns')}>
            <ArrowLeft className="h-3.5 w-3.5 mr-1" />
            Campagnes
          </Button>

          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-bold text-foreground">{detail.name}</h1>
                <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${CAMPAIGN_STATUS_STYLES[detail.status]}`}>
                  {CAMPAIGN_STATUS_LABELS[detail.status]}
                </span>
                <Badge variant="outline" className="font-mono text-xs">
                  Scénario {detail.scenario_type}
                </Badge>
              </div>
              {detail.persona_name && (
                <p className="text-sm text-muted-foreground">Persona : {detail.persona_name}</p>
              )}
            </div>

            {canToggle && (
              <Button
                variant={detail.status === 'active' ? 'outline' : 'default'}
                disabled={toggleStatus.isPending}
                onClick={() => toggleStatus.mutate({ currentStatus: detail.status })}
              >
                {toggleStatus.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                ) : detail.status === 'active' ? (
                  <Pause className="h-4 w-4 mr-1.5" />
                ) : (
                  <Play className="h-4 w-4 mr-1.5" />
                )}
                {detail.status === 'active' ? 'Mettre en pause' : 'Reprendre'}
              </Button>
            )}

            {detail.status === 'draft' && (
              <Button onClick={() => navigate(`/campaigns/${id}/edit`)}>
                <Pencil className="h-4 w-4 mr-1.5" />
                Modifier
              </Button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard label="Leads importés"        value={totalLeads} />
          <StatCard label="Visites effectuées"    value={detail.visits_done} />
          <StatCard label="Invitations envoyées"  value={invitedCount} />
          <StatCard
            label="Taux d'acceptation"
            value={`${acceptRate}%`}
            sub={`${acceptedCount} / ${invitedCount}`}
          />
          <StatCard label="Messages envoyés"      value={messaged1} />
          <StatCard label="Réponses reçues"       value={repliedCount} />
        </div>

        {/* Leads table */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">Leads ({totalLeads})</h2>
            {selectedIds.size > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setDeleteConfirmOpen(true)}
                disabled={deleteLeads.isPending}
              >
                {deleteLeads.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Trash2 className="h-3.5 w-3.5 mr-1.5" />}
                Supprimer ({selectedIds.size})
              </Button>
            )}
          </div>

          {totalLeads === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-muted/30 flex items-center justify-center py-10">
              <p className="text-sm text-muted-foreground">Aucun lead dans cette campagne</p>
            </div>
          ) : (
            <div className="rounded-xl border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="w-10">
                      <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Tout sélectionner" />
                    </TableHead>
                    <TableHead>Lead</TableHead>
                    <TableHead>Entreprise</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>
                      <span className="flex items-center gap-1.5">
                        <UserCheck className="h-3.5 w-3.5" />
                        Invitation
                      </span>
                    </TableHead>
                    <TableHead>
                      <span className="flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Acceptation
                      </span>
                    </TableHead>
                    <TableHead>
                      <span className="flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5" />
                        Msg 1
                      </span>
                    </TableHead>
                    <TableHead>Msg 2</TableHead>
                    <TableHead>Msg 3</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leads.map((lead) => (
                    <TableRow key={lead.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(lead.id)}
                          onCheckedChange={() => toggleOne(lead.id)}
                          aria-label={`Sélectionner ${leadName(lead)}`}
                        />
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm font-medium text-foreground">{leadName(lead)}</p>
                          <a
                            href={lead.linkedin_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-primary hover:underline truncate max-w-[160px] block"
                            onClick={(e) => e.stopPropagation()}
                          >
                            LinkedIn ↗
                          </a>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">{lead.company_name || '—'}</span>
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const key = lead.error_message
                            ? 'error'
                            : lead.replied_at
                            ? 'replied'
                            : lead.messaged_1_at
                            ? 'done'
                            : lead.accepted_at
                            ? 'accepted'
                            : lead.invited_at
                            ? 'invited'
                            : 'pending';
                          return (
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold border ${CAMPAIGN_LEAD_STATUS_STYLES[key]}`}>
                              {CAMPAIGN_LEAD_STATUS_LABELS[key]}
                            </span>
                          );
                        })()}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">{formatDate(lead.invited_at)}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">{formatDate(lead.accepted_at)}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">{formatDate(lead.messaged_1_at)}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">{formatDate(lead.messaged_2_at)}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">{formatDate(lead.messaged_3_at)}</span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer {selectedIds.size} prospect{selectedIds.size > 1 ? 's' : ''} ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Tout job en attente (visite, invitation, message) pour {selectedIds.size > 1 ? 'ces prospects' : 'ce prospect'} sera annulé.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
