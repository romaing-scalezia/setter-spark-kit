import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { CloseWonModal } from '@/components/CloseWonModal';
import { ReasonModal } from '@/components/ReasonModal';
import { Loader2 } from 'lucide-react';
import { startOfDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { EnrichedTask } from '@/components/TaskCard';
import type { useTaskActions } from '@/hooks/useTaskActions';

interface TaskActionDialogsProps {
  actions: ReturnType<typeof useTaskActions>;

  snoozeTask: EnrichedTask | null;
  setSnoozeTask: (task: EnrichedTask | null) => void;
  snoozeDate: Date | undefined;
  setSnoozeDate: (date: Date | undefined) => void;

  rdvWonTask: EnrichedTask | null;
  setRdvWonTask: (task: EnrichedTask | null) => void;

  rdvLostTask: EnrichedTask | null;
  setRdvLostTask: (task: EnrichedTask | null) => void;
}

/** Reporter / RDV gagne / RDV perdu — dialogs partages entre Follow-ups et Dashboard. */
export function TaskActionDialogs({
  actions,
  snoozeTask, setSnoozeTask, snoozeDate, setSnoozeDate,
  rdvWonTask, setRdvWonTask,
  rdvLostTask, setRdvLostTask,
}: TaskActionDialogsProps) {
  const { snoozeMutation, rdvWonMutation, rdvLostMutation } = actions;

  return (
    <>
      <Dialog open={!!snoozeTask} onOpenChange={(o) => !o && setSnoozeTask(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Reporter à...</DialogTitle>
          </DialogHeader>
          <div className="flex justify-center">
            <Calendar
              mode="single"
              selected={snoozeDate}
              onSelect={setSnoozeDate}
              disabled={(d) => d <= startOfDay(new Date())}
              className={cn('p-3 pointer-events-auto')}
              locale={fr}
            />
          </div>
          <Button
            disabled={!snoozeDate || snoozeMutation.isPending}
            onClick={() =>
              snoozeTask && snoozeDate &&
              snoozeMutation.mutate({ task: snoozeTask, until: snoozeDate }, {
                onSuccess: () => { setSnoozeTask(null); setSnoozeDate(undefined); },
              })
            }
            className="w-full"
          >
            {snoozeMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Reporter
          </Button>
        </DialogContent>
      </Dialog>

      <CloseWonModal
        open={!!rdvWonTask}
        onOpenChange={(o) => !o && setRdvWonTask(null)}
        lead={rdvWonTask?.lead ?? null}
        onSubmit={(amount) =>
          rdvWonTask &&
          rdvWonMutation.mutate({ task: rdvWonTask, amount }, { onSuccess: () => setRdvWonTask(null) })
        }
        isPending={rdvWonMutation.isPending}
      />
      <ReasonModal
        open={!!rdvLostTask}
        onOpenChange={(o) => !o && setRdvLostTask(null)}
        type="loss"
        onSubmit={(reason, detail) =>
          rdvLostTask &&
          rdvLostMutation.mutate({ task: rdvLostTask, reason, detail }, { onSuccess: () => setRdvLostTask(null) })
        }
      />
    </>
  );
}
