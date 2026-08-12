import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, CheckCircle2, Clock, AlarmClockOff, Eye, Loader2, Trophy, XCircle, CalendarClock } from 'lucide-react';
import { format, isPast, isToday } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  PRIORITY_META,
  TASK_TYPE_LABELS,
  type Task,
  type TaskPriority,
} from '@/lib/tasks';
import type { Lead } from '@/lib/constants';

export interface EnrichedTask extends Task {
  lead?: Lead | null;
  effectivePriority: TaskPriority;
}

interface TaskCardProps {
  task: EnrichedTask;
  onComplete: (task: EnrichedTask) => void;
  onSnooze?: (task: EnrichedTask) => void;
  onOpenLead: (task: EnrichedTask) => void;
  onRdvWon?: (task: EnrichedTask) => void;
  onRdvLost?: (task: EnrichedTask) => void;
  onRdvPostpone?: (task: EnrichedTask) => void;
  isUpdating?: boolean;
  compact?: boolean;
}

export function TaskCard({ task, onComplete, onSnooze, onOpenLead, onRdvWon, onRdvLost, onRdvPostpone, isUpdating, compact }: TaskCardProps) {
  const navigate = useNavigate();
  const meta = PRIORITY_META[task.effectivePriority];
  const due = new Date(task.due_date);
  const overdue = isPast(due) && !isToday(due);
  const lead = task.lead;
  const leadName = lead ? `${lead.first_name} ${lead.last_name}` : 'Lead supprimé';
  const chatId = (lead as any)?.unipile_chat_id as string | null | undefined;
  const canOpenConversation = !!(chatId || lead?.linkedin_url);

  const openConversation = () => {
    if (chatId) {
      navigate(`/inbox?chat=${chatId}`);
    } else if (lead?.linkedin_url) {
      window.open(lead.linkedin_url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div
      className={`flex items-center justify-between rounded-md border bg-card p-3 hover:bg-muted/30 transition-colors ${canOpenConversation ? 'cursor-pointer' : ''}`}
      onClick={canOpenConversation ? openConversation : undefined}
      data-testid={`task-card-${task.id}`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <Badge variant="outline" className={`${meta.className} shrink-0`}>
          <span className="mr-1">{meta.emoji}</span>
          {meta.label}
        </Badge>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium truncate">{leadName}</p>
            {!compact && (
              <span className="text-xs text-muted-foreground">·</span>
            )}
            <span className="text-xs text-muted-foreground">{TASK_TYPE_LABELS[task.task_type]}</span>
            {lead && (lead as any).follow_up_level > 0 && (
              <span className="inline-flex items-center rounded-full bg-orange-100 px-1.5 py-0 text-[10px] font-medium text-orange-700">
                FU {(lead as any).follow_up_level}
              </span>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span className={overdue ? 'text-destructive font-medium' : ''}>
              {overdue ? 'En retard · ' : ''}
              {format(due, 'dd MMM yyyy', { locale: fr })}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {canOpenConversation && (
          <Button
            size="sm"
            variant="ghost"
            className="h-8 px-2"
            onClick={(e) => {
              e.stopPropagation();
              openConversation();
            }}
            data-testid={`task-linkedin-${task.id}`}
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="h-8 px-2"
          onClick={(e) => {
            e.stopPropagation();
            onOpenLead(task);
          }}
          data-testid={`task-open-${task.id}`}
        >
          <Eye className="h-3.5 w-3.5" />
        </Button>
        {task.task_type === 'rdv_result' && onRdvWon && onRdvLost && onRdvPostpone ? (
          <>
            <Button
              size="sm"
              variant="outline"
              className="h-8 border-emerald-300 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-700"
              onClick={(e) => { e.stopPropagation(); onRdvWon(task); }}
              disabled={isUpdating}
              data-testid={`task-rdv-won-${task.id}`}
            >
              <Trophy className="h-3.5 w-3.5" />
              {!compact && <span className="ml-1">Gagné</span>}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={(e) => { e.stopPropagation(); onRdvLost(task); }}
              disabled={isUpdating}
              data-testid={`task-rdv-lost-${task.id}`}
            >
              <XCircle className="h-3.5 w-3.5" />
              {!compact && <span className="ml-1">Perdu</span>}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-2"
              onClick={(e) => { e.stopPropagation(); onRdvPostpone(task); }}
              disabled={isUpdating}
              title="Pas de changement — reporter à J+7"
              data-testid={`task-rdv-postpone-${task.id}`}
            >
              <CalendarClock className="h-3.5 w-3.5" />
              {!compact && <span className="ml-1">+7j</span>}
            </Button>
          </>
        ) : (
          <>
            {onSnooze && (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 px-2"
                onClick={(e) => {
                  e.stopPropagation();
                  onSnooze(task);
                }}
                data-testid={`task-snooze-${task.id}`}
              >
                <AlarmClockOff className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button
              size="sm"
              variant="default"
              className="h-8"
              onClick={(e) => {
                e.stopPropagation();
                onComplete(task);
              }}
              disabled={isUpdating}
              data-testid={`task-complete-${task.id}`}
            >
              {isUpdating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              {!compact && <span className="ml-1">Fait</span>}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
