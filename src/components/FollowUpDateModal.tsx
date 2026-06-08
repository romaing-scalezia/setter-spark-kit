import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface FollowUpDateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (date: Date) => void;
}

export function FollowUpDateModal({ open, onOpenChange, onSubmit }: FollowUpDateModalProps) {
  const [date, setDate] = useState<Date | undefined>(undefined);

  const handleSubmit = () => {
    if (date) {
      onSubmit(date);
      setDate(undefined);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Date de relance</DialogTitle>
        </DialogHeader>
        <div className="flex justify-center">
          <Calendar
            mode="single"
            selected={date}
            onSelect={setDate}
            disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
            className={cn("p-3 pointer-events-auto")}
            locale={fr}
          />
        </div>
        {date && (
          <p className="text-center text-sm text-muted-foreground">
            Relance le {format(date, 'dd MMMM yyyy', { locale: fr })}
          </p>
        )}
        <Button onClick={handleSubmit} disabled={!date} className="w-full">
          Confirmer
        </Button>
      </DialogContent>
    </Dialog>
  );
}
