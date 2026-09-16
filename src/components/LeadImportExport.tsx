import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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

/* ─── Column mapping (user-driven, no locked header names) ─── */
type TargetField =
  | 'first_name' | 'last_name' | 'linkedin_url' | 'company_name' | 'job_title'
  | 'status' | 'outreach_type' | 'source_type' | 'campaign_tag' | 'notes'
  | 'follow_up_date' | 'follow_up_level';

const TARGET_FIELDS: Array<{ key: TargetField; label: string; required: boolean }> = [
  { key: 'first_name',      label: 'Prénom',           required: true },
  { key: 'last_name',       label: 'Nom',              required: true },
  { key: 'linkedin_url',    label: 'URL LinkedIn',     required: false },
  { key: 'company_name',    label: 'Entreprise',       required: false },
  { key: 'job_title',       label: 'Poste',            required: false },
  { key: 'status',          label: 'Statut',           required: false },
  { key: 'outreach_type',   label: 'Type de contact',  required: false },
  { key: 'source_type',     label: 'Source',           required: false },
  { key: 'campaign_tag',    label: 'Tag campagne',     required: false },
  { key: 'notes',           label: 'Notes',            required: false },
  { key: 'follow_up_date',  label: 'Date de relance',  required: false },
  { key: 'follow_up_level', label: 'Niveau de relance', required: false },
];

const FIELD_ALIASES: Record<TargetField, string[]> = {
  first_name:      ['first_name', 'firstname', 'prenom', 'first'],
  last_name:       ['last_name', 'lastname', 'nom', 'last', 'name'],
  linkedin_url:    ['linkedin_url', 'url', 'linkedin', 'profil_linkedin'],
  company_name:    ['company_name', 'company', 'entreprise', 'societe'],
  job_title:       ['job_title', 'title', 'poste', 'fonction', 'titre'],
  status:          ['status', 'statut'],
  outreach_type:   ['outreach_type', 'type_contact', 'canal'],
  source_type:     ['source_type', 'source'],
  campaign_tag:    ['campaign_tag', 'campagne', 'tag'],
  notes:           ['notes', 'note', 'commentaire', 'commentaires'],
  follow_up_date:  ['follow_up_date', 'date_relance'],
  follow_up_level: ['follow_up_level', 'niveau_relance'],
};

type ColumnMapping = Record<TargetField, number>; // column index, -1 = not mapped

function normalizeHeader(h: string): string {
  return h
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // é→e, ç→c, etc. avant de filtrer les accents
    .toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}

/* Pre-fill the mapping modal with a best-effort guess — the user still confirms/adjusts it. */
function guessMapping(headers: string[]): ColumnMapping {
  const normalized = headers.map(normalizeHeader);
  const mapping = {} as ColumnMapping;
  for (const field of TARGET_FIELDS) {
    mapping[field.key] = normalized.findIndex((n) => FIELD_ALIASES[field.key].includes(n));
  }
  return mapping;
}

function applyMapping(rows: string[][], mapping: ColumnMapping): Record<string, string>[] {
  return rows.map((values) => {
    const row: Record<string, string> = {};
    for (const field of TARGET_FIELDS) {
      const idx = mapping[field.key];
      row[field.key] = idx >= 0 ? (values[idx] ?? '').trim() : '';
    }
    return row;
  });
}

/* ─── CSV parser (handles quoted fields with commas) ─── */
function splitCsvLine(line: string): string[] {
  return line
    .split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)
    .map((v) => v.trim().replace(/^"|"$/g, ''));
}

function parseCsvRaw(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };
  return {
    headers: splitCsvLine(lines[0]),
    rows: lines.slice(1).map(splitCsvLine),
  };
}

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

  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>(() => guessMapping([]));
  const [showMappingModal, setShowMappingModal] = useState(false);

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
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const { headers, rows } = parseCsvRaw(text);
      if (headers.length === 0 || rows.length === 0) {
        toast({ variant: 'destructive', title: 'Fichier vide ou invalide' });
        return;
      }
      setCsvHeaders(headers);
      setCsvRows(rows);
      setColumnMapping(guessMapping(headers));
      setShowMappingModal(true);
    };
    reader.readAsText(file);
    e.target.value = ''; // allow re-selecting the same file to re-open the mapping modal
  };

  const confirmMapping = () => {
    if (columnMapping.first_name < 0 || columnMapping.last_name < 0) return;
    const rows = applyMapping(csvRows, columnMapping);
    const errors: string[] = [];
    rows.forEach((row, i) => {
      if (!row.first_name?.trim()) errors.push(`Ligne ${i + 2}: prénom manquant`);
      if (!row.last_name?.trim()) errors.push(`Ligne ${i + 2}: nom manquant`);
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
    setShowMappingModal(false);
    setImportOpen(true);
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

      {/* ─── Column mapping modal ─── */}
      <Dialog open={showMappingModal} onOpenChange={setShowMappingModal}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Faire correspondre les colonnes</DialogTitle>
            <DialogDescription>
              Associez les colonnes de votre fichier aux champs attendus par SetterFlow.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {TARGET_FIELDS.map((f) => (
              <div key={f.key} className="flex items-center justify-between gap-3">
                <Label className="text-sm">
                  {f.label} {f.required && <span className="text-destructive">*</span>}
                </Label>
                <Select
                  value={String(columnMapping[f.key])}
                  onValueChange={(v) => setColumnMapping((prev) => ({ ...prev, [f.key]: Number(v) }))}
                >
                  <SelectTrigger className="w-[220px]">
                    <SelectValue placeholder="Non mappé" />
                  </SelectTrigger>
                  <SelectContent>
                    {!f.required && <SelectItem value="-1">Non mappé</SelectItem>}
                    {csvHeaders.map((h, i) => (
                      <SelectItem key={i} value={String(i)}>{h}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>

          {csvRows.length > 0 && (
            <div className="rounded-lg border border-border bg-muted/20 p-2.5 text-xs text-muted-foreground overflow-hidden">
              <p className="mb-1 font-medium text-foreground">Aperçu de la 1ère ligne</p>
              <p className="truncate font-mono">{csvRows[0].join(' · ')}</p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMappingModal(false)}>Annuler</Button>
            <Button onClick={confirmMapping} disabled={columnMapping.first_name < 0 || columnMapping.last_name < 0}>
              Valider le mapping
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{preview.length} lignes détectées</p>
                {csvHeaders.length > 0 && (
                  <button type="button" className="text-xs text-primary hover:underline" onClick={() => setShowMappingModal(true)}>
                    Modifier le mapping des colonnes
                  </button>
                )}
              </div>

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
