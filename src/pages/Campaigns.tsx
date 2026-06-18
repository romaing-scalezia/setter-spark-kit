import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Loader2, Plus, BarChart2, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useCampaigns } from '@/hooks/useCampaigns';
import type { CampaignStatus } from '@/hooks/useCampaigns';
import { CAMPAIGN_STATUS_LABELS, CAMPAIGN_STATUS_STYLES } from '@/lib/constants';

export default function Campaigns() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { campaigns, isLoading, toggleStatus, deleteCampaign } = useCampaigns();

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [personaFilter, setPersonaFilter] = useState<string>('all');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const { data: personas = [] } = useQuery({
    queryKey: ['personas-filter', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('personas').select('id, name').order('name');
      return (data ?? []) as { id: string; name: string }[];
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  const filtered = campaigns.filter((c) => {
    if (statusFilter !== 'all' && c.status !== statusFilter) return false;
    if (personaFilter !== 'all' && (c.persona_id ?? '') !== personaFilter) return false;
    return true;
  });

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 space-y-5" data-testid="page-campaigns">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Campagnes</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Automatisez vos séquences d'outreach LinkedIn
            </p>
          </div>
          <Button onClick={() => navigate('/campaigns/new')}>
            <Plus className="h-4 w-4 mr-1.5" />
            Créer une campagne
          </Button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Tous les statuts" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="paused">En pause</SelectItem>
              <SelectItem value="completed">Terminée</SelectItem>
              <SelectItem value="draft">Brouillon</SelectItem>
            </SelectContent>
          </Select>

          {personas.length > 0 && (
            <Select value={personaFilter} onValueChange={setPersonaFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Tous les personas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les personas</SelectItem>
                {personas.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {(statusFilter !== 'all' || personaFilter !== 'all') && (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => { setStatusFilter('all'); setPersonaFilter('all'); }}
            >
              Réinitialiser
            </Button>
          )}
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/30 flex flex-col items-center justify-center py-16 gap-3">
            <p className="text-sm text-muted-foreground">Aucune campagne trouvée</p>
            <Button size="sm" variant="outline" onClick={() => navigate('/campaigns/new')}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Créer une campagne
            </Button>
          </div>
        ) : (
          <div className="rounded-xl border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="w-14 text-center">Actif</TableHead>
                  <TableHead>Nom</TableHead>
                  <TableHead>Scénario</TableHead>
                  <TableHead>Prospects</TableHead>
                  <TableHead>Persona</TableHead>
                  <TableHead>Créée le</TableHead>
                  <TableHead className="w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((campaign) => (
                  <TableRow
                    key={campaign.id}
                    className="cursor-pointer hover:bg-muted/30"
                    onClick={() => navigate(`/campaigns/${campaign.id}`)}
                  >
                    <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                      <Switch
                        checked={campaign.status === 'active'}
                        disabled={
                          campaign.status === 'completed' ||
                          campaign.status === 'draft' ||
                          toggleStatus.isPending
                        }
                        onCheckedChange={() =>
                          toggleStatus.mutate({ id: campaign.id, currentStatus: campaign.status })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">{campaign.name}</span>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold border ${CAMPAIGN_STATUS_STYLES[campaign.status]}`}
                        >
                          {CAMPAIGN_STATUS_LABELS[campaign.status]}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-xs">
                        Scénario {campaign.scenario_type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-foreground">
                        {campaign.done_leads}
                        <span className="text-muted-foreground">/{campaign.total_leads}</span>
                      </span>
                    </TableCell>
                    <TableCell>
                      {campaign.persona_name ? (
                        <span className="text-sm text-foreground">{campaign.persona_name}</span>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {format(new Date(campaign.created_at), 'd MMM yyyy', { locale: fr })}
                      </span>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          onClick={() => navigate(`/campaigns/${campaign.id}`)}
                        >
                          <BarChart2 className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => setDeleteTarget({ id: campaign.id, name: campaign.name })}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer la campagne ?</AlertDialogTitle>
            <AlertDialogDescription>
              La campagne <span className="font-semibold text-foreground">"{deleteTarget?.name}"</span> et tous ses leads associés seront supprimés définitivement.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteTarget) deleteCampaign.mutate(deleteTarget.id);
                setDeleteTarget(null);
              }}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
