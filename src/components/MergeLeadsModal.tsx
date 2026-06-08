import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import type { Lead } from '@/lib/constants';

interface MergeLeadsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leads: Lead[];
  onMerge: (primaryId: string, secondaryId: string) => Promise<void>;
}

export function MergeLeadsModal({ open, onOpenChange, leads, onMerge }: MergeLeadsModalProps) {
  const [primaryId, setPrimaryId] = useState<string>(leads[0]?.id || '');
  const [merging, setMerging] = useState(false);

  if (leads.length !== 2) return null;

  const handleMerge = async () => {
    const secondaryId = leads.find(l => l.id !== primaryId)?.id;
    if (!secondaryId) return;
    setMerging(true);
    try {
      await onMerge(primaryId, secondaryId);
      onOpenChange(false);
    } finally {
      setMerging(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Fusionner les leads</DialogTitle>
          <DialogDescription>
            Choisissez le lead principal. Les données manquantes seront complétées avec le lead secondaire, puis ce dernier sera supprimé.
          </DialogDescription>
        </DialogHeader>

        <RadioGroup value={primaryId} onValueChange={setPrimaryId} className="space-y-3">
          {leads.map((lead) => (
            <div key={lead.id} className="flex items-start gap-3 rounded-lg border p-3">
              <RadioGroupItem value={lead.id} id={lead.id} className="mt-0.5" />
              <Label htmlFor={lead.id} className="flex-1 cursor-pointer space-y-1">
                <p className="font-medium text-sm">{lead.first_name} {lead.last_name}</p>
                {lead.company_name && <p className="text-xs text-muted-foreground">{lead.company_name}</p>}
                <div className="flex flex-wrap gap-1">
                  <Badge variant="outline" className="text-[10px]">{lead.status}</Badge>
                  {lead.linkedin_url && <Badge variant="secondary" className="text-[10px]">LinkedIn ✓</Badge>}
                </div>
              </Label>
            </div>
          ))}
        </RadioGroup>

        <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
          <p className="font-medium">Stratégie de fusion :</p>
          <ul className="list-disc list-inside space-y-0.5">
            <li>Le lead principal conserve ses données existantes</li>
            <li>Les champs vides sont complétés par le lead secondaire</li>
            <li>Les notes et l'historique sont conservés</li>
            <li>Le lead secondaire est supprimé après fusion</li>
          </ul>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={handleMerge} disabled={merging || !primaryId}>
            {merging ? 'Fusion...' : 'Fusionner'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
