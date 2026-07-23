import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface RdvDateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (date: Date) => void;
}

export function RdvDateModal({ open, onOpenChange, onSubmit }: RdvDateModalProps) {
  const [date, setDate] = useState<Date | undefined>(undefined);

  const handleSubmit = () => {
    if (!date) return;
    onSubmit(date);
    setDate(undefined);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Date du rendez-vous</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Renseigne la date du rendez-vous pour valider ce statut.
        </p>
        <div className="flex justify-center">
          <Calendar
            mode="single"
            selected={date}
            onSelect={setDate}
            className={cn("p-3 pointer-events-auto")}
            locale={fr}
          />
        </div>
        {date && (
          <p className="text-center text-sm text-muted-foreground">
            RDV le {format(date, 'dd MMMM yyyy', { locale: fr })}
          </p>
        )}
        <Button onClick={handleSubmit} disabled={!date} className="w-full">
          Confirmer
        </Button>
      </DialogContent>
    </Dialog>
  );
}
