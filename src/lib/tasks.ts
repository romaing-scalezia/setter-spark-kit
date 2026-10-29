import { differenceInCalendarDays, isToday, isPast, startOfDay } from 'date-fns';
import type { Database } from '@/integrations/supabase/types';

export type Task = Database['public']['Tables']['tasks']['Row'];
export type TaskType = Database['public']['Enums']['task_type'];
export type TaskPriority = Database['public']['Enums']['task_priority'];
export type TaskStatus = Database['public']['Enums']['task_status'];

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  conversation_followup: 'Relancer la conversation',
  booking_followup: "Relancer la prise de RDV",
  manual_followup: 'Follow-up manuel',
  rdv_result: 'Résultat du RDV',
  start_conversation: 'Démarrer la conversation',
};

export const PRIORITY_META: Record<TaskPriority, { label: string; emoji: string; className: string }> = {
  urgent: { label: 'Urgent', emoji: '🚨', className: 'bg-destructive/10 text-destructive border-destructive/30' },
  high: { label: 'High', emoji: '🔥', className: 'bg-orange-100 text-orange-700 border-orange-200' },
  medium: { label: 'Medium', emoji: '🟡', className: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  low: { label: 'Low', emoji: '⚪', className: 'bg-muted text-muted-foreground border-border' },
};

const PRIORITY_RANK: Record<TaskPriority, number> = { urgent: 4, high: 3, medium: 2, low: 1 };

/**
 * Compute the *effective* priority of a task at runtime.
 * Rules (highest wins):
 * - Overdue → urgent
 * - booking_followup or rdv_result pending → urgent
 * - manual_followup with follow_up_level >= 3 → urgent
 * - Due today OR follow_up_level == 2 → high
 * - conversation_followup waiting → medium
 * - Future tasks fall back to stored priority (or low)
 */
export function computeEffectivePriority(task: Task, leadFollowUpLevel?: number | null): TaskPriority {
  const due = startOfDay(new Date(task.due_date));
  const today = startOfDay(new Date());
  const overdue = isPast(due) && !isToday(due);

  if (overdue) return 'urgent';
  if (task.task_type === 'booking_followup' || task.task_type === 'rdv_result') return 'urgent';
  if (task.task_type === 'manual_followup' && (leadFollowUpLevel ?? 0) >= 3) return 'urgent';

  if (isToday(due)) return 'high';
  if (task.task_type === 'manual_followup' && (leadFollowUpLevel ?? 0) === 2) return 'high';

  if (task.task_type === 'conversation_followup') return 'medium';

  // Future tasks
  const days = differenceInCalendarDays(due, today);
  if (days <= 2) return task.priority;
  return 'low';
}

export function sortByPriority<T extends { effectivePriority: TaskPriority; due_date: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const diff = PRIORITY_RANK[b.effectivePriority] - PRIORITY_RANK[a.effectivePriority];
    if (diff !== 0) return diff;
    return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
  });
}
