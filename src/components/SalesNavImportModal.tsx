import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Search, AlertTriangle, CheckCircle2, XCircle, Linkedin } from 'lucide-react';
import { parseFunctionErrorBody } from '@/lib/functionsError';
import { LinkedInConnectDialog } from '@/components/LinkedInConnectDialog';

function salesNavErrorMessage(code: string | undefined, fallback: string): string {
  if (code === 'rate_limited') {
    return "LinkedIn est temporairement surchargé (trop de recherches). Réessaie dans quelques minutes.";
  }
  return code || fallback;
}

interface Prospect {
  provider_id: string | null;
  first_name: string;
  last_name: string;
  headline: string | null;
  company_name: string | null;
  job_title: string | null;
  linkedin_url: string | null;
  location: string | null;
  status: 'new' | 'in_crm' | 'in_campaign';
}

interface Summary {
  total: number;
  new: number;
  in_crm: number;
  in_campaign: number;
}

export interface SalesNavProspect {
  linkedin_url: string | null;
  first_name: string;
  last_name: string;
  company_name: string | null;
  job_title: string | null;
  headline: string | null;
  provider_id: string | null;
  location: string | null;
  status: 'new' | 'in_crm' | 'in_campaign';
}

interface Props {
  open: boolean;
  onClose: () => void;
  onImported: (prospects: SalesNavProspect[]) => void;
}

