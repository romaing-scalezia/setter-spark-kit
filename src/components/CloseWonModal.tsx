import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Lead } from '@/lib/constants';

interface CloseWonModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Lead | null;
  onSubmit: (amount: number) => void;
  isPending?: boolean;
}

export function CloseWonModal({ open, onOpenChange, lead, onSubmit, isPending }: CloseWonModalProps) {
  const [amount, setAmount] = useState('');

  const parsed = Number(amount);
  const isValid = amount.trim().length > 0 && Number.isFinite(parsed) && parsed > 0;

  const handleSubmit = () => {
    if (!isValid) return;
    onSubmit(parsed);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setAmount(''); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Fermé gagné 🎉</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {lead ? <>Renseigne le montant signé pour <span className="font-medium text-foreground">{lead.first_name} {lead.last_name}</span>.</> : 'Renseigne le montant signé.'}
        </p>
        <div className="space-y-1.5">
          <Label htmlFor="deal-amount">Montant (€) <span className="text-destructive">*</span></Label>
          <Input
            id="deal-amount"
            type="number"
            min={0}
            step="0.01"
            placeholder="Ex : 2500"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            autoFocus
          />
        </div>
        <Button onClick={handleSubmit} disabled={!isValid || isPending} className="w-full">
          Confirmer
        </Button>
      </DialogContent>
    </Dialog>
  );
}
