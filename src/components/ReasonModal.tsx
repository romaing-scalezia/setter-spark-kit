import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { LOSS_REASONS, DISQUALIFICATION_REASONS } from '@/lib/constants';
import { Plus, Trash2 } from 'lucide-react';

interface CustomReason {
  id: string;
  label: string;
}

interface ReasonModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: 'loss' | 'disqualification';
  onSubmit: (reason: string, detail?: string) => void;
}

export function ReasonModal({ open, onOpenChange, type, onSubmit }: ReasonModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const defaultReasons = useMemo(
    () => (type === 'loss' ? LOSS_REASONS : DISQUALIFICATION_REASONS),
    [type]
  );
  const title = type === 'loss' ? 'Raison de perte' : 'Raison de disqualification';

  const { data: customReasons = [] } = useQuery({
    queryKey: ['custom-reasons', type, user?.id],
    enabled: open && !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('custom_reasons')
        .select('id, label')
        .eq('type', type)
        .eq('user_id', user!.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return (data || []) as CustomReason[];
    },
  });

  const addReason = useMutation({
    mutationFn: async (label: string) => {
      const { error } = await supabase.from('custom_reasons').insert({
        user_id: user!.id,
        type,
        label,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['custom-reasons', type, user?.id] });
      setNewLabel('');
      setIsAdding(false);
      toast({ title: 'Raison ajoutée' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Erreur', description: error.message });
    },
  });

  const deleteReason = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('custom_reasons')
        .delete()
        .eq('id', id)
        .eq('user_id', user!.id);

      if (error) throw error;
    },
    onSuccess: async (_data, id) => {
      if (selected === id) setSelected('');
      await queryClient.invalidateQueries({ queryKey: ['custom-reasons', type, user?.id] });
      toast({ title: 'Raison supprimée' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Suppression impossible', description: error.message });
    },
  });

  useEffect(() => {
    if (!open) return;
    setSelected('');
    setNewLabel('');
    setIsAdding(false);
  }, [open, type]);

  const handleSubmit = () => {
    if (!selected) return;

    const customReason = customReasons.find((reason) => reason.id === selected);
    if (customReason) {
      onSubmit('autre', customReason.label);
    } else {
      onSubmit(selected);
    }

    onOpenChange(false);
  };

  const handleAddReason = () => {
    const label = newLabel.trim();
    if (!label) return;
    addReason.mutate(label);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <RadioGroup value={selected} onValueChange={setSelected} className="space-y-2 max-h-[40vh] overflow-auto pr-1">
            {Object.entries(defaultReasons).map(([key, label]) => (
              <label key={key} htmlFor={`reason-${key}`} className="flex items-center gap-3 rounded-md border p-3 cursor-pointer hover:bg-muted/50">
                <RadioGroupItem value={key} id={`reason-${key}`} />
                <span className="flex-1 text-sm text-foreground">{label}</span>
              </label>
            ))}

            {customReasons.length > 0 && <Separator className="my-3" />}

            {customReasons.map((reason) => (
              <div key={reason.id} className="flex items-center gap-2 rounded-md border p-3">
                <label htmlFor={`reason-${reason.id}`} className="flex min-w-0 flex-1 items-center gap-3 cursor-pointer">
                  <RadioGroupItem value={reason.id} id={`reason-${reason.id}`} />
                  <span className="truncate text-sm text-foreground">{reason.label}</span>
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => deleteReason.mutate(reason.id)}
                  disabled={deleteReason.isPending}
                  aria-label={`Supprimer ${reason.label}`}
                >
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            ))}
          </RadioGroup>

          <div className="space-y-2 rounded-md border bg-muted/30 p-3">
            <Label className="text-sm">Ajouter une raison personnalisée</Label>
            <div className="flex gap-2">
              <Input
                value={newLabel}
                onChange={(event) => setNewLabel(event.target.value)}
                placeholder="Ex: Pas prioritaire"
                onKeyDown={(event) => {
                  if (event.key === 'Enter') handleAddReason();
                }}
              />
              <Button type="button" variant="outline" onClick={handleAddReason} disabled={!newLabel.trim() || addReason.isPending}>
                <Plus className="mr-2 h-4 w-4" />
                Ajouter
              </Button>
            </div>
          </div>

          <Button onClick={handleSubmit} disabled={!selected} className="w-full">
            Confirmer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