export function SalesNavImportModal({ open, onClose, onImported }: Props) {
  const { prospectQuota } = useAuth();
  const { toast } = useToast();

  const [url, setUrl]               = useState('');
  const [loading, setLoading]         = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [prospects, setProspects]     = useState<Prospect[]>([]);
  const [summary, setSummary]         = useState<Summary | null>(null);
  const [selected, setSelected]       = useState<Set<string>>(new Set());
  const [nextCursor, setNextCursor]   = useState<string | null>(null);
  const [currentUrl, setCurrentUrl]   = useState<string>('');
  const [reauthAccountId, setReauthAccountId] = useState<string | null>(null);
  const [reconnectOpen, setReconnectOpen]     = useState(false);
  const [pendingImport, setPendingImport]     = useState<Prospect[] | null>(null);

  const reset = () => {
    setUrl('');
    setProspects([]);
    setSummary(null);
    setSelected(new Set());
    setNextCursor(null);
    setCurrentUrl('');
    setReauthAccountId(null);
    setPendingImport(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  // ── Preview ──────────────────────────────────────────────────
  const handlePreview = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setProspects([]);
    setSummary(null);
    setSelected(new Set());
    setReauthAccountId(null);

    try {
      const { data, error } = await supabase.functions.invoke('sales-nav-import', {
        body: { action: 'preview', url: url.trim(), limit: 2500 },
      });

      if (error) {
        const body = await parseFunctionErrorBody(error);
        if (body?.error === 'linkedin_reauth_required') {
          setReauthAccountId((body.account_id as string) ?? null);
          return;
        }
        throw new Error(salesNavErrorMessage(body?.error as string | undefined, error.message));
      }
      if (data?.error) throw new Error(salesNavErrorMessage(data.error, data.error));

      const prv: Prospect[] = data.prospects ?? [];
      setProspects(prv);
      setSummary(data.summary);
      setNextCursor(data.next_cursor ?? null);
      setCurrentUrl(url.trim());

      // Pré-sélectionne tous les "new"
      const newIds = prv
        .filter((p) => p.status === 'new' && p.linkedin_url)
        .map((p) => p.linkedin_url!);
      setSelected(new Set(newIds));
    } catch (err: any) {
      toast({ title: 'Erreur', description: err.message ?? 'Impossible de récupérer les prospects', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // ── Load more ────────────────────────────────────────────────
  const handleLoadMore = async () => {
    if (!nextCursor || !currentUrl) return;
    setLoadingMore(true);
    try {
      const { data, error } = await supabase.functions.invoke('sales-nav-import', {
        body: { action: 'preview', url: currentUrl, limit: 2500, cursor: nextCursor },
      });

      if (error) {
        const body = await parseFunctionErrorBody(error);
        if (body?.error === 'linkedin_reauth_required') {
          setReauthAccountId((body.account_id as string) ?? null);
          return;
        }
        throw new Error(salesNavErrorMessage(body?.error as string | undefined, error.message));
      }
      if (data?.error) throw new Error(salesNavErrorMessage(data.error, data.error));

      const more: Prospect[] = data.prospects ?? [];
      setProspects((prev) => [...prev, ...more]);
      setNextCursor(data.next_cursor ?? null);

      // Pré-sélectionne les nouveaux "new"
      const newIds = more
        .filter((p) => p.status === 'new' && p.linkedin_url)
        .map((p) => p.linkedin_url!);
      setSelected((prev) => new Set([...prev, ...newIds]));

      // Met à jour le summary
      setSummary((prev) => prev ? {
        total:       prev.total + (data.summary?.total ?? 0),
        new:         prev.new + (data.summary?.new ?? 0),
        in_crm:      prev.in_crm + (data.summary?.in_crm ?? 0),
        in_campaign: prev.in_campaign + (data.summary?.in_campaign ?? 0),
      } : data.summary);
    } catch (err: any) {
      toast({ title: 'Erreur', description: err.message ?? 'Impossible de charger plus', variant: 'destructive' });
    } finally {
      setLoadingMore(false);
    }
  };

  // ── Import ───────────────────────────────────────────────────
  const finalizeImport = (toImport: Prospect[]) => {
    // Le quota est décrémenté au lancement de la campagne, pas ici
    toast({
      title: `${toImport.length} prospect${toImport.length > 1 ? 's' : ''} ajouté${toImport.length > 1 ? 's' : ''}`,
      description: 'Ils seront importés dans la campagne au lancement.',
    });
    onImported(toImport as SalesNavProspect[]);
    handleClose();
  };

  const handleImport = async () => {
    const toImport = prospects.filter(
      (p) => p.linkedin_url && selected.has(p.linkedin_url) && p.status !== 'in_campaign',
    );
    if (!toImport.length) return;

    if (toImport.length > prospectQuota.remaining) {
      toast({
        title: 'Quota dépassé',
        description: `Il vous reste ${prospectQuota.remaining} imports ce mois-ci (${toImport.length} sélectionnés).`,
        variant: 'destructive',
      });
      return;
    }

    // Prospects déjà présents dans le CRM — potentiellement déjà contactés
    // manuellement. La campagne ne le sait pas (campaign_leads est un suivi
    // indépendant) et enverrait quand même visite/invitation/message.
    const alreadyInCrm = toImport.filter((p) => p.status === 'in_crm');
    if (alreadyInCrm.length > 0) {
      setPendingImport(toImport);
      return;
    }

    finalizeImport(toImport);
  };

  const toggleSelect = (linkedinUrl: string, status: string) => {
    if (status === 'in_campaign') return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(linkedinUrl)) next.delete(linkedinUrl);
      else next.add(linkedinUrl);
      return next;
    });
  };

  const toggleAll = () => {
    const selectable = prospects
      .filter((p) => p.status !== 'in_campaign' && p.linkedin_url)
      .map((p) => p.linkedin_url!);
    if (selected.size === selectable.length) setSelected(new Set());
    else setSelected(new Set(selectable));
  };

  const selectableCount = prospects.filter((p) => p.status !== 'in_campaign').length;
  const selectedCount   = selected.size;

  return (
    <>
    <AlertDialog open={!!pendingImport} onOpenChange={(o) => !o && setPendingImport(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Prospects déjà dans votre CRM</AlertDialogTitle>
          <AlertDialogDescription>
            {pendingImport?.filter((p) => p.status === 'in_crm').length} des prospects sélectionnés {pendingImport && pendingImport.filter((p) => p.status === 'in_crm').length > 1 ? 'sont déjà des leads' : 'est déjà un lead'} dans votre CRM — vous les avez peut-être déjà contactés. La campagne ne le saura pas et leur enverra quand même la séquence complète (visite, invitation, message) depuis le début.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction onClick={() => { if (pendingImport) finalizeImport(pendingImport); setPendingImport(null); }}>
            Ajouter quand même
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    <LinkedInConnectDialog
      open={reconnectOpen}
      onOpenChange={setReconnectOpen}
      reconnectAccountId={reauthAccountId ?? undefined}
      onSuccess={() => { setReauthAccountId(null); setReconnectOpen(false); }}
    />
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Importer depuis Sales Navigator</DialogTitle>
          <DialogDescription>
            Collez l'URL d'une recherche ou d'une liste Sales Navigator.
          </DialogDescription>
        </DialogHeader>

        {reauthAccountId && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <span className="flex items-center gap-2">
              <Linkedin className="h-4 w-4 shrink-0" />
              Votre session Sales Navigator a expiré côté LinkedIn.
            </span>
            <Button size="sm" variant="outline" className="shrink-0 bg-white" onClick={() => setReconnectOpen(true)}>
              Reconnecter LinkedIn
            </Button>
          </div>
        )}

        {/* Quota bar */}
        <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-xs">
          <span className="text-muted-foreground">Quota mensuel</span>
          <span className="font-medium">
            {prospectQuota.used} / {prospectQuota.total} prospects importés
            <span className="text-muted-foreground ml-1">· {prospectQuota.remaining} restants</span>
          </span>
        </div>

        {/* URL input */}
        <div className="space-y-2">
          <Label>URL Sales Navigator</Label>
          <div className="flex gap-2">
            <Input
              placeholder="https://www.linkedin.com/sales/search/people?... ou https://www.linkedin.com/sales/lists/people/..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !loading && handlePreview()}
              className="flex-1"
            />
            <Button onClick={handlePreview} disabled={!url.trim() || loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              {loading ? 'Chargement...' : 'Analyser'}
            </Button>
          </div>
        </div>

        {/* Summary */}
        {summary && (
          <div className="grid grid-cols-4 gap-2">
            <div className="rounded-lg border bg-card p-2 text-center">
              <p className="text-lg font-semibold">{summary.total}</p>
              <p className="text-[11px] text-muted-foreground">Trouvés</p>
            </div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 p-2 text-center">
              <p className="text-lg font-semibold text-emerald-700 dark:text-emerald-400">{summary.new}</p>
              <p className="text-[11px] text-muted-foreground">Nouveaux</p>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 p-2 text-center">
              <p className="text-lg font-semibold text-amber-700 dark:text-amber-400">{summary.in_crm}</p>
              <p className="text-[11px] text-muted-foreground">Déjà dans le CRM</p>
            </div>
            <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 p-2 text-center">
              <p className="text-lg font-semibold text-red-700 dark:text-red-400">{summary.in_campaign}</p>
              <p className="text-[11px] text-muted-foreground">En campagne active</p>
            </div>
          </div>
        )}

        {/* Prospects table */}
        {prospects.length > 0 && (
          <div className="flex-1 overflow-hidden flex flex-col min-h-0 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">
                {selectedCount} sélectionné{selectedCount > 1 ? 's' : ''} sur {selectableCount} importables
              </p>
              <button
                type="button"
                className="text-xs text-primary hover:underline"
                onClick={toggleAll}
              >
                {selectedCount === selectableCount ? 'Tout désélectionner' : 'Tout sélectionner'}
              </button>
            </div>

            <div className="rounded-xl border overflow-auto flex-1">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Nom</TableHead>
                    <TableHead>Poste</TableHead>
                    <TableHead>Entreprise</TableHead>
                    <TableHead>Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {prospects.map((p, i) => {
                    const isSelected   = !!p.linkedin_url && selected.has(p.linkedin_url);
                    const isBlocked    = p.status === 'in_campaign';
                    const isSelectable = !isBlocked;

                    return (
                      <TableRow
                        key={i}
                        className={isBlocked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                        onClick={() => p.linkedin_url && toggleSelect(p.linkedin_url, p.status)}
                      >
                        <TableCell>
                          {isBlocked ? (
                            <XCircle className="h-4 w-4 text-destructive" />
                          ) : isSelected ? (
                            <CheckCircle2 className="h-4 w-4 text-primary" />
                          ) : (
                            <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30" />
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm font-medium">
                            {p.first_name} {p.last_name}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground line-clamp-1">
                            {p.job_title ?? p.headline ?? '—'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground">{p.company_name ?? '—'}</span>
                        </TableCell>
                        <TableCell>
                          {p.status === 'new' && (
                            <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 text-[10px]">
                              Nouveau
                            </Badge>
                          )}
                          {p.status === 'in_crm' && (
                            <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50 dark:bg-amber-950/20 text-[10px]">
                              Dans le CRM
                            </Badge>
                          )}
                          {p.status === 'in_campaign' && (
                            <Badge variant="outline" className="text-destructive border-red-200 bg-red-50 dark:bg-red-950/20 text-[10px]">
                              En campagne
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {nextCursor && (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={handleLoadMore}
                disabled={loadingMore}
              >
                {loadingMore
                  ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />Chargement...</>
                  : 'Charger plus de prospects'
                }
              </Button>
            )}

            {summary && summary.in_campaign > 0 && (
              <div className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>{summary.in_campaign} prospect{summary.in_campaign > 1 ? 's sont' : ' est'} bloqué{summary.in_campaign > 1 ? 's' : ''} — déjà en campagne active et ne peuvent pas être réimportés.</span>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose}>
            Annuler
          </Button>
          <Button
            onClick={handleImport}
            disabled={selectedCount === 0 || !summary}
          >
            Importer {selectedCount > 0 ? `${selectedCount} prospect${selectedCount > 1 ? 's' : ''}` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
