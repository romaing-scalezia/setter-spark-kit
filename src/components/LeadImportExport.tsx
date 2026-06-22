import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { Download, Upload, FileUp, AlertCircle, CheckCircle2 } from 'lucide-react';
import type { Lead, LeadStatus } from '@/lib/constants';
import { STATUS_CONFIG, OUTREACH_TYPE_LABELS } from '@/lib/constants';
import { format } from 'date-fns';

const VALID_STATUSES: LeadStatus[] = ['conversation_engagee', 'en_cours', 'appel_propose', 'follow_up', 'rendez_vous_booke', 'ferme_perdu', 'non_qualifie'];
const VALID_OUTREACH = ['message_texte', 'video', 'vocal', 'autre'];

interface LeadImportExportProps {
  leads: Lead[];
  personaMap: Map<string, { id: string; name: string }>;
}

function escapeCsv(val: string | null | undefined): string {
  if (val == null) return '';
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function LeadImportExport({ leads, personaMap }: LeadImportExportProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<Record<string, string>[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importResult, setImportResult] = useState<{ success: number; skipped: number; errors: string[] } | null>(null);

  // --- EXPORT ---
  const handleExport = () => {
    const headers = [
      'first_name', 'last_name', 'linkedin_url', 'company_name', 'job_title',
      'status', 'follow_up_level', 'follow_up_date', 'outreach_type',
      'source_type', 'campaign_tag', 'persona',
      'loss_reason', 'disqualification_reason', 'reason_detail',
      'notes', 'created_at', 'updated_at',
    ];

    const rows = leads.map((l) => {
      const persona = (l as any).persona_id ? personaMap.get((l as any).persona_id)?.name || '' : '';
      return [
        l.first_name, l.last_name, l.linkedin_url, l.company_name, l.job_title,
        l.status, String(l.follow_up_level || 0), l.follow_up_date, l.outreach_type,
        l.source_type, l.campaign_tag, persona,
        l.loss_reason, l.disqualification_reason, l.reason_detail,
        l.notes, l.created_at, l.updated_at,
      ].map(escapeCsv);
    });

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads_export_${format(new Date(), 'yyyy-MM-dd_HHmm')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: `${leads.length} leads exportés` });
  };

  // --- IMPORT ---
  const parseCsv = (text: string): Record<string, string>[] => {
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map((h) => h.trim().replace(/^"(.*)"$/, '$1'));
    return lines.slice(1).map((line) => {
      const values: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inQuotes) {
          if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
          else if (ch === '"') { inQuotes = false; }
          else { current += ch; }
        } else {
          if (ch === '"') { inQuotes = true; }
          else if (ch === ',') { values.push(current.trim()); current = ''; }
          else { current += ch; }
        }
      }
      values.push(current.trim());
      const row: Record<string, string> = {};
      headers.forEach((h, i) => { row[h] = values[i] || ''; });
      return row;
    });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const rows = parseCsv(text);
      const errors: string[] = [];
      rows.forEach((row, i) => {
        if (!row.first_name?.trim()) errors.push(`Ligne ${i + 2}: first_name manquant`);
        if (!row.last_name?.trim()) errors.push(`Ligne ${i + 2}: last_name manquant`);
        if (row.status && !VALID_STATUSES.includes(row.status as LeadStatus)) {
          errors.push(`Ligne ${i + 2}: statut invalide "${row.status}"`);
        }
        if (row.outreach_type && !VALID_OUTREACH.includes(row.outreach_type)) {
          errors.push(`Ligne ${i + 2}: outreach_type invalide "${row.outreach_type}"`);
        }
      });
      setPreview(rows);
      setImportErrors(errors);
      setImportResult(null);
      setImportOpen(true);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleImport = async () => {
    setImporting(true);
    let success = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (let i = 0; i < preview.length; i++) {
      const row = preview[i];
      if (!row.first_name?.trim() || !row.last_name?.trim()) {
        skipped++;
        errors.push(`Ligne ${i + 2}: champs requis manquants`);
        continue;
      }
      if (row.status && !VALID_STATUSES.includes(row.status as LeadStatus)) {
        skipped++;
        errors.push(`Ligne ${i + 2}: statut invalide`);
        continue;
      }

      const insertData: Record<string, any> = {
        owner_id: user!.id,
        first_name: row.first_name.trim(),
        last_name: row.last_name.trim(),
        linkedin_url: row.linkedin_url?.trim() || null,
        company_name: row.company_name?.trim() || null,
        job_title: row.job_title?.trim() || null,
        status: (row.status?.trim() as LeadStatus) || 'conversation_engagee',
        outreach_type: row.outreach_type?.trim() || null,
        source_type: row.source_type?.trim() || null,
        campaign_tag: row.campaign_tag?.trim() || null,
        notes: row.notes?.trim() || null,
        follow_up_date: row.follow_up_date?.trim() || null,
        follow_up_level: parseInt(row.follow_up_level) || 0,
        conversation_started_at: new Date().toISOString(),
      };

      const { error } = await supabase.from('leads').insert(insertData as any);
      if (error) {
        skipped++;
        errors.push(`Ligne ${i + 2}: ${error.message}`);
      } else {
        success++;
      }
    }

    setImportResult({ success, skipped, errors });
    setImporting(false);
    if (success > 0) {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-leads'] });
    }
  };

  return (
    <>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
          <Download className="mr-1.5 h-4 w-4" />Importer CSV
        </Button>
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Upload className="mr-1.5 h-4 w-4" />Exporter CSV
        </Button>
        <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFileSelect} />
      </div>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileUp className="h-5 w-5" />Import de leads
            </DialogTitle>
            <DialogDescription>
              Vérifiez l'aperçu ci-dessous puis confirmez l'import.
            </DialogDescription>
          </DialogHeader>

          {importResult ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span className="font-medium">{importResult.success} leads importés</span>
              </div>
              {importResult.skipped > 0 && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  <span>{importResult.skipped} lignes ignorées</span>
                </div>
              )}
              {importResult.errors.length > 0 && (
                <div className="rounded border p-2 text-xs space-y-1 max-h-40 overflow-y-auto">
                  {importResult.errors.map((e, i) => <p key={i} className="text-destructive">{e}</p>)}
                </div>
              )}
              <DialogFooter>
                <Button onClick={() => setImportOpen(false)}>Fermer</Button>
              </DialogFooter>
            </div>
          ) : (
            <>
              {importErrors.length > 0 && (
                <div className="rounded border border-destructive/30 bg-destructive/5 p-3 space-y-1 text-xs max-h-32 overflow-y-auto">
                  {importErrors.map((e, i) => <p key={i} className="text-destructive">{e}</p>)}
                </div>
              )}

              <p className="text-sm text-muted-foreground">{preview.length} lignes détectées</p>

              {preview.length > 0 && (
                <div className="rounded border overflow-x-auto max-h-60 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Prénom</TableHead>
                        <TableHead className="text-xs">Nom</TableHead>
                        <TableHead className="text-xs">Statut</TableHead>
                        <TableHead className="text-xs">LinkedIn</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {preview.slice(0, 10).map((row, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-xs">{row.first_name || '—'}</TableCell>
                          <TableCell className="text-xs">{row.last_name || '—'}</TableCell>
                          <TableCell className="text-xs">
                            {row.status ? <Badge variant="outline" className="text-[10px]">{STATUS_CONFIG[row.status as LeadStatus]?.label || row.status}</Badge> : '—'}
                          </TableCell>
                          <TableCell className="text-xs truncate max-w-[150px]">{row.linkedin_url || '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {preview.length > 10 && <p className="text-xs text-muted-foreground p-2">… et {preview.length - 10} autres lignes</p>}
                </div>
              )}

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setImportOpen(false)}>Annuler</Button>
                <Button onClick={handleImport} disabled={importing || preview.length === 0 || importErrors.length > 0}>
                  {importing ? 'Import en cours...' : `Importer ${preview.length} leads`}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
