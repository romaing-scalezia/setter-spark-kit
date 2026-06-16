import { useParams, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, ArrowLeft, Play, Pause, CheckCircle2, UserCheck, Mail, Users } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useCampaignDetail } from '@/hooks/useCampaignDetail';
import type { CampaignStatus, CampaignLead } from '@/hooks/useCampaignDetail';

const STATUS_LABELS: Record<CampaignStatus, string> = {
  draft:     'Brouillon',
  active:    'Active',
  paused:    'En pause',
  completed: 'Terminée',
};

const STATUS_STYLES: Record<CampaignStatus, string> = {
  draft:     'bg-gray-50 text-gray-600 border-gray-200',
  active:    'bg-emerald-50 text-emerald-700 border-emerald-200',
  paused:    'bg-amber-50 text-amber-700 border-amber-200',
  completed: 'bg-primary/10 text-primary border-primary/20',
};

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
  const { detail, isLoading, toggleStatus } = useCampaignDetail(id);

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
  const acceptRate    = invitedCount > 0
    ? Math.round((acceptedCount / invitedCount) * 100)
    : 0;

  const canToggle = detail.status === 'active' || detail.status === 'paused';

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
                <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[detail.status]}`}>
                  {STATUS_LABELS[detail.status]}
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
          <StatCard label="Réponses reçues"       value="—" sub="Bientôt disponible" />
        </div>

        {/* Leads table */}
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-foreground">Leads ({totalLeads})</h2>

          {totalLeads === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-muted/30 flex items-center justify-center py-10">
              <p className="text-sm text-muted-foreground">Aucun lead dans cette campagne</p>
            </div>
          ) : (
            <div className="rounded-xl border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
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
                        {lead.error_message ? (
                          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-destructive/10 text-destructive border border-destructive/20">
                            Erreur
                          </span>
                        ) : lead.messaged_1_at ? (
                          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20">
                            Messagé
                          </span>
                        ) : lead.accepted_at ? (
                          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Accepté
                          </span>
                        ) : lead.invited_at ? (
                          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            Invité
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-gray-50 text-gray-600 border border-gray-200">
                            En attente
                          </span>
                        )}
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
    </AppLayout>
  );
}
